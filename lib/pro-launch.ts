import "server-only";

import type { PoolClient } from "pg";
import { config } from "./config";
import { query } from "./db";
import {
  PRO_CURRENCY,
  PRO_INTRO_LIMIT,
  PRO_INTRO_PRICE_MINOR,
  PRO_RESERVATION_HOURS,
  PRO_STANDARD_PRICE_MINOR,
  disputeTransition,
  fullRefundReached,
  nextIntroSlot,
  type ProEnvironment,
  type ProEntitlementStatus,
} from "./pro-launch-policy";

const PRO_INVENTORY_LOCK = 8_140_25_04;
let warnedAboutMissingSchema = false;

function missingProSchema(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "42P01";
}

function warnMissingSchema(): void {
  if (warnedAboutMissingSchema) return;
  warnedAboutMissingSchema = true;
  console.warn("FounderTrail Pro migration 016 is not applied; Pro features are temporarily unavailable.");
}

export type ProAvailability = {
  completed: number;
  reserved: number;
  available: number;
  currentPriceMinor: 500 | 900;
  currency: typeof PRO_CURRENCY;
};

export type ProState = {
  status: ProEntitlementStatus | null;
  source: "purchase" | "admin_grant" | null;
  activatedAt: Date | null;
};

export async function getProAvailability(environment: ProEnvironment = config.dodoPayments.environment): Promise<ProAvailability> {
  let rows: Array<{ completed: number; reserved: number; allocated: number }>;
  try {
    rows = await query<{ completed: number; reserved: number; allocated: number }>(
      `SELECT
         count(*) FILTER (WHERE intro_slot IS NOT NULL AND paid_at IS NOT NULL)::int AS completed,
         count(*) FILTER (WHERE intro_slot IS NOT NULL AND paid_at IS NULL AND status IN ('held','checkout_created','processing'))::int AS reserved,
         count(*) FILTER (WHERE intro_slot IS NOT NULL)::int AS allocated
       FROM pro_launch_orders WHERE provider_environment=$1`,
      [environment],
    );
  } catch (error) {
    if (!missingProSchema(error)) throw error;
    warnMissingSchema();
    return { completed: 0, reserved: 0, available: 0, currentPriceMinor: PRO_STANDARD_PRICE_MINOR, currency: PRO_CURRENCY };
  }
  const row = rows[0] ?? { completed: 0, reserved: 0, allocated: 0 };
  const available = Math.max(0, PRO_INTRO_LIMIT - Number(row.allocated));
  return {
    completed: Number(row.completed),
    reserved: Number(row.reserved),
    available,
    currentPriceMinor: available > 0 ? PRO_INTRO_PRICE_MINOR : PRO_STANDARD_PRICE_MINOR,
    currency: PRO_CURRENCY,
  };
}

export async function getProState(productId: string): Promise<ProState> {
  let rows: Array<{ status: ProEntitlementStatus; source: "purchase" | "admin_grant"; activated_at: Date }>;
  try {
    rows = await query<{ status: ProEntitlementStatus; source: "purchase" | "admin_grant"; activated_at: Date }>(
      `SELECT status,source,activated_at FROM pro_entitlements WHERE product_id=$1::uuid`,
      [productId],
    );
  } catch (error) {
    if (!missingProSchema(error)) throw error;
    warnMissingSchema();
    return { status: null, source: null, activatedAt: null };
  }
  const row = rows[0];
  return row
    ? { status: row.status, source: row.source, activatedAt: new Date(row.activated_at) }
    : { status: null, source: null, activatedAt: null };
}

export type ReservedProOrder = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  priceMinor: 500 | 900;
  introSlot: number | null;
  reservationExpiresAt: Date;
  checkoutSessionId: string | null;
  checkoutUrl: string | null;
  reused: boolean;
};

export async function reserveProOrder(
  client: PoolClient,
  input: { productId: string; purchaserId: string; acceptedPriceMinor: 500 | 900; environment: ProEnvironment },
): Promise<ReservedProOrder> {
  await client.query("SELECT pg_advisory_xact_lock($1)", [PRO_INVENTORY_LOCK]);

  // A hold for which no provider session was ever created cannot later charge. Releasing
  // only these rows is safe; session-backed expiries are reconciled by the worker first.
  await client.query(
    `UPDATE pro_launch_orders SET status='cancelled',intro_slot=NULL,updated_at=now()
      WHERE provider_environment=$1 AND status='held' AND reservation_expires_at<=now()
        AND dodo_checkout_session_id IS NULL`,
    [input.environment],
  );

  const products = await client.query<{ id: string; slug: string; name: string }>(
    `SELECT p.id::text,p.slug,p.name FROM products p
      WHERE p.id=$1::uuid AND p.status='published'
        AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2)
      FOR UPDATE`,
    [input.productId, input.purchaserId],
  );
  const product = products.rows[0];
  if (!product) throw new Error("NOT_ELIGIBLE");

  const entitlement = await client.query<{ status: ProEntitlementStatus }>(
    `SELECT status FROM pro_entitlements WHERE product_id=$1::uuid FOR UPDATE`,
    [product.id],
  );
  if (entitlement.rows[0]?.status === "active") throw new Error("ALREADY_PRO");
  if (entitlement.rows[0]?.status === "suspended") throw new Error("PRO_SUSPENDED");

  const existing = await client.query<{
    id: string; quoted_price_minor: number; intro_slot: number | null; reservation_expires_at: Date;
    dodo_checkout_session_id: string | null; checkout_url: string | null;
  }>(
    `SELECT id::text,quoted_price_minor,intro_slot,reservation_expires_at,dodo_checkout_session_id,checkout_url
       FROM pro_launch_orders
      WHERE product_id=$1::uuid AND status IN ('held','checkout_created','processing')
      ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
    [product.id],
  );
  if (existing.rows[0]) {
    const order = existing.rows[0];
    if (new Date(order.reservation_expires_at).getTime() <= Date.now() && order.dodo_checkout_session_id) {
      throw new Error("ORDER_RECONCILING");
    }
    if (order.quoted_price_minor !== input.acceptedPriceMinor) throw new Error(`PRICE_CHANGED:${order.quoted_price_minor}`);
    return {
      id: order.id, productId: product.id, slug: product.slug, name: product.name,
      priceMinor: order.quoted_price_minor as 500 | 900, introSlot: order.intro_slot,
      reservationExpiresAt: new Date(order.reservation_expires_at), checkoutSessionId: order.dodo_checkout_session_id,
      checkoutUrl: order.checkout_url, reused: true,
    };
  }

  const used = await client.query<{ intro_slot: number }>(
    `SELECT intro_slot FROM pro_launch_orders
      WHERE provider_environment=$1 AND intro_slot IS NOT NULL ORDER BY intro_slot`,
    [input.environment],
  );
  // A paid/refunded introductory order keeps its allocation forever. Besides keeping
  // the public counter monotonic, this product-level check prevents a founder from
  // buying another $5 allocation under a different slot after a refund.
  const priorIntro = await client.query<{ used_intro: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM pro_launch_orders
        WHERE product_id=$1::uuid AND provider_environment=$2
          AND intro_slot IS NOT NULL AND paid_at IS NOT NULL
     ) AS used_intro`,
    [product.id, input.environment],
  );
  const slot = priorIntro.rows[0]?.used_intro
    ? null
    : nextIntroSlot(used.rows.map((row) => row.intro_slot));
  const currentPrice = slot === null ? PRO_STANDARD_PRICE_MINOR : PRO_INTRO_PRICE_MINOR;
  if (input.acceptedPriceMinor !== currentPrice) throw new Error(`PRICE_CHANGED:${currentPrice}`);
  const expires = new Date(Date.now() + PRO_RESERVATION_HOURS * 60 * 60 * 1000);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO pro_launch_orders(product_id,purchaser_id,provider_environment,quoted_price_minor,currency,intro_slot,reservation_expires_at)
     VALUES($1::uuid,$2,$3,$4,$5,$6,$7) RETURNING id::text`,
    [product.id, input.purchaserId, input.environment, currentPrice, PRO_CURRENCY, slot, expires],
  );
  return {
    id: inserted.rows[0].id, productId: product.id, slug: product.slug, name: product.name,
    priceMinor: currentPrice, introSlot: slot, reservationExpiresAt: expires,
    checkoutSessionId: null, checkoutUrl: null, reused: false,
  };
}

async function createResultWindow(client: PoolClient, productId: string, orderId: string | null, activatedAt: Date) {
  const launches = await client.query<{ id: string; starts_at: Date }>(
    `SELECT pl.id::text,lw.starts_at FROM product_launches pl JOIN launch_weeks lw ON lw.id=pl.launch_week_id
      WHERE pl.product_id=$1::uuid AND pl.state IN ('scheduled','active') AND lw.state IN ('scheduled','active')
        AND lw.starts_at>$2 ORDER BY lw.starts_at LIMIT 1`,
    [productId, activatedAt],
  );
  const future = launches.rows[0];
  const start = future ? new Date(future.starts_at) : activatedAt;
  const coverage = await client.query<{ starts_at: Date }>(`SELECT starts_at FROM pro_reporting_coverage WHERE singleton=true`);
  await client.query(
    `INSERT INTO pro_result_windows(product_id,entitlement_order_id,anchor_kind,launch_id,starts_at,ends_at,coverage_starts_at,status)
       VALUES($1::uuid,$2::uuid,$3,$4::uuid,$5::timestamptz,$5::timestamptz+interval '7 days',$6::timestamptz,
       CASE WHEN $5::timestamptz>now() THEN 'scheduled' ELSE 'in_progress' END)
     ON CONFLICT(product_id) DO NOTHING`,
    [productId, orderId, future ? "future_launch" : "activation", future?.id ?? null, start, coverage.rows[0]?.starts_at ?? activatedAt],
  );
}

async function setEntitlement(
  client: PoolClient,
  input: { productId: string; orderId: string | null; status: ProEntitlementStatus; action: "activated" | "granted" | "suspended" | "restored" | "revoked"; reason: string; actorKind: "admin" | "system" | "provider"; actorUserId?: string | null },
) {
  const existing = await client.query<{ status: ProEntitlementStatus; source: "purchase" | "admin_grant"; activated_at: Date }>(
    `SELECT status,source,activated_at FROM pro_entitlements WHERE product_id=$1::uuid FOR UPDATE`, [input.productId],
  );
  const prior = existing.rows[0];
  if (!prior) {
    await client.query(
      `INSERT INTO pro_entitlements(product_id,source,source_order_id,status,activated_at,suspended_at,revoked_at)
       VALUES($1::uuid,$2,$3::uuid,$4,now(),CASE WHEN $4='suspended' THEN now() END,CASE WHEN $4='revoked' THEN now() END)`,
      [input.productId, input.orderId ? "purchase" : "admin_grant", input.orderId, input.status],
    );
  } else {
    await client.query(
      `UPDATE pro_entitlements SET status=$2,
         suspended_at=CASE WHEN $2='suspended' THEN now() ELSE suspended_at END,
         revoked_at=CASE WHEN $2='revoked' THEN now() ELSE NULL END,updated_at=now()
       WHERE product_id=$1::uuid`,
      [input.productId, input.status],
    );
  }
  if (prior?.status !== input.status || !prior) {
    await client.query(
      `INSERT INTO pro_entitlement_events(product_id,order_id,actor_user_id,actor_kind,action,reason)
       VALUES($1::uuid,$2::uuid,$3,$4,$5,$6)`,
      [input.productId, input.orderId, input.actorUserId ?? null, input.actorKind, input.action, input.reason],
    );
  }
  return prior?.activated_at ? new Date(prior.activated_at) : new Date();
}

export async function activatePurchasedPro(client: PoolClient, productId: string, orderId: string) {
  const activatedAt = await setEntitlement(client, {
    productId, orderId, status: "active", action: "activated", actorKind: "provider",
    reason: "Verified Dodo payment succeeded",
  });
  await createResultWindow(client, productId, orderId, activatedAt);
}

export async function grantPro(client: PoolClient, productId: string, actorUserId: string, reason: string) {
  const activatedAt = await setEntitlement(client, {
    productId, orderId: null, status: "active", action: "granted", actorKind: "admin", actorUserId, reason,
  });
  await createResultWindow(client, productId, null, activatedAt);
}

export async function adminSetProEntitlement(client: PoolClient, input: { productId: string; actorUserId: string; action: "grant" | "revoke" | "restore"; reason: string }) {
  if (input.action === "grant") return grantPro(client, input.productId, input.actorUserId, input.reason);
  const existing = await client.query<{ source_order_id: string | null }>(`SELECT source_order_id::text FROM pro_entitlements WHERE product_id=$1::uuid FOR UPDATE`, [input.productId]);
  if (!existing.rows[0]) throw new Error("ENTITLEMENT_NOT_FOUND");
  const status = input.action === "restore" ? "active" : "revoked";
  return setEntitlement(client, {
    productId: input.productId, orderId: existing.rows[0].source_order_id, status,
    action: input.action === "restore" ? "restored" : "revoked", actorKind: "admin",
    actorUserId: input.actorUserId, reason: input.reason,
  });
}

type ProWebhookEvent = {
  business_id: string;
  timestamp: string;
  type: string;
  data: Record<string, unknown>;
};

function metadata(data: Record<string, unknown>): Record<string, unknown> {
  return data.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : {};
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export function minimalProDodoEvent(event: ProWebhookEvent): Record<string, unknown> {
  const data = event.data;
  return {
    type: event.type, business_id: event.business_id, timestamp: event.timestamp,
    data: {
      payment_id: data.payment_id, checkout_session_id: data.checkout_session_id,
      refund_id: data.refund_id, dispute_id: data.dispute_id, dispute_status: data.dispute_status,
      total_amount: data.total_amount, tax: data.tax, amount: data.amount, is_partial: data.is_partial,
      currency: data.currency, status: data.status, metadata: data.metadata,
      product_cart: data.product_cart, subscription_id: data.subscription_id,
    },
  };
}

export async function proOrderForEvent(client: PoolClient, event: ProWebhookEvent): Promise<string | null> {
  const direct = uuid(metadata(event.data).foundertrail_pro_order_id);
  if (direct) return direct;
  const paymentId = typeof event.data.payment_id === "string" ? event.data.payment_id : null;
  if (!paymentId) return null;
  const found = await client.query<{ id: string }>(`SELECT id::text FROM pro_launch_orders WHERE dodo_payment_id=$1`, [paymentId]);
  return found.rows[0]?.id ?? null;
}

export async function processProDodoEvent(client: PoolClient, event: ProWebhookEvent): Promise<"processed" | "ignored"> {
  if (event.business_id !== config.dodoPayments.businessId) throw new Error("DODO_BUSINESS_MISMATCH");
  const orderId = await proOrderForEvent(client, event);
  if (!orderId) return "ignored";
  const result = await client.query<{
    id: string; product_id: string; provider_environment: ProEnvironment; quoted_price_minor: number;
    intro_slot: number | null; reservation_expires_at: Date | null; status: string;
    dodo_checkout_session_id: string | null; dodo_payment_id: string | null;
    paid_total_minor: number | null; refunded_total_minor: number;
  }>(
    `SELECT id::text,product_id::text,provider_environment,quoted_price_minor,intro_slot,reservation_expires_at,status,
            dodo_checkout_session_id,dodo_payment_id,paid_total_minor,refunded_total_minor
       FROM pro_launch_orders WHERE id=$1::uuid FOR UPDATE`,
    [orderId],
  );
  const order = result.rows[0];
  if (!order) return "ignored";
  const eventMetadata = metadata(event.data);
  if (order.provider_environment !== config.dodoPayments.environment
    || (eventMetadata.foundertrail_environment
      && eventMetadata.foundertrail_environment !== order.provider_environment)) {
    throw new Error("DODO_ENVIRONMENT_MISMATCH");
  }

  const eventPaymentId = typeof event.data.payment_id === "string" ? event.data.payment_id : null;
  if (eventPaymentId && order.dodo_payment_id && eventPaymentId !== order.dodo_payment_id) {
    throw new Error("DODO_PAYMENT_MISMATCH");
  }

  if (event.type.startsWith("payment.")) {
    const paymentId = eventPaymentId;
    const checkoutSessionId = typeof event.data.checkout_session_id === "string" ? event.data.checkout_session_id : null;
    if (checkoutSessionId && checkoutSessionId !== order.dodo_checkout_session_id) throw new Error("DODO_SESSION_MISMATCH");
    if (event.type === "payment.succeeded") {
      if (["refunded","refund_pending","payment_conflict"].includes(order.status)) return "processed";
      const cart = Array.isArray(event.data.product_cart) ? event.data.product_cart as Array<Record<string, unknown>> : [];
      const expectedProduct = order.quoted_price_minor === PRO_INTRO_PRICE_MINOR
        ? config.dodoPayments.proIntroProductId : config.dodoPayments.proStandardProductId;
      const tax = typeof event.data.tax === "number" ? event.data.tax : 0;
      const total = typeof event.data.total_amount === "number" ? event.data.total_amount : -1;
      const productOk = cart.length === 1 && cart[0]?.product_id === expectedProduct && cart[0]?.quantity === 1;
      if (!paymentId || !expectedProduct || !productOk || event.data.currency !== PRO_CURRENCY
        || total - tax !== order.quoted_price_minor || event.data.subscription_id) throw new Error("DODO_ORDER_MISMATCH");

      if (order.quoted_price_minor === PRO_INTRO_PRICE_MINOR && order.intro_slot === null) {
        await client.query("SELECT pg_advisory_xact_lock($1)", [PRO_INVENTORY_LOCK]);
        const used = await client.query<{ intro_slot: number }>(
          `SELECT intro_slot FROM pro_launch_orders WHERE provider_environment=$1 AND intro_slot IS NOT NULL ORDER BY intro_slot`,
          [order.provider_environment],
        );
        const restoredSlot = nextIntroSlot(used.rows.map((row) => row.intro_slot));
        if (restoredSlot === null) {
          await client.query(
            `UPDATE pro_launch_orders SET status='payment_conflict',dodo_payment_id=$2,paid_total_minor=$3,paid_tax_minor=$4,paid_at=coalesce(paid_at,now()),updated_at=now() WHERE id=$1::uuid`,
            [order.id, paymentId, total, tax],
          );
          await client.query(
            `INSERT INTO notification_jobs(job_type,dedupe_key,payload) VALUES('pro_refund',$1,jsonb_build_object('orderId',$2::text,'reason','Intro payment completed after its released hold was reallocated')) ON CONFLICT(dedupe_key) DO NOTHING`,
            [`pro-refund:${paymentId}`, order.id],
          );
          return "processed";
        }
        await client.query(`UPDATE pro_launch_orders SET intro_slot=$2 WHERE id=$1::uuid`, [order.id, restoredSlot]);
      }
      await client.query(
        `UPDATE pro_launch_orders SET status='paid',dodo_payment_id=$2,paid_total_minor=$3,paid_tax_minor=$4,
          paid_at=coalesce(paid_at,now()),reservation_expires_at=NULL,checkout_url=NULL,updated_at=now() WHERE id=$1::uuid`,
        [order.id, paymentId, total, tax],
      );
      await activatePurchasedPro(client, order.product_id, order.id);
      return "processed";
    }
    if (event.type === "payment.processing" && ["held","checkout_created"].includes(order.status)) {
      await client.query(`UPDATE pro_launch_orders SET status='processing',dodo_payment_id=coalesce(dodo_payment_id,$2),updated_at=now() WHERE id=$1::uuid`, [order.id, paymentId]);
      return "processed";
    }
    if ((event.type === "payment.failed" || event.type === "payment.cancelled") && ["held","checkout_created","processing"].includes(order.status)) {
      await client.query(`UPDATE pro_launch_orders SET status=$2,intro_slot=NULL,checkout_url=NULL,dodo_payment_id=coalesce(dodo_payment_id,$3),updated_at=now() WHERE id=$1::uuid`, [order.id, event.type === "payment.failed" ? "failed" : "cancelled", paymentId]);
      return "processed";
    }
  }

  if (event.type === "refund.succeeded" || event.type === "refund.failed") {
    const refundId = typeof event.data.refund_id === "string" ? event.data.refund_id : null;
    if (!refundId) throw new Error("DODO_REFUND_ID_MISSING");
    const amount = typeof event.data.amount === "number"
      ? event.data.amount
      : (event.data.is_partial === false ? order.paid_total_minor ?? order.quoted_price_minor : 0);
    if (amount <= 0 || (event.data.currency && event.data.currency !== PRO_CURRENCY)) throw new Error("DODO_REFUND_MISMATCH");
    await client.query(
      `INSERT INTO pro_refunds(order_id,dodo_refund_id,amount_minor,currency,status)
       VALUES($1::uuid,$2,$3,'USD',$4)
       ON CONFLICT(dodo_refund_id) DO UPDATE SET status=excluded.status,updated_at=now()`,
      [order.id, refundId, amount, event.type === "refund.succeeded" ? "succeeded" : "failed"],
    );
    if (event.type === "refund.succeeded") {
      const totals = await client.query<{ total: number }>(`SELECT coalesce(sum(amount_minor),0)::int AS total FROM pro_refunds WHERE order_id=$1::uuid AND status='succeeded'`, [order.id]);
      const refunded = totals.rows[0]?.total ?? 0;
      const full = fullRefundReached({ paidTotalMinor: order.paid_total_minor ?? order.quoted_price_minor, refundedTotalMinor: refunded });
      await client.query(
        `UPDATE pro_launch_orders SET refunded_total_minor=$2,status=$3,refunded_at=CASE WHEN $4 THEN now() ELSE refunded_at END,updated_at=now() WHERE id=$1::uuid`,
        [order.id, refunded, full ? "refunded" : "partially_refunded", full],
      );
      if (full) await setEntitlement(client, { productId: order.product_id, orderId: order.id, status: "revoked", action: "revoked", actorKind: "provider", reason: "Dodo payment fully refunded" });
    }
    return "processed";
  }

  if (event.type.startsWith("dispute.")) {
    const currentEntitlement = await client.query<{ status: ProEntitlementStatus }>(`SELECT status FROM pro_entitlements WHERE product_id=$1::uuid FOR UPDATE`, [order.product_id]);
    const transition = disputeTransition({ orderStatus: order.status, entitlementStatus: currentEntitlement.rows[0]?.status ?? null, disputeState: null }, event.type);
    await client.query(`UPDATE pro_launch_orders SET status=$2,dispute_state=$3,updated_at=now() WHERE id=$1::uuid`, [order.id, transition.orderStatus, transition.disputeState]);
    if (transition.entitlementStatus && transition.entitlementStatus !== currentEntitlement.rows[0]?.status) {
      const action = transition.entitlementStatus === "active" ? "restored" : transition.entitlementStatus === "suspended" ? "suspended" : "revoked";
      await setEntitlement(client, { productId: order.product_id, orderId: order.id, status: transition.entitlementStatus, action, actorKind: "provider", reason: `Dodo ${event.type}` });
    }
    return "processed";
  }
  return "ignored";
}

export function productIdForProProduct(priceMinor: number): string {
  return priceMinor === PRO_INTRO_PRICE_MINOR
    ? config.dodoPayments.proIntroProductId
    : config.dodoPayments.proStandardProductId;
}
