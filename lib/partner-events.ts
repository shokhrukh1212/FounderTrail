import "server-only";
import type { PoolClient } from "pg";
import { withTransaction } from "./db";
import { integrationSecretMatches } from "./integration-security";
import { consumeRateLimit } from "./rate-limit";
import { networkHash } from "./request-security";

export const PARTNER_EVENT_TYPES = ["purchase", "refund", "revenue", "bid", "product_click"] as const;
export type PartnerEventType = typeof PARTNER_EVENT_TYPES[number];

export type PartnerEventInput = {
  publicId: string;
  eventId: string;
  type: PartnerEventType;
  occurredAt: Date;
  amountMinor: number | null;
  currency: string | null;
};

type Mode = "add" | "max" | "set";

async function aggregate(client: PoolClient, productId: string, metricType: string, currency: string, value: number, mode: Mode, occurredAt: Date) {
  await client.query(
    `INSERT INTO product_metric_aggregates
       (product_id,metric_type,source,currency,value,last_event_at,last_received_at,measurement_period)
     VALUES ($1::uuid,$2,'partner_connected',$3,$4,$5,now(),'all_time')
     ON CONFLICT (product_id,metric_type,source,currency) DO UPDATE SET
       value=CASE $6 WHEN 'max' THEN GREATEST(product_metric_aggregates.value,EXCLUDED.value)
                     WHEN 'set' THEN EXCLUDED.value
                     ELSE product_metric_aggregates.value+EXCLUDED.value END,
       last_event_at=EXCLUDED.last_event_at,last_received_at=now(),updated_at=now()`,
    [productId, metricType, currency, value, occurredAt, mode]);
}

export async function acceptPartnerEvent(request: Request, event: PartnerEventInput): Promise<{ duplicate: boolean }> {
  const authorization = request.headers.get("authorization") ?? "";
  const secret = /^Bearer ([A-Za-z0-9_-]+)$/.exec(authorization)?.[1] ?? null;
  if (!secret) throw new Error("AUTH_REQUIRED");
  return withTransaction(async (client) => {
    const rows = await client.query<{ id: string; product_id: string; secret_hash: string | null }>(
      `SELECT i.id::text,i.product_id::text,i.secret_hash
         FROM product_integrations i JOIN products p ON p.id=i.product_id
        WHERE i.public_id::text=$1 AND p.status='published' AND ($2::boolean OR NOT p.is_demo) LIMIT 1`,
      [event.publicId, process.env.NODE_ENV !== "production"]);
    const integration = rows.rows[0];
    if (!integration?.secret_hash || !integrationSecretMatches(integration.secret_hash, secret)) throw new Error("INVALID_AUTH");
    const allowed = await consumeRateLimit(client, { action: "partner-event-v1", keyHash: networkHash(request, `partner-event:${integration.id}`), limit: 120, windowSeconds: 60 });
    if (!allowed) throw new Error("RATE");
    const inserted = await client.query(
      `INSERT INTO product_metric_events
         (integration_id,product_id,event_id,event_type,value_minor,currency,occurred_at,source,processing_status)
       VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,'partner_connected','accepted')
       ON CONFLICT (integration_id,event_id) DO NOTHING RETURNING id`,
      [integration.id, integration.product_id, event.eventId, event.type, event.amountMinor, event.currency, event.occurredAt]);
    if (!inserted.rowCount) return { duplicate: true };

    const amount = event.amountMinor ?? 0;
    if (event.type === "purchase") {
      await aggregate(client, integration.product_id, "purchases", "", 1, "add", event.occurredAt);
      await aggregate(client, integration.product_id, "revenue", event.currency!, amount, "add", event.occurredAt);
    } else if (event.type === "refund") {
      await aggregate(client, integration.product_id, "refunds", "", 1, "add", event.occurredAt);
      await aggregate(client, integration.product_id, "revenue", event.currency!, -amount, "add", event.occurredAt);
    } else if (event.type === "revenue") {
      await aggregate(client, integration.product_id, "revenue", event.currency!, amount, "add", event.occurredAt);
    } else if (event.type === "bid") {
      await aggregate(client, integration.product_id, "bids", "", 1, "add", event.occurredAt);
      await aggregate(client, integration.product_id, "highest_bid", event.currency!, amount, "max", event.occurredAt);
      await aggregate(client, integration.product_id, "current_bid", event.currency!, amount, "set", event.occurredAt);
    } else {
      await aggregate(client, integration.product_id, "partner_product_clicks", "", 1, "add", event.occurredAt);
    }
    await client.query(`UPDATE product_integrations SET last_event_at=now(),updated_at=now() WHERE id=$1::uuid`, [integration.id]);
    return { duplicate: false };
  });
}

export function parsePartnerEvent(body: Record<string, unknown> | null, now = Date.now()): PartnerEventInput | null {
  const allowedKeys = new Set(["project_id", "event_id", "type", "occurred_at", "amount_minor", "currency"]);
  if (!body || Object.keys(body).some((key) => !allowedKeys.has(key))) return null;
  const publicId = typeof body?.project_id === "string" ? body.project_id : "";
  const eventId = typeof body?.event_id === "string" ? body.event_id : "";
  const type = typeof body?.type === "string" && (PARTNER_EVENT_TYPES as readonly string[]).includes(body.type) ? body.type as PartnerEventType : null;
  const occurredAt = typeof body?.occurred_at === "string" ? new Date(body.occurred_at) : null;
  if (!/^[0-9a-f-]{36}$/i.test(publicId) || !/^[A-Za-z0-9_.:-]{8,120}$/.test(eventId) || !type || !occurredAt || !Number.isFinite(occurredAt.getTime())) return null;
  if (occurredAt.getTime() < now - 24 * 60 * 60_000 || occurredAt.getTime() > now + 5 * 60_000) return null;
  const monetary = type !== "product_click";
  const amount = body?.amount_minor;
  const currency = typeof body?.currency === "string" ? body.currency.toUpperCase() : "";
  if (monetary && (!Number.isSafeInteger(amount) || (amount as number) < 0 || !/^[A-Z]{3}$/.test(currency))) return null;
  if (!monetary && (amount !== undefined || body?.currency !== undefined)) return null;
  return { publicId, eventId, type, occurredAt, amountMinor: monetary ? amount as number : null, currency: monetary ? currency : null };
}
