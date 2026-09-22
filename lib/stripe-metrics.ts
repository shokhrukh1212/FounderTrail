import "server-only";
import Stripe from "stripe";
import { query, withTransaction } from "./db";
import { decryptMetricSecret } from "./secret-encryption";
import { normalizeRecurringMonthly } from "./stripe-metric-math";

export { normalizeRecurringMonthly } from "./stripe-metric-math";

export type StripeScopeProduct = { id: string; name: string; active: boolean };

function stripeClient(secret: string) {
  return new Stripe(secret, { maxNetworkRetries: 2, timeout: 20_000 });
}

export function isRestrictedStripeKey(value: string): boolean {
  return /^rk_(?:test|live)_[A-Za-z0-9]{16,}$/.test(value);
}

export async function inspectRestrictedStripeKey(secret: string): Promise<{ accountId: string; products: StripeScopeProduct[]; livemode: boolean }> {
  if (!isRestrictedStripeKey(secret)) throw new Error("Use a Stripe restricted key beginning with rk_test_ or rk_live_. Unrestricted secret keys are not accepted.");
  const stripe = stripeClient(secret);
  let account: Stripe.Account;
  try {
    [account] = await Promise.all([
      stripe.accounts.retrieve(),
      stripe.subscriptions.list({ status: "all", limit: 1 }),
      stripe.charges.list({ limit: 1 }),
      stripe.invoices.list({ limit: 1 }),
      stripe.products.list({ limit: 1 }),
      stripe.prices.list({ limit: 1 }),
    ]);
  } catch {
    throw new Error("The restricted key must allow read access to the account, products, charges, invoices, prices, and subscriptions.");
  }
  const products: StripeScopeProduct[] = [];
  for await (const product of stripe.products.list({ active: true, limit: 100 })) products.push({ id: product.id, name: product.name, active: product.active });
  return { accountId: account.id, products, livemode: secret.startsWith("rk_live_") };
}

type ConnectionRow = {
  id: string; encrypted_secret: Buffer; encryption_iv: Buffer; encryption_tag: Buffer;
  scope_mode: "selected_products" | "account_wide"; provider_product_ids: string[];
};

function productId(value: string | Stripe.Product | Stripe.DeletedProduct | null): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

export async function syncStripeConnection(connectionId: string): Promise<void> {
  const rows = await query<ConnectionRow>(`SELECT id::text,encrypted_secret,encryption_iv,encryption_tag,scope_mode,provider_product_ids FROM metric_connections WHERE id=$1::uuid AND provider='stripe' AND disconnected_at IS NULL`, [connectionId]);
  const connection = rows[0];
  if (!connection) throw new Error("CONNECTION_NOT_FOUND");
  const secret = decryptMetricSecret(connection.encrypted_secret, connection.encryption_iv, connection.encryption_tag);
  const stripe = stripeClient(secret);
  const selected = new Set(connection.provider_product_ids);
  const accepts = (id: string | null) => Boolean(id && (connection.scope_mode === "account_wide" || selected.has(id)));
  const revenue = new Map<string, number>();
  const mrr = new Map<string, number>();
  let matchedRevenue = false;
  let matchedMrr = false;
  const cutoffSeconds = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

  for await (const charge of stripe.charges.list({ created: { gte: cutoffSeconds }, limit: 100 })) {
    const chargeRecord = charge as Stripe.Charge & { invoice?: string | Stripe.Invoice | null };
    if (!chargeRecord.paid || chargeRecord.status !== "succeeded" || !chargeRecord.invoice) continue;
    const invoiceId = typeof chargeRecord.invoice === "string" ? chargeRecord.invoice : chargeRecord.invoice.id;
    if (!invoiceId) continue;
    let scoped = 0;
    let invoiceBase = 0;
    let currency = charge.currency.toUpperCase();
    for await (const line of stripe.invoices.listLineItems(invoiceId, { limit: 100, expand: ["data.pricing.price_details.product"] })) {
      const record = line as unknown as { amount: number; currency: string; pricing?: { price_details?: { product?: string | Stripe.Product | Stripe.DeletedProduct | null } } | null; price?: { product?: string | Stripe.Product | Stripe.DeletedProduct | null } | null };
      const lineProduct = productId(record.pricing?.price_details?.product ?? record.price?.product ?? null);
      invoiceBase += Math.max(0, record.amount);
      currency = record.currency.toUpperCase();
      if (accepts(lineProduct)) scoped += Math.max(0, record.amount);
    }
    if (!scoped) continue;
    matchedRevenue = true;
    const allocatedRefund = invoiceBase > 0 ? Math.round(chargeRecord.amount_refunded * scoped / invoiceBase) : 0;
    revenue.set(currency, (revenue.get(currency) ?? 0) + Math.max(0, scoped - allocatedRefund));
  }

  for await (const subscription of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.items.data.price.product"] })) {
    if (subscription.status !== "active" && subscription.status !== "trialing") continue;
    for (const item of subscription.items.data) {
      const recurring = item.price.recurring;
      const id = productId(item.price.product);
      if (!recurring || !accepts(id)) continue;
      const decimal = item.price.unit_amount_decimal ?? (item.price.unit_amount === null ? null : String(item.price.unit_amount));
      if (!decimal) continue;
      const value = normalizeRecurringMonthly({ unitAmountDecimal: decimal, quantity: item.quantity ?? 1, interval: recurring.interval, intervalCount: recurring.interval_count });
      const currency = item.price.currency.toUpperCase();
      mrr.set(currency, (mrr.get(currency) ?? 0) + value);
      matchedMrr = true;
    }
  }

  const periodEnd = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000);
  const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
  await withTransaction(async (client) => {
    const previous = await client.query<{ metric_type: "revenue_30d" | "mrr"; currency: string }>(`SELECT DISTINCT metric_type,currency FROM metric_snapshots WHERE connection_id=$1::uuid`, [connectionId]);
    for (const item of previous.rows) {
      if (item.metric_type === "revenue_30d" && !revenue.has(item.currency)) revenue.set(item.currency, 0);
      if (item.metric_type === "mrr" && !mrr.has(item.currency)) mrr.set(item.currency, 0);
    }
    if (matchedRevenue || revenue.size) for (const [currency, value] of revenue) await client.query(`INSERT INTO metric_snapshots(connection_id,metric_type,currency,value_minor,period_start,period_end,methodology_version) VALUES($1::uuid,'revenue_30d',$2,$3,$4,$5,'stripe-v1') ON CONFLICT(connection_id,metric_type,currency,period_end) DO UPDATE SET value_minor=excluded.value_minor,period_start=excluded.period_start,created_at=now()`, [connectionId, currency, value, periodStart, periodEnd]);
    if (matchedMrr || mrr.size) for (const [currency, value] of mrr) await client.query(`INSERT INTO metric_snapshots(connection_id,metric_type,currency,value_minor,period_start,period_end,methodology_version) VALUES($1::uuid,'mrr',$2,$3,NULL,$4,'stripe-v1') ON CONFLICT(connection_id,metric_type,currency,period_end) DO UPDATE SET value_minor=excluded.value_minor,created_at=now()`, [connectionId, currency, value, periodEnd]);
    await client.query(`UPDATE metric_connections SET status='active',last_synced_at=now(),last_error=NULL,updated_at=now() WHERE id=$1::uuid`, [connectionId]);
  });
}
