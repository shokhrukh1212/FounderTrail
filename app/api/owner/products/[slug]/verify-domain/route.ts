import { NextResponse } from "next/server";

import { withTransaction } from "@/lib/db";
import { authenticateOwner } from "@/lib/owner-auth";
import { containsVerificationMeta, type VerificationMethod } from "@/lib/product-verification";
import { requestOriginIsSameSite } from "@/lib/request-security";
import { fetchPinnedHttpsText, fetchPinnedVerificationHtml } from "@/lib/safe-fetch";

type IntegrationRow = {
  id: string;
  allowed_domain: string;
  verification_token: string;
  website_url: string;
};

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/verify-domain">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { method?: unknown } | null;
  const method: VerificationMethod = body?.method === "file" ? "file" : "meta";

  let integration: IntegrationRow;
  try {
    integration = await withTransaction(async (client) => {
      const found = await client.query<IntegrationRow>(
        `SELECT i.id::text,i.allowed_domain,i.verification_token,p.website_url
           FROM product_integrations i JOIN products p ON p.id=i.product_id
          WHERE i.product_id=$1::uuid`, [owner.productId]);
      if (!found.rows[0]) throw new Error("NO_INTEGRATION");
      const recent = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM domain_verification_attempts
          WHERE integration_id=$1::uuid AND created_at>=now()-interval '1 hour'`, [found.rows[0].id]);
      if (Number(recent.rows[0]?.count ?? 0) >= 10) throw new Error("RATE");
      return found.rows[0];
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "RATE") return NextResponse.json({ error: "Too many verification checks. Try again in an hour.", outcome: "rate_limited" }, { status: 429 });
    return NextResponse.json({ error: "Create the partner integration first." }, { status: 409 });
  }

  let outcome = "network_error";
  try {
    if (method === "meta") {
      const result = await fetchPinnedVerificationHtml(integration.website_url);
      outcome = containsVerificationMeta(result.html, integration.verification_token) ? "verified" : "invalid_response";
    } else {
      const text = await fetchPinnedHttpsText(integration.allowed_domain, "/.well-known/bidindex-verification.txt");
      outcome = text.trim() === integration.verification_token ? "verified" : "invalid_response";
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    outcome = code === "FETCH_FAILED" || code === "NOT_FOUND" ? "not_found" : "network_error";
  }

  const state = await withTransaction(async (client) => {
    await client.query(`INSERT INTO domain_verification_attempts (integration_id,outcome) VALUES ($1::uuid,$2)`, [integration.id, outcome]);
    const changed = await client.query<{ domain_verified_at: Date | null; product_verified_at: Date | null }>(
      `UPDATE product_integrations
          SET domain_status=CASE WHEN $2='verified' THEN 'verified' ELSE 'failed' END,
              domain_verified_at=CASE WHEN $2='verified' THEN COALESCE(domain_verified_at,now()) ELSE domain_verified_at END,
              domain_last_checked_at=now(),domain_check_outcome=$2,verification_method=$3,
              product_verified_at=CASE WHEN $2='verified' AND badge_installed_at IS NOT NULL THEN COALESCE(product_verified_at,now()) ELSE product_verified_at END,
              updated_at=now()
        WHERE id=$1::uuid RETURNING domain_verified_at,product_verified_at`, [integration.id, outcome, method]);
    return changed.rows[0];
  });

  return NextResponse.json({
    verified: outcome === "verified",
    outcome,
    method,
    checkedAt: new Date().toISOString(),
    verifiedAt: state?.domain_verified_at?.toISOString() ?? null,
    productVerifiedAt: state?.product_verified_at?.toISOString() ?? null,
  }, { status: outcome === "verified" ? 200 : 422 });
}
