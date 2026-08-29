import { NextResponse } from "next/server";
import { adminSessionFromRequest, validAdminSession } from "@/lib/admin-auth";
import { sendApprovalEmail, type ApprovalEmailResult } from "@/lib/approval-email";
import { config } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";
import { canonicalProductUrl } from "@/lib/product-share";

function text(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}

type PublishedResult = { id: string; slug: string; name: string; approvedAt: Date; newlyPublished: boolean };

export async function PUT(request: Request, context: RouteContext<"/api/admin/products/[slug]/status">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!validAdminSession(adminSessionFromRequest(request))) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as {
    status?: unknown; name?: unknown; tagline?: unknown; categoryId?: unknown;
    reason?: unknown; overrideDuplicate?: unknown;
  } | null;
  if (body?.status !== "published" && body?.status !== "rejected") return NextResponse.json({ error: "Invalid moderation status." }, { status: 400 });
  const name = text(body.name, 80);
  const tagline = text(body.tagline, 160);
  const reason = text(body.reason, 1000);
  if (!name || !tagline) return NextResponse.json({ error: "Name and one-line description are required." }, { status: 400 });
  if (body.status === "rejected" && !reason) return NextResponse.json({ error: "Add an internal rejection reason." }, { status: 400 });

  try {
    const changed = await withTransaction(async (client): Promise<PublishedResult | { rejected: true } | null> => {
      const before = await client.query<{ id: string; slug: string; name: string; status: string; normalized_domain: string; approved_at: Date | null }>(
        `SELECT id::text,slug,name,status,normalized_domain,approved_at FROM products WHERE slug=$1 FOR UPDATE`, [slug],
      );
      const product = before.rows[0];
      if (!product) return null;
      if (product.status === "published" && body.status === "published" && product.approved_at) {
        return { id: product.id, slug: product.slug, name: product.name, approvedAt: new Date(product.approved_at), newlyPublished: false };
      }
      if (product.status !== "pending") throw new Error("ALREADY_REVIEWED");

      let categoryId: string | null = null;
      if (body.status === "published") {
        const category = await client.query<{ id: string }>(
          `SELECT id::text FROM categories WHERE id=$1::bigint AND slug IN ('pay-to-rank-directory','ad-auction-billboard','marketplace-sponsorship','game-experiment','other')`,
          [String(body.categoryId ?? "")],
        );
        categoryId = category.rows[0]?.id ?? null;
        if (!categoryId) throw new Error("INVALID_CATEGORY");
        const duplicate = await client.query(
          `SELECT 1 FROM products WHERE normalized_domain=$1 AND status='published' AND id<>$2::uuid LIMIT 1`,
          [product.normalized_domain, product.id],
        );
        if (duplicate.rows[0] && body.overrideDuplicate !== true) throw new Error("DUPLICATE_DOMAIN");
      }

      const updated = await client.query<{ slug: string; name: string; approved_at: Date | null }>(
        `UPDATE products
            SET status=$2,name=$3,tagline=$4,primary_category_id=$5::bigint,
                domain_override_approved=$6,
                approved_at=CASE WHEN $2='published' THEN COALESCE(approved_at,now()) ELSE approved_at END,
                published_at=CASE WHEN $2='published' THEN COALESCE(published_at,now()) ELSE published_at END,
                updated_at=now()
          WHERE id=$1::uuid RETURNING slug,name,approved_at`,
        [product.id, body.status, name, tagline, categoryId, body.status === "published" && body.overrideDuplicate === true],
      );
      if (body.status === "published" && categoryId) {
        await client.query(`DELETE FROM product_categories WHERE product_id=$1::uuid AND position=0`, [product.id]);
        await client.query(`INSERT INTO product_categories (product_id,category_id,position) VALUES ($1::uuid,$2::bigint,0) ON CONFLICT (product_id,category_id) DO UPDATE SET position=0`, [product.id, categoryId]);
      }
      await client.query(
        `INSERT INTO product_moderation_events (product_id,from_status,to_status,internal_reason) VALUES ($1::uuid,$2,$3,$4)`,
        [product.id, product.status, body.status, reason],
      );
      if (body.status === "published") await client.query(
        `INSERT INTO founder_email_sequence_state(product_id,reminder_due_at)
         VALUES($1::uuid,COALESCE($2::timestamptz,now())+interval '36 hours')
         ON CONFLICT(product_id) DO NOTHING`, [product.id,updated.rows[0].approved_at],
      );
      if (body.status === "rejected") return { rejected: true };
      return { id: product.id, slug: updated.rows[0].slug, name: updated.rows[0].name, approvedAt: new Date(updated.rows[0].approved_at!), newlyPublished: true };
    });

    if (!changed) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if ("rejected" in changed) return NextResponse.json({ status: "rejected" });

    let email: ApprovalEmailResult;
    try {
      email = await sendApprovalEmail(changed.id);
    } catch {
      email = { status: "failed", sentAt: null, providerId: null, warning: "Product published, but the approval email status could not be updated." };
      console.error("approval email dispatch failed", { productId: changed.id, code: "unexpected_dispatch_error" });
    }
    const publicUrl = canonicalProductUrl(config.siteUrl, changed.slug);
    return NextResponse.json({
      status: "published",
      newlyPublished: changed.newlyPublished,
      product: { slug: changed.slug, name: changed.name, publicUrl, approvedAt: changed.approvedAt.toISOString() },
      email,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "DUPLICATE_DOMAIN") return NextResponse.json({ error: "An approved product already uses this domain. Confirm the duplicate override to continue." }, { status: 409 });
    if (code === "INVALID_CATEGORY") return NextResponse.json({ error: "Choose one primary category." }, { status: 400 });
    if (code === "ALREADY_REVIEWED") return NextResponse.json({ error: "This submission was already reviewed." }, { status: 409 });
    const databaseError = error as { code?: unknown; constraint?: unknown };
    const databaseCode = typeof databaseError?.code === "string" && /^[A-Z0-9]{1,12}$/i.test(databaseError.code) ? databaseError.code : "unexpected";
    const constraint = typeof databaseError?.constraint === "string" && /^[a-z0-9_]{1,100}$/i.test(databaseError.constraint) ? databaseError.constraint : undefined;
    console.error("product moderation failed", { slug, code: databaseCode, ...(constraint ? { constraint } : {}) });
    return NextResponse.json({ error: "Could not update that submission." }, { status: 500 });
  }
}
