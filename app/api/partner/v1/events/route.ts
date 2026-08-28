import { NextResponse } from "next/server";
import { acceptPartnerEvent, parsePartnerEvent } from "@/lib/partner-events";

function error(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? "")) return error("unsupported_media_type", "Use application/json.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 32_768) return error("payload_too_large", "Event payloads must be 32 KB or smaller.", 413);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 32_768) return error("payload_too_large", "Event payloads must be 32 KB or smaller.", 413);
  let body: Record<string, unknown> | null = null;
  try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { /* Invalid JSON is handled below. */ }
  const event = parsePartnerEvent(body);
  if (!event) return error("invalid_event", "Use a public project ID, unique event_id, supported type, valid UTC occurred_at, and integer minor units with uppercase currency for monetary events.", 400);
  try {
    const result = await acceptPartnerEvent(request, event);
    return NextResponse.json({ accepted: true, duplicate: result.duplicate }, { status: result.duplicate ? 200 : 202, headers: { "cache-control": "no-store" } });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    if (code === "AUTH_REQUIRED") return error("authentication_required", "Send the server secret as a Bearer token.", 401);
    if (code === "INVALID_AUTH") return error("invalid_authentication", "The project ID or server secret is invalid.", 401);
    if (code === "RATE") return error("rate_limited", "Too many events. Retry later.", 429);
    console.error("partner event failed", code || "unknown");
    return error("server_error", "Could not accept the event.", 500);
  }
}
