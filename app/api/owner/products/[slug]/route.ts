import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { query,withTransaction } from "@/lib/db";
import { updateOwnerMarketingPreference } from "@/lib/email-preferences";
import { authenticateOwner } from "@/lib/owner-auth";
import { canonicalProductUrl, xLaunchIntent } from "@/lib/product-share";
import { requestOriginIsSameSite } from "@/lib/request-security";
import { normalizeCategorySelection } from "@/lib/categories";
import { applyProductCategories, InvalidCategorySelection } from "@/lib/product-categories";
import { parsePricingInput } from "@/lib/product-pricing";

function clean(value: unknown, max: number): string | null { return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null; }

export async function GET(request: Request, context: RouteContext<"/api/owner/products/[slug]">) {
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const rows = await query<{ status: string; approved_at: Date | null; name: string; tagline: string; review_reason:string|null }>(
    `SELECT p.status,p.approved_at,p.name,p.tagline,
      (SELECT me.internal_reason FROM product_moderation_events me WHERE me.product_id=p.id AND me.to_status='rejected' ORDER BY me.created_at DESC LIMIT 1) AS review_reason
      FROM products p WHERE p.id=$1::uuid LIMIT 1`, [owner.productId],
  );
  const product = rows[0];
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const publicUrl = product.status === "published" ? canonicalProductUrl(config.siteUrl, slug) : null;
  return NextResponse.json({
    status: product.status,
    approvedAt: product.approved_at?.toISOString() ?? null,
    publicUrl,
    shareUrl: publicUrl ? xLaunchIntent({ siteUrl: config.siteUrl, slug, productName: product.name, description: product.tagline }) : null,
    reviewReason:product.status==="rejected"?product.review_reason:null,
  }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request, context: RouteContext<"/api/owner/products/[slug]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (body?.action === "submit_for_review") {
    const changed=await withTransaction(async client=>{const before=await client.query<{status:string;submission_pro_selected:boolean}>(`SELECT p.status,p.submission_pro_selected FROM products p WHERE p.id=$1::uuid AND p.status IN ('draft','rejected') AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id) FOR UPDATE`,[owner.productId]);const product=before.rows[0];if(!product)return null;await client.query(`UPDATE products SET status='pending',updated_at=now() WHERE id=$1::uuid`,[owner.productId]);await client.query(`INSERT INTO product_moderation_events(product_id,from_status,to_status,internal_reason) VALUES($1::uuid,$2,'pending',$3)`,[owner.productId,product.status,product.status==="rejected"?"Owner submitted requested changes for another review.":"Owner submitted verified draft for review."]);return {proSelected:product.submission_pro_selected,wasRejected:product.status==="rejected"}});
    return changed ? NextResponse.json({ message: "Submitted for review.", status: "pending", proSelected: changed.proSelected && !changed.wasRejected }) : NextResponse.json({ error: "Verify product ownership before submitting the draft or requested changes for review." }, { status: 409 });
  }
  // The Settings tab saves only the optional founder-news preference. Product saves no
  // longer carry that checkbox, so saving a listing can never change email consent.
  if (body?.action === "update_settings") {
    const marketingPreference = await updateOwnerMarketingPreference(owner.productId, body.marketingOptIn === true || body.marketingOptIn === "on");
    return NextResponse.json({ message: "Settings saved.", marketingPreference });
  }
  // "Product name" edits the public short name. The originally submitted name and the
  // slug are never rewritten, so history and links stay intact.
  const submittedShortName = typeof body?.shortName === "string" ? body.shortName.trim() : "";
  if (submittedShortName.length > 60) return NextResponse.json({ error: "Use 60 characters or fewer for the product name, and put the rest in the one-line description.", field: "shortName" }, { status: 400 });
  const shortName = clean(submittedShortName, 60), tagline = clean(body?.tagline, 160), founder = clean(body?.founderName, 120);
  const socialRaw = typeof body?.founderSocialHandle === "string" ? body.founderSocialHandle.trim().replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, "").replace(/^@/, "").replace(/\/$/, "") : "";
  const social = socialRaw ? `@${socialRaw}` : null;
  if (!shortName || !tagline) return NextResponse.json({ error: "Product name and one-line description are required." }, { status: 400 });
  if (socialRaw && !/^[A-Za-z0-9_]{1,15}$/.test(socialRaw)) return NextResponse.json({ error: "Enter an X handle such as @alexsmith." }, { status: 400 });
  const categories = normalizeCategorySelection(body?.categories);
  if (!categories.ok) return NextResponse.json({ error: categories.error, field: "categories" }, { status: 400 });
  const pricing = parsePricingInput(body ?? {});
  if (!pricing.ok) return NextResponse.json({ error: pricing.error, field: pricing.field }, { status: 400 });
  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE products
            SET short_name=$2,short_name_source='founder',short_name_updated_at=now(),short_name_updated_by=$3,
                tagline=$4,founder_name=$5,founder_social_handle=$6,
                pricing_model=$7,starting_price_minor=$8,pricing_currency=$9,pricing_basis=$10,pricing_unit=$11,
                pricing_per_seat=$12,
                pricing_source=CASE WHEN $7::text IS NULL THEN NULL ELSE 'founder' END,
                pricing_confirmed_at=CASE WHEN $7::text IS NULL THEN NULL ELSE now() END,
                pricing_confirmed_by=CASE WHEN $7::text IS NULL THEN NULL ELSE $3 END,
                updated_at=now()
          WHERE id=$1::uuid`,
        [owner.productId, shortName, owner.userId, tagline, founder, social,
         pricing.value.model, pricing.value.startingPriceMinor, pricing.value.currency,
         pricing.value.basis, pricing.value.unit, pricing.value.perSeat],
      );
      await applyProductCategories(client, owner.productId, categories.slugs, "founder");
      await client.query(
        `INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details)
         VALUES($1,'user','product_classification_updated',$2::uuid,jsonb_build_object('categories',$3::text[],'pricingModel',$4::text))`,
        [owner.userId, owner.productId, categories.slugs, pricing.value.model],
      );
    });
  } catch (error) {
    if (error instanceof InvalidCategorySelection) return NextResponse.json({ error: error.message, field: "categories" }, { status: 400 });
    throw error;
  }
  return NextResponse.json({ message: "Saved." });
}
