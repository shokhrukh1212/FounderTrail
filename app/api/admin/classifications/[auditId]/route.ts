import { NextResponse } from "next/server";

import { validAdminRequest } from "@/lib/admin-auth";
import { currentUserFromHeaders } from "@/lib/auth";
import { isFounderTrailCategorySlug } from "@/lib/categories";
import { withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

const PRICING = new Set(["free", "freemium", "paid", "open_source", "contact", "unknown"]);

export async function PUT(request: Request, context: RouteContext<"/api/admin/classifications/[auditId]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!await validAdminRequest(request)) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { auditId } = await context.params;
  if (!/^\d+$/.test(auditId)) return NextResponse.json({ error: "Invalid review ID." }, { status: 400 });
  const body = await request.json().catch(() => null) as { action?: unknown; value?: unknown } | null;
  if (body?.action !== "apply" && body?.action !== "dismiss") return NextResponse.json({ error: "Invalid review action." }, { status: 400 });
  const value = typeof body.value === "string" ? body.value.trim() : "";
  const actor = await currentUserFromHeaders(request.headers).catch(() => null);

  const result = await withTransaction(async (client) => {
    const found = await client.query<{ product_id: string; classification_kind: "category" | "pricing"; review_state: string }>(
      `SELECT product_id::text,classification_kind,review_state
         FROM product_classification_audits WHERE id=$1::bigint FOR UPDATE`, [auditId],
    );
    const item = found.rows[0];
    if (!item || item.review_state !== "needs_review") return false;
    if (body.action === "apply") {
      if (item.classification_kind === "category") {
        if (!isFounderTrailCategorySlug(value)) throw new Error("INVALID_VALUE");
        const category = await client.query<{ id: string }>(`SELECT id::text FROM categories WHERE slug=$1`, [value]);
        if (!category.rows[0]) throw new Error("INVALID_VALUE");
        await client.query(`UPDATE products SET primary_category_id=$2::bigint,category_review_required=false,category_provenance='admin',updated_at=now() WHERE id=$1::uuid`, [item.product_id, category.rows[0].id]);
        await client.query(`DELETE FROM product_categories WHERE product_id=$1::uuid AND position=0`, [item.product_id]);
        await client.query(`INSERT INTO product_categories(product_id,category_id,position) VALUES($1::uuid,$2::bigint,0) ON CONFLICT(product_id,category_id) DO UPDATE SET position=0`, [item.product_id, category.rows[0].id]);
      } else {
        if (!PRICING.has(value)) throw new Error("INVALID_VALUE");
        await client.query(`UPDATE products SET pricing_model=$2,pricing_provenance='admin',pricing_checked_at=now(),updated_at=now() WHERE id=$1::uuid`, [item.product_id, value]);
      }
    } else if (item.classification_kind === "category") {
      await client.query(`UPDATE products SET category_review_required=false,category_provenance='admin-reviewed',updated_at=now() WHERE id=$1::uuid`, [item.product_id]);
    }
    await client.query(`UPDATE product_classification_audits SET review_state=$2,applied_at=CASE WHEN $2='applied' THEN now() ELSE NULL END WHERE id=$1::bigint`, [auditId, body.action === "apply" ? "applied" : "rejected"]);
    await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details)
      VALUES($1,'admin',$2,$3::uuid,jsonb_build_object('classificationAuditId',$4::bigint,'kind',$5::text,'value',$6::text))`,
      [actor?.id ?? null, body.action === "apply" ? "classification_applied" : "classification_dismissed", item.product_id, auditId, item.classification_kind, value || null]);
    return true;
  });
  return result ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Review item was already handled." }, { status: 409 });
}
