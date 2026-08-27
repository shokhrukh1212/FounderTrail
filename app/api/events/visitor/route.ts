import { NextResponse } from "next/server";
import { isObviousBot } from "@/lib/click";
import { withTransaction } from "@/lib/db";
import { allowedOrigin } from "@/lib/integration-validation";
import { eventHash, networkHash } from "@/lib/request-security";
import { consumeRateLimit } from "@/lib/rate-limit";

function cors(origin: string | null): Record<string, string> {
  if (!origin) return {};
  return { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "86400", vary: "Origin" };
}

export async function OPTIONS(request: Request) { return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) }); }

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const body = await request.json().catch(() => null) as { projectId?: unknown; visitorId?: unknown; eventId?: unknown } | null;
  if (typeof body?.projectId !== "string" || typeof body.visitorId !== "string" || body.visitorId.length < 16 || body.visitorId.length > 128) return NextResponse.json({ error: "Invalid visitor event." }, { status: 400, headers: cors(origin) });
  const projectId = body.projectId, visitorId = body.visitorId, suppliedEventId = body.eventId;
  try {
    const result = await withTransaction(async (client) => {
      const rows = await client.query<{ id: string; product_id: string; allowed_domain: string }>(`SELECT id::text,product_id::text,allowed_domain FROM product_integrations WHERE public_id::text=$1 AND domain_status='verified' LIMIT 1`, [projectId]);
      const integration = rows.rows[0];
      if (!integration || !allowedOrigin(origin, integration.allowed_domain)) throw new Error("ORIGIN");
      if (isObviousBot(request)) return { duplicate: true };
      const allowed = await consumeRateLimit(client, { action: "visitor-event", keyHash: networkHash(request, `visitor-event:${integration.id}`), limit: 60, windowSeconds: 60 });
      if (!allowed) throw new Error("RATE");
      const visitorHash = eventHash(`partner-visitor:${integration.id}`, visitorId);
      const eventId = typeof suppliedEventId === "string" && /^[A-Za-z0-9_.:-]{8,120}$/.test(suppliedEventId) ? suppliedEventId : `pv:${new Date().toISOString().slice(0, 10)}:${visitorHash.slice(0, 24)}`;
      const inserted = await client.query(`INSERT INTO product_metric_events (integration_id,product_id,event_id,event_type,visitor_hash,dedupe_bucket,occurred_at) VALUES ($1::uuid,$2::uuid,$3,'pageview',$4,(now() AT TIME ZONE 'UTC')::date,now()) ON CONFLICT DO NOTHING RETURNING id`, [integration.id, integration.product_id, eventId, visitorHash]);
      if (!inserted.rowCount) return { duplicate: true };
      await client.query(`INSERT INTO product_metric_aggregates (product_id,metric_type,source,currency,value,last_event_at) VALUES ($1::uuid,'visitors','verified_live','',1,now()) ON CONFLICT (product_id,metric_type,source,currency) DO UPDATE SET value=product_metric_aggregates.value+1,last_event_at=now(),updated_at=now()`, [integration.product_id]);
      await client.query(`UPDATE product_integrations SET last_event_at=now(),updated_at=now() WHERE id=$1::uuid`, [integration.id]);
      return { duplicate: false };
    });
    return NextResponse.json({ accepted: true, duplicate: result.duplicate }, { status: 202, headers: cors(origin) });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: code === "ORIGIN" ? "Origin is not registered." : code === "RATE" ? "Too many events." : "Could not accept event." }, { status: code === "ORIGIN" ? 403 : code === "RATE" ? 429 : 500, headers: cors(origin) });
  }
}
