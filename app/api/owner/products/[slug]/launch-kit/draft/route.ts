import { NextResponse } from "next/server";
import { authenticateProOwner } from "@/lib/pro-access";
import { defaultLaunchKitDraft, normalizeLaunchKitDraft, type LaunchFacts } from "@/lib/launch-kit";
import { query, withTransaction } from "@/lib/db";
import { config } from "@/lib/config";
import { requestOriginIsSameSite } from "@/lib/request-security";
import { sharedProductUrl } from "@/lib/product-share";

async function facts(productId: string): Promise<LaunchFacts | null> {
  const rows = await query<{ name: string; tagline: string; use_case: string | null; intended_audience: string | null; website_url: string; slug: string; launch_state: string | null }>(
    `SELECT p.name,p.tagline,p.use_case,p.intended_audience,p.website_url,p.slug,
      (SELECT CASE WHEN lw.starts_at>now() THEN 'upcoming' WHEN now()<lw.ends_at THEN 'live' ELSE 'listed' END
       FROM product_launches pl JOIN launch_weeks lw ON lw.id=pl.launch_week_id
       WHERE pl.product_id=p.id AND pl.state IN ('scheduled','active','completed') ORDER BY lw.starts_at DESC LIMIT 1) AS launch_state
     FROM products p WHERE p.id=$1::uuid`, [productId],
  );
  const row = rows[0];
  return row ? { name: row.name, tagline: row.tagline, useCase: row.use_case, audience: row.intended_audience, websiteUrl: row.website_url, founderTrailUrl: sharedProductUrl(config.siteUrl, row.slug), launchState: row.launch_state === "upcoming" || row.launch_state === "live" ? row.launch_state : "listed" } : null;
}

export async function GET(request: Request, context: RouteContext<"/api/owner/products/[slug]/launch-kit/draft">) {
  const { slug } = await context.params;
  const access = await authenticateProOwner(request, slug);
  if (!access) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const productFacts = await facts(access.productId);
  if (!productFacts) return NextResponse.json({ error: "Startup not found." }, { status: 404 });
  const rows = await query<{ version: number; image_draft: Record<string, unknown>; social_draft: Record<string, unknown>; updated_at: Date }>(`SELECT version,image_draft,social_draft,updated_at FROM pro_launch_kit_drafts WHERE product_id=$1::uuid`, [access.productId]);
  const row = rows[0];
  const draft = row ? normalizeLaunchKitDraft({ image: row.image_draft, social: row.social_draft }, productFacts) : defaultLaunchKitDraft(productFacts);
  return NextResponse.json({ draft, version: row?.version ?? 0, updatedAt: row?.updated_at.toISOString() ?? null, entitlementStatus: access.entitlementStatus }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(request: Request, context: RouteContext<"/api/owner/products/[slug]/launch-kit/draft">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const access = await authenticateProOwner(request, slug);
  if (!access) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  if (access.entitlementStatus !== "active") return NextResponse.json({ error: "An active Pro upgrade is required to save this launch kit." }, { status: 403 });
  const body = await request.json().catch(() => null) as { version?: unknown; draft?: unknown } | null;
  if (!Number.isInteger(body?.version) || Number(body?.version) < 0) return NextResponse.json({ error: "Invalid draft version." }, { status: 400 });
  const productFacts = await facts(access.productId);
  if (!productFacts) return NextResponse.json({ error: "Startup not found." }, { status: 404 });
  const draft = normalizeLaunchKitDraft(body?.draft, productFacts);
  const saved = await withTransaction(async (client) => {
    if (body!.version === 0) {
      return client.query<{ version: number; updated_at: Date }>(
        `INSERT INTO pro_launch_kit_drafts(product_id,version,image_draft,social_draft,updated_by)
         VALUES($1::uuid,1,$2::jsonb,$3::jsonb,$4) ON CONFLICT(product_id) DO NOTHING RETURNING version,updated_at`,
        [access.productId, JSON.stringify(draft.image), JSON.stringify(draft.social), access.userId],
      );
    }
    return client.query<{ version: number; updated_at: Date }>(
      `UPDATE pro_launch_kit_drafts SET version=version+1,image_draft=$3::jsonb,social_draft=$4::jsonb,updated_by=$5,updated_at=now()
       WHERE product_id=$1::uuid AND version=$2 RETURNING version,updated_at`,
      [access.productId, body!.version, JSON.stringify(draft.image), JSON.stringify(draft.social), access.userId],
    );
  });
  const row = saved.rows[0];
  if (!row) return NextResponse.json({ error: "This launch kit changed in another tab. Reload before saving again." }, { status: 409 });
  return NextResponse.json({ draft, version: row.version, updatedAt: row.updated_at.toISOString() });
}
