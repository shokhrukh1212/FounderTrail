import { NextResponse } from "next/server";

import { isObviousBot } from "@/lib/click";
import { withTransaction } from "@/lib/db";
import { allowedOrigin, validEventId, validPublicHostname } from "@/lib/integration-validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { dailyVisitorHash, networkHash } from "@/lib/request-security";

type TrafficType = "pageview" | "badge_impression";
type TrafficBody = { projectId?: unknown; eventId?: unknown; eventType?: unknown; referrerDomain?: unknown };

function cors(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "Origin" };
}

function referrerDomain(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 253) return null;
  const host = value.toLowerCase().replace(/^www\./, "");
  return validPublicHostname(host) ? host : null;
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return NextResponse.json({ error: "Use application/json." }, { status: 415, headers: cors(origin) });
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > 8_192) return NextResponse.json({ error: "Event is too large." }, { status: 413, headers: cors(origin) });
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 8_192) return NextResponse.json({ error: "Event is too large." }, { status: 413, headers: cors(origin) });
  let body: TrafficBody | null = null;
  try { body = JSON.parse(rawBody) as TrafficBody; } catch { /* Invalid JSON is handled below. */ }
  const projectId = typeof body?.projectId === "string" ? body.projectId : "";
  const eventId = body?.eventId;
  const eventType: TrafficType | null = body?.eventType === "pageview" || body?.eventType === "badge_impression" ? body.eventType : null;
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !validEventId(eventId) || !eventType) return NextResponse.json({ error: "Invalid traffic event." }, { status: 400, headers: cors(origin) });

  try {
    const result = await withTransaction(async (client) => {
      const rows = await client.query<{ id: string; product_id: string; allowed_domain: string }>(
        `SELECT i.id::text,i.product_id::text,i.allowed_domain
           FROM product_integrations i JOIN products p ON p.id=i.product_id
          WHERE i.public_id::text=$1 AND i.domain_verified_at IS NOT NULL AND p.status='published'
            AND ($2::boolean OR NOT p.is_demo) LIMIT 1`, [projectId, process.env.NODE_ENV !== "production"]);
      const integration = rows.rows[0];
      if (!integration || !allowedOrigin(origin, integration.allowed_domain)) throw new Error("ORIGIN");
      if (isObviousBot(request)) return { duplicate: true };
      const allowed = await consumeRateLimit(client, { action: "visitor-event", keyHash: networkHash(request, `visitor-event:${integration.id}`), limit: 90, windowSeconds: 60 });
      if (!allowed) throw new Error("RATE");
      const inserted = await client.query(
        `INSERT INTO product_traffic_event_ids (integration_id,event_id,event_type)
         VALUES ($1::uuid,$2,$3) ON CONFLICT DO NOTHING RETURNING event_id`, [integration.id, eventId, eventType]);
      if (!inserted.rowCount) return { duplicate: true };

      const metricDate = new Date().toISOString().slice(0, 10);
      let uniqueIncrement = 0;
      if (eventType === "pageview") {
        const visitorHash = dailyVisitorHash(request, projectId, metricDate);
        const unique = await client.query(
          `INSERT INTO product_daily_visitors (integration_id,product_id,metric_date,visitor_hash)
           VALUES ($1::uuid,$2::uuid,$3::date,$4) ON CONFLICT DO NOTHING RETURNING visitor_hash`, [integration.id, integration.product_id, metricDate, visitorHash]);
        uniqueIncrement = unique.rowCount ?? 0;
      }
      await client.query(
        `INSERT INTO product_traffic_daily (product_id,metric_date,pageviews,daily_uniques,badge_impressions)
         VALUES ($1::uuid,$2::date,$3,$4,$5)
         ON CONFLICT (product_id,metric_date) DO UPDATE SET
           pageviews=product_traffic_daily.pageviews+EXCLUDED.pageviews,
           daily_uniques=product_traffic_daily.daily_uniques+EXCLUDED.daily_uniques,
           badge_impressions=product_traffic_daily.badge_impressions+EXCLUDED.badge_impressions,updated_at=now()`,
        [integration.product_id, metricDate, eventType === "pageview" ? 1 : 0, uniqueIncrement, eventType === "badge_impression" ? 1 : 0]);
      const referrer = eventType === "pageview" ? referrerDomain(body?.referrerDomain) : null;
      if (referrer && referrer !== integration.allowed_domain) await client.query(
        `INSERT INTO product_referrer_daily (product_id,metric_date,referring_domain,pageviews)
         VALUES ($1::uuid,$2::date,$3,1)
         ON CONFLICT (product_id,metric_date,referring_domain) DO UPDATE SET pageviews=product_referrer_daily.pageviews+1,updated_at=now()`,
        [integration.product_id, metricDate, referrer]);
      await client.query(
        `UPDATE product_integrations SET
           last_visitor_event_at=CASE WHEN $2='pageview' THEN now() ELSE last_visitor_event_at END,
           badge_last_seen_at=CASE WHEN $2='badge_impression' THEN now() ELSE badge_last_seen_at END,updated_at=now()
         WHERE id=$1::uuid`, [integration.id, eventType]);
      return { duplicate: false };
    });
    return NextResponse.json({ accepted: true, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 202, headers: cors(origin) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "ORIGIN" ? "Origin is not registered." : code === "RATE" ? "Too many events." : "Could not accept event." }, { status: code === "ORIGIN" ? 403 : code === "RATE" ? 429 : 500, headers: cors(origin) });
  }
}
