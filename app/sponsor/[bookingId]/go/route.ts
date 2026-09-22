import { NextResponse } from "next/server";
import { BIDINDEX_VISITOR_COOKIE, bidIndexVisitorCookieOptions, ensureBidIndexVisitor } from "@/lib/bidindex-visitor";
import { isObviousBot } from "@/lib/click";
import { config } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { publicHttpUrl } from "@/lib/product-validation";
import { eventHash } from "@/lib/request-security";

export async function GET(request: Request, context: RouteContext<"/sponsor/[bookingId]/go">) {
  const { bookingId } = await context.params;
  const visitor = ensureBidIndexVisitor(request);
  const pageViewId = new URL(request.url).searchParams.get("pageViewId");
  const countable = Boolean(pageViewId && /^[0-9a-f-]{36}$/i.test(pageViewId) && !isObviousBot(request));
  const result = await withTransaction(async (client) => {
    const rows = await client.query<{ destination_url: string }>(`SELECT destination_url FROM sponsor_bookings WHERE id=$1::uuid AND payment_status='paid' AND start_at<=now() AND now()<end_at AND booking_status IN ('scheduled','active')`, [bookingId]);
    const destination = rows.rows[0] ? publicHttpUrl(rows.rows[0].destination_url) : null;
    if (!destination?.ok) return null;
    if (countable) await client.query(`INSERT INTO sponsor_events(booking_id,page_view_id,visitor_hash,event_type,placement)
      SELECT se.booking_id,se.page_view_id,se.visitor_hash,'outbound_click',se.placement
        FROM sponsor_events se
       WHERE se.booking_id=$1::uuid AND se.page_view_id=$2::uuid AND se.visitor_hash=$3 AND se.event_type='impression'
      ON CONFLICT DO NOTHING`, [bookingId, pageViewId, eventHash("sponsor:visitor", visitor.id)]);
    return destination.url;
  });
  const response = NextResponse.redirect(result ?? new URL("/", config.siteUrl), 302);
  if (visitor.isNew) response.cookies.set(BIDINDEX_VISITOR_COOKIE, visitor.id, bidIndexVisitorCookieOptions);
  return response;
}
