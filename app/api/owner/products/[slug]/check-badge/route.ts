import { NextResponse } from "next/server";

import { config } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { authenticateOwner } from "@/lib/owner-auth";
import { containsBadgeInstallation } from "@/lib/product-verification";
import { requestOriginIsSameSite } from "@/lib/request-security";
import { fetchPinnedVerificationHtml } from "@/lib/safe-fetch";

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/check-badge">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  let rows: { id: string; public_id: string; website_url: string; domain_verified_at: Date | null };
  try { rows = await withTransaction(async (client) => {
    const found = await client.query<{ id: string; public_id: string; website_url: string; domain_verified_at: Date | null }>(
      `SELECT i.id::text,i.public_id::text,p.website_url,i.domain_verified_at
         FROM product_integrations i JOIN products p ON p.id=i.product_id
        WHERE i.product_id=$1::uuid`, [owner.productId]);
    if (!found.rows[0]) throw new Error("NO_INTEGRATION");
    const recent = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM api_rate_limit_events
        WHERE action='badge-check' AND key_hash=$1 AND created_at>=now()-interval '1 hour'`, [owner.tokenHash]);
    if (Number(recent.rows[0]?.count ?? 0) >= 10) throw new Error("RATE");
    await client.query(`INSERT INTO api_rate_limit_events (action,key_hash) VALUES ('badge-check',$1)`, [owner.tokenHash]);
    return found.rows[0];
  }); } catch (error) {
    const code=error instanceof Error?error.message:"";
    if(code==="RATE")return NextResponse.json({error:"Too many installation checks. Try again in an hour."},{status:429});
    return NextResponse.json({error:"Create verification setup first."},{status:409});
  }

  let installed = false;
  let outcome = "not_found";
  try {
    const result = await fetchPinnedVerificationHtml(rows.website_url);
    installed = containsBadgeInstallation(result.html, rows.public_id, config.siteUrl);
    outcome = installed ? "active" : "not_found";
  } catch { outcome = "network_error"; }

  const changed = await withTransaction(async (client) => {
    const updated = await client.query<{ badge_installed_at: Date | null; product_verified_at: Date | null }>(
      `UPDATE product_integrations
          SET badge_status=CASE WHEN $2::boolean THEN 'active' ELSE CASE WHEN badge_installed_at IS NULL THEN 'failed' ELSE 'needs_attention' END END,
              badge_installed_at=CASE WHEN $2::boolean THEN COALESCE(badge_installed_at,now()) ELSE badge_installed_at END,
              badge_last_checked_at=now(),
              product_verified_at=CASE WHEN $2::boolean AND domain_verified_at IS NOT NULL THEN COALESCE(product_verified_at,now()) ELSE product_verified_at END,
              updated_at=now()
        WHERE id=$1::uuid RETURNING badge_installed_at,product_verified_at`, [rows.id, installed]);
    return updated.rows[0];
  });
  return NextResponse.json({ installed, outcome, error: installed ? undefined : outcome === "not_found" ? "FounderTrail could not find the badge code and project ID at the approved product URL. Deploy the snippet, then try again." : "FounderTrail could not safely load the approved product URL. Confirm it is publicly available over HTTPS.", checkedAt: new Date().toISOString(), installedAt: changed?.badge_installed_at?.toISOString() ?? null, productVerifiedAt: changed?.product_verified_at?.toISOString() ?? null }, { status: installed ? 200 : 422 });
}
