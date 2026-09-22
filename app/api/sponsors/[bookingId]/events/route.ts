import { NextResponse } from "next/server";

import { BIDINDEX_VISITOR_COOKIE, bidIndexVisitorCookieOptions, ensureBidIndexVisitor } from "@/lib/bidindex-visitor";
import { isObviousBot } from "@/lib/click";
import { query } from "@/lib/db";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/sponsors/[bookingId]/events">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { bookingId } = await context.params;
  const body = await request.json().catch(() => null) as { pageViewId?: unknown; eventType?: unknown; placement?: unknown } | null;
  if (typeof body?.pageViewId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.pageViewId) || body.eventType !== "impression" || typeof body.placement !== "string" || !["this_week_desktop","this_week_mobile","discover_desktop","discover_mobile"].includes(body.placement)) return NextResponse.json({ error: "Invalid event." }, { status: 400 });
  const visitor = ensureBidIndexVisitor(request);
  if (!isObviousBot(request)) await query(`INSERT INTO sponsor_events(booking_id,page_view_id,visitor_hash,event_type,placement) SELECT id,$2::uuid,$3,'impression',$4 FROM sponsor_bookings WHERE id=$1::uuid AND payment_status IN ('paid','complimentary') AND start_at<=now() AND now()<end_at AND booking_status IN ('scheduled','active') ON CONFLICT DO NOTHING`, [bookingId, body.pageViewId, eventHash("sponsor:visitor", visitor.id), body.placement]);
  const response = NextResponse.json({ ok: true });
  if (visitor.isNew) response.cookies.set(BIDINDEX_VISITOR_COOKIE, visitor.id, bidIndexVisitorCookieOptions);
  return response;
}
