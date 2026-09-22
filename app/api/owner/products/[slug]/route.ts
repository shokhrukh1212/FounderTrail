import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { query,withTransaction } from "@/lib/db";
import { updateOwnerMarketingPreference } from "@/lib/email-preferences";
import { authenticateOwner } from "@/lib/owner-auth";
import { canonicalProductUrl, xLaunchIntent } from "@/lib/product-share";
import { requestOriginIsSameSite } from "@/lib/request-security";

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
    const changed=await withTransaction(async client=>{const before=await client.query<{status:string}>(`SELECT p.status FROM products p WHERE p.id=$1::uuid AND p.status IN ('draft','rejected') AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id) FOR UPDATE`,[owner.productId]);const status=before.rows[0]?.status;if(!status)return false;await client.query(`UPDATE products SET status='pending',updated_at=now() WHERE id=$1::uuid`,[owner.productId]);await client.query(`INSERT INTO product_moderation_events(product_id,from_status,to_status,internal_reason) VALUES($1::uuid,$2,'pending',$3)`,[owner.productId,status,status==="rejected"?"Owner submitted requested changes for another review.":"Owner submitted verified draft for review."]);return true});
    return changed ? NextResponse.json({ message: "Submitted for review.", status: "pending" }) : NextResponse.json({ error: "Verify product ownership before submitting the draft or requested changes for review." }, { status: 409 });
  }
  const name = clean(body?.name, 80), tagline = clean(body?.tagline, 160), founder = clean(body?.founderName, 120);
  const socialRaw = typeof body?.founderSocialHandle === "string" ? body.founderSocialHandle.trim().replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, "").replace(/^@/, "").replace(/\/$/, "") : "";
  const social = socialRaw ? `@${socialRaw}` : null;
  const marketingOptIn = body?.marketingOptIn === true || body?.marketingOptIn === "on";
  if (!name || !tagline) return NextResponse.json({ error: "Product name and one-line description are required." }, { status: 400 });
  if (socialRaw && !/^[A-Za-z0-9_]{1,15}$/.test(socialRaw)) return NextResponse.json({ error: "Enter an X handle such as @alexsmith." }, { status: 400 });
  const categoryId = typeof body?.categoryId === "string" && /^\d+$/.test(body.categoryId) ? body.categoryId : "";
  const pricingModel = typeof body?.pricingModel === "string" && ["free","freemium","paid","open_source","contact","unknown"].includes(body.pricingModel) ? body.pricingModel : "";
  const startingRaw = typeof body?.startingPrice === "string" ? body.startingPrice.trim() : "";
  const starting = startingRaw ? Number(startingRaw) : null;
  const currency = typeof body?.pricingCurrency === "string" && /^[A-Z]{3}$/.test(body.pricingCurrency) ? body.pricingCurrency : "USD";
  if (!categoryId || !pricingModel || (starting !== null && (!Number.isFinite(starting) || starting < 0 || starting > 1_000_000))) return NextResponse.json({ error: "Choose a valid category and pricing model." }, { status: 400 });
  try {
    await withTransaction(async client=>{
      const category=await client.query<{id:string}>(`SELECT id::text FROM categories WHERE id=$1::bigint AND slug=ANY($2::text[])`,[categoryId,["ai-tools","productivity","developer-tools","marketing-seo","sales-crm","design-creative","writing-content","analytics-data","finance-accounting","ecommerce","education","health-fitness","travel","games","directories-discovery","advertising-sponsorship","other"]]);
      if(!category.rows[0])throw new Error("INVALID_CATEGORY");
      await client.query(`UPDATE products SET name=$2,tagline=$3,founder_name=$4,founder_social_handle=$5,primary_category_id=$6::bigint,category_review_required=false,category_provenance='founder',pricing_model=$7,starting_price_minor=$8,pricing_currency=$9,pricing_provenance='founder',pricing_checked_at=now(),updated_at=now() WHERE id=$1::uuid`,[owner.productId,name,tagline,founder,social,categoryId,pricingModel,starting===null?null:Math.round(starting*100),starting===null?null:currency]);
      await client.query(`DELETE FROM product_categories WHERE product_id=$1::uuid AND position=0`,[owner.productId]);
      await client.query(`INSERT INTO product_categories(product_id,category_id,position) VALUES($1::uuid,$2::bigint,0) ON CONFLICT(product_id,category_id) DO UPDATE SET position=0`,[owner.productId,categoryId]);
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details) VALUES($1,'user','product_classification_updated',$2::uuid,jsonb_build_object('categoryId',$3,'pricingModel',$4))`,[owner.userId,owner.productId,categoryId,pricingModel]);
    });
  } catch(error) {
    if(error instanceof Error&&error.message==="INVALID_CATEGORY")return NextResponse.json({error:"Choose a supported category."},{status:400});
    throw error;
  }
  const marketingPreference = await updateOwnerMarketingPreference(owner.productId, marketingOptIn);
  return NextResponse.json({ message: "Saved.", marketingPreference });
}
