import { NextResponse } from "next/server";

import { acceptPartnerEvent, parsePartnerEvent } from "@/lib/partner-events";

const LEGACY_TYPES: Record<string, "purchase" | "bid" | "revenue"> = {
  purchase_completed: "purchase",
  bid_completed: "bid",
  revenue_recorded: "revenue",
};

/** Compatibility endpoint. New integrations should use POST /api/partner/v1/events. */
export async function POST(request: Request, context: RouteContext<"/api/integrations/[publicId]/events">) {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return NextResponse.json({ error: { code: "unsupported_media_type", message: "Use application/json." } }, { status: 415 });
  if (Number(request.headers.get("content-length") ?? 0) > 32_768) return NextResponse.json({ error: { code: "payload_too_large", message: "Event payloads must be 32 KB or smaller." } }, { status: 413 });
  const { publicId } = await context.params;
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 32_768) return NextResponse.json({ error: { code: "payload_too_large", message: "Event payloads must be 32 KB or smaller." } }, { status: 413 });
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { /* Invalid JSON is handled below. */ }
  const mapped = body && typeof body.type === "string" ? {
    project_id: publicId,
    event_id: body.eventId,
    type: LEGACY_TYPES[body.type],
    occurred_at: body.occurredAt,
    amount_minor: body.valueMinor,
    currency: body.currency,
  } : null;
  const event = parsePartnerEvent(mapped);
  if (!event) return NextResponse.json({ error: { code: "invalid_event", message: "Use a unique eventId, supported type, non-negative integer valueMinor, currency, and a recent timestamp." } }, { status: 400 });
  try {
    const result = await acceptPartnerEvent(request, event);
    return NextResponse.json({ accepted: true, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 202, headers: { "deprecation": "true", "link": "</api/partner/v1/events>; rel=successor-version" } });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    if (code === "AUTH_REQUIRED" || code === "INVALID_AUTH") return NextResponse.json({ error: { code: "invalid_authentication", message: "The project identifier or secret is invalid." } }, { status: 401 });
    if (code === "RATE") return NextResponse.json({ error: { code: "rate_limited", message: "Too many events." } }, { status: 429 });
    return NextResponse.json({ error: { code: "server_error", message: "Could not accept the event." } }, { status: 500 });
  }
}
