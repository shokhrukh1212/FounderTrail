import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { config } from "@/lib/config";
import { query, withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";
import { encryptMetricSecret } from "@/lib/secret-encryption";
import { inspectRestrictedStripeKey, syncStripeConnection } from "@/lib/stripe-metrics";

async function ownedProduct(slug: string, userId: string) {
  return (await query<{ id: string }>(`SELECT p.id::text FROM products p WHERE p.slug=$1 AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2)`, [slug, userId]))[0] ?? null;
}

export async function GET(request: Request, context: RouteContext<"/api/owner/products/[slug]/metrics/stripe">) {
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const product = await ownedProduct(slug, user.id);
  if (!product) return NextResponse.json({ error: "Verified ownership required." }, { status: 403 });
  const rows = await query<{ id: string; provider_account_id: string | null; scope_mode: string; provider_product_ids: string[]; publish_revenue: boolean; publish_mrr: boolean; status: string; last_synced_at: Date | null; last_error: string | null }>(`SELECT id::text,provider_account_id,scope_mode,provider_product_ids,publish_revenue,publish_mrr,status,last_synced_at,last_error FROM metric_connections WHERE product_id=$1::uuid AND provider='stripe' AND disconnected_at IS NULL`, [product.id]);
  const connection = rows[0];
  return NextResponse.json({ configured: Boolean(config.metricEncryptionKey), connection: connection ? { id: connection.id, accountId: connection.provider_account_id, scopeMode: connection.scope_mode, providerProductIds: connection.provider_product_ids, publishRevenue: connection.publish_revenue, publishMrr: connection.publish_mrr, status: connection.status, lastSyncedAt: connection.last_synced_at?.toISOString() ?? null, lastError: connection.last_error } : null }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/metrics/stripe">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const product = await ownedProduct(slug, user.id);
  if (!product) return NextResponse.json({ error: "Verified ownership required." }, { status: 403 });
  if (!config.metricEncryptionKey) return NextResponse.json({ error: "Stripe metrics storage is not configured yet." }, { status: 503 });
  const allowed = await withTransaction((client) => consumeRateLimit(client, { action: "stripe-metrics", keyHash: eventHash("stripe-metrics:user", user.id), limit: 20, windowSeconds: 3600 }));
  if (!allowed) return NextResponse.json({ error: "Too many Stripe requests. Try again later." }, { status: 429 });
  const body = await request.json().catch(() => null) as { action?: unknown; secret?: unknown; scopeMode?: unknown; providerProductIds?: unknown; confirmAccountWide?: unknown } | null;
  const action = body?.action === "inspect" || body?.action === "connect" || body?.action === "sync" ? body.action : "";
  if (action === "sync") {
    const existing = (await query<{ id: string }>(`SELECT id::text FROM metric_connections WHERE product_id=$1::uuid AND provider='stripe' AND disconnected_at IS NULL`, [product.id]))[0];
    if (!existing) return NextResponse.json({ error: "No Stripe connection." }, { status: 404 });
    try { await syncStripeConnection(existing.id); return NextResponse.json({ ok: true }); }
    catch (error) { await query(`UPDATE metric_connections SET status='error',last_error=$2,updated_at=now() WHERE id=$1::uuid`, [existing.id, error instanceof Error ? error.message.slice(0,500) : "Sync failed"]).catch(() => {}); return NextResponse.json({ error: "Stripe sync failed. Check the key permissions and try again." }, { status: 502 }); }
  }
  const secret = typeof body?.secret === "string" ? body.secret.trim() : "";
  let inspection;
  try { inspection = await inspectRestrictedStripeKey(secret); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not validate the restricted key." }, { status: 422 }); }
  if (action === "inspect") return NextResponse.json({ accountId: inspection.accountId, livemode: inspection.livemode, products: inspection.products });
  if (action !== "connect") return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const scopeMode = body?.scopeMode === "account_wide" ? "account_wide" : "selected_products";
  const requested = Array.isArray(body?.providerProductIds) ? [...new Set(body.providerProductIds.filter((item): item is string => typeof item === "string" && /^prod_[A-Za-z0-9]+$/.test(item)))] : [];
  if (scopeMode === "account_wide" && body?.confirmAccountWide !== true) return NextResponse.json({ error: "Explicitly confirm that account-wide figures belong to this startup." }, { status: 400 });
  const available = new Set(inspection.products.map((item) => item.id));
  if (scopeMode === "selected_products" && (!requested.length || requested.some((id) => !available.has(id)))) return NextResponse.json({ error: "Select at least one product from this Stripe account." }, { status: 400 });
  const encrypted = encryptMetricSecret(secret);
  let connectionId: string;
  try {
    connectionId = await withTransaction(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`stripe:${inspection.accountId}`]);
      const saved = await client.query<{ id: string }>(`INSERT INTO metric_connections(product_id,provider,provider_account_id,scope_mode,provider_product_ids,encrypted_secret,encryption_iv,encryption_tag,status) VALUES($1::uuid,'stripe',$2,$3,$4,$5,$6,$7,'pending') ON CONFLICT(product_id,provider) DO UPDATE SET provider_account_id=excluded.provider_account_id,scope_mode=excluded.scope_mode,provider_product_ids=excluded.provider_product_ids,encrypted_secret=excluded.encrypted_secret,encryption_iv=excluded.encryption_iv,encryption_tag=excluded.encryption_tag,status='pending',last_error=NULL,disconnected_at=NULL,updated_at=now() RETURNING id::text`, [product.id, inspection.accountId, scopeMode, scopeMode === "account_wide" ? [] : requested, encrypted.encrypted, encrypted.iv, encrypted.tag]);
      const id = saved.rows[0].id;
      await client.query(`DELETE FROM metric_connection_scopes WHERE connection_id=$1::uuid`, [id]);
      const scopes = scopeMode === "account_wide" ? ["*"] : requested;
      for (const providerProductId of scopes) await client.query(`INSERT INTO metric_connection_scopes(connection_id,provider,provider_account_id,provider_product_id) VALUES($1::uuid,'stripe',$2,$3)`, [id, inspection.accountId, providerProductId]);
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details) VALUES($1,'user','metrics.stripe.connected',$2::uuid,jsonb_build_object('account',$3::text,'scope',$4::text,'livemode',$5::boolean))`, [user.id, product.id, inspection.accountId, scopeMode, inspection.livemode]);
      return id;
    });
  } catch (error) {
    const code = error as { code?: string };
    if (code.code === "23505") return NextResponse.json({ error: "That Stripe account or selected Stripe product is already assigned to another startup." }, { status: 409 });
    console.error("Stripe connection save failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not save the Stripe connection." }, { status: 500 });
  }
  try { await syncStripeConnection(connectionId); return NextResponse.json({ ok: true, connectionId }, { status: 201 }); }
  catch (error) { await query(`UPDATE metric_connections SET status='error',last_error=$2,updated_at=now() WHERE id=$1::uuid`, [connectionId, error instanceof Error ? error.message.slice(0,500) : "Initial sync failed"]).catch(() => {}); return NextResponse.json({ ok: true, connectionId, warning: "Connected, but the first sync failed. Check permissions and retry." }, { status: 202 }); }
}

export async function PATCH(request: Request, context: RouteContext<"/api/owner/products/[slug]/metrics/stripe">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const product = await ownedProduct(slug, user.id);
  if (!product) return NextResponse.json({ error: "Verified ownership required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { publishRevenue?: unknown; publishMrr?: unknown } | null;
  if (typeof body?.publishRevenue !== "boolean" || typeof body.publishMrr !== "boolean") return NextResponse.json({ error: "Invalid publication settings." }, { status: 400 });
  const updated = await query<{ id: string }>(`UPDATE metric_connections SET publish_revenue=$2,publish_mrr=$3,updated_at=now() WHERE product_id=$1::uuid AND provider='stripe' AND disconnected_at IS NULL RETURNING id::text`, [product.id, body.publishRevenue, body.publishMrr]);
  return updated[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No Stripe connection." }, { status: 404 });
}

export async function DELETE(request: Request, context: RouteContext<"/api/owner/products/[slug]/metrics/stripe">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const product = await ownedProduct(slug, user.id);
  if (!product) return NextResponse.json({ error: "Verified ownership required." }, { status: 403 });
  await withTransaction(async (client) => {
    await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id) VALUES($1,'user','metrics.stripe.disconnected',$2::uuid)`, [user.id, product.id]);
    await client.query(`DELETE FROM metric_connections WHERE product_id=$1::uuid AND provider='stripe'`, [product.id]);
  });
  return NextResponse.json({ ok: true });
}
