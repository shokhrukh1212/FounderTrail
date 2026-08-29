import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { query } from "@/lib/db";
import { updateOwnerMarketingPreference } from "@/lib/email-preferences";
import { authenticateOwner } from "@/lib/owner-auth";
import { canonicalProductUrl, xLaunchIntent } from "@/lib/product-share";
import { requestOriginIsSameSite } from "@/lib/request-security";

function clean(value: unknown, max: number): string | null { return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null; }

export async function GET(request: Request, context: RouteContext<"/api/owner/products/[slug]">) {
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const rows = await query<{ status: string; approved_at: Date | null; name: string; tagline: string }>(
    `SELECT status,approved_at,name,tagline FROM products WHERE id=$1::uuid LIMIT 1`, [owner.productId],
  );
  const product = rows[0];
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  const publicUrl = product.status === "published" ? canonicalProductUrl(config.siteUrl, slug) : null;
  return NextResponse.json({
    status: product.status,
    approvedAt: product.approved_at?.toISOString() ?? null,
    publicUrl,
    shareUrl: publicUrl ? xLaunchIntent({ siteUrl: config.siteUrl, slug, productName: product.name, description: product.tagline }) : null,
  }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(request: Request, context: RouteContext<"/api/owner/products/[slug]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = clean(body?.name, 80), tagline = clean(body?.tagline, 160), founder = clean(body?.founderName, 120);
  const socialRaw = typeof body?.founderSocialHandle === "string" ? body.founderSocialHandle.trim().replace(/^https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i, "").replace(/^@/, "").replace(/\/$/, "") : "";
  const social = socialRaw ? `@${socialRaw}` : null;
  const marketingOptIn = body?.marketingOptIn === true || body?.marketingOptIn === "on";
  if (!name || !tagline) return NextResponse.json({ error: "Product name and one-line description are required." }, { status: 400 });
  if (socialRaw && !/^[A-Za-z0-9_]{1,15}$/.test(socialRaw)) return NextResponse.json({ error: "Enter an X handle such as @alexsmith." }, { status: 400 });
  await query(`UPDATE products SET name=$2, tagline=$3, founder_name=$4, founder_social_handle=$5, updated_at=now() WHERE id=$1::uuid`, [owner.productId, name, tagline, founder, social]);
  const marketingPreference = await updateOwnerMarketingPreference(owner.productId, marketingOptIn);
  return NextResponse.json({ message: "Saved.", marketingPreference });
}
