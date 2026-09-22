import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";
import { withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";
import { getDodoClient } from "@/lib/dodo";

export async function GET(request: Request, context: RouteContext<"/api/sponsor/bookings/[bookingId]">) {
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { bookingId } = await context.params;
  const rows = await query<{ id: string; booking_status: string; payment_status: string; start_at: Date; end_at: Date; hold_expires_at: Date | null; price_minor: number; currency: string; impressions: number; clicks: number }>(
    `SELECT b.id::text,
            CASE WHEN b.payment_status='paid' AND b.start_at<=now() AND now()<b.end_at THEN 'active'
                 WHEN b.payment_status='paid' AND now()>=b.end_at THEN 'completed' ELSE b.booking_status END AS booking_status,
            b.payment_status,b.start_at,b.end_at,b.hold_expires_at,b.price_minor,b.currency,
            count(e.*) FILTER(WHERE e.event_type='impression')::int AS impressions,
            count(e.*) FILTER(WHERE e.event_type='outbound_click')::int AS clicks
       FROM sponsor_bookings b LEFT JOIN sponsor_events e ON e.booking_id=b.id
      WHERE b.id=$1::uuid AND (b.purchaser_id=$2 OR EXISTS(SELECT 1 FROM app_users u WHERE u.id=$2 AND u.role='admin'))
      GROUP BY b.id`, [bookingId, user.id],
  ).catch(() => []);
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  return NextResponse.json({ id: row.id, bookingStatus: row.booking_status, paymentStatus: row.payment_status, startAt: row.start_at.toISOString(), endAt: row.end_at.toISOString(), holdExpiresAt: row.hold_expires_at?.toISOString() ?? null, priceMinor: row.price_minor, currency: row.currency, impressions: row.impressions, outboundClicks: row.clicks }, { headers: { "cache-control": "no-store" } });
}

export async function DELETE(request: Request, context: RouteContext<"/api/sponsor/bookings/[bookingId]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { bookingId } = await context.params;
  try {
    const result = await withTransaction(async (client) => {
      const found = await client.query<{ id: string; start_at: Date; end_at: Date; booking_status: string; payment_status: string; dodo_payment_id: string | null }>(
        `SELECT id::text,start_at,end_at,booking_status,payment_status,dodo_payment_id FROM sponsor_bookings b
          WHERE b.id=$1::uuid AND (b.purchaser_id=$2 OR EXISTS(SELECT 1 FROM app_users u WHERE u.id=$2 AND u.role='admin')) FOR UPDATE`, [bookingId, user.id],
      );
      const booking = found.rows[0];
      if (!booking) throw new Error("NOT_FOUND");
      if (["cancelled","refunded","completed"].includes(booking.booking_status)) throw new Error("NOT_CANCELLABLE");
      if (["pending","processing"].includes(booking.payment_status)) {
        await client.query(`UPDATE sponsor_bookings SET booking_status='cancelled',payment_status='cancelled',updated_at=now() WHERE id=$1::uuid`, [booking.id]);
        return { refund: false, paymentId: null };
      }
      if (booking.payment_status === "paid" && booking.start_at.getTime() > Date.now() && booking.dodo_payment_id) {
        await client.query(`UPDATE sponsor_bookings SET booking_status='refund_pending',payment_status='refund_pending',refund_requested_at=now(),updated_at=now() WHERE id=$1::uuid`, [booking.id]);
        await client.query(`INSERT INTO notification_jobs(job_type,dedupe_key,payload)
          VALUES('sponsor_refund',$1,jsonb_build_object('bookingId',$2,'reason','Unstarted booking cancellation'))
          ON CONFLICT(dedupe_key) DO UPDATE SET state=CASE WHEN notification_jobs.state='sent' THEN 'sent' ELSE 'pending' END,available_at=now(),last_error=NULL`, [`sponsor-refund:${booking.id}`, booking.id]);
        return { refund: true, paymentId: booking.dodo_payment_id };
      }
      if (booking.payment_status === "paid" && booking.start_at.getTime() <= Date.now() && Date.now() < booking.end_at.getTime()) {
        await client.query(`UPDATE sponsor_bookings SET booking_status='cancelled',updated_at=now() WHERE id=$1::uuid`, [booking.id]);
        return { refund: false, paymentId: null };
      }
      throw new Error("NOT_CANCELLABLE");
    });
    if (!result.refund || !result.paymentId) return NextResponse.json({ ok: true, status: "cancelled" });
    try {
      const refund = await getDodoClient().refunds.create({ payment_id: result.paymentId, reason: "Unstarted FounderTrail sponsorship cancelled by purchaser", metadata: { foundertrail_booking_id: bookingId } }, { idempotencyKey: `foundertrail-refund-${bookingId}` });
      const succeeded = refund.status === "succeeded";
      await query(`UPDATE sponsor_bookings SET dodo_refund_id=$2,payment_status=$3,booking_status=$4,refunded_at=CASE WHEN $5 THEN now() ELSE refunded_at END,updated_at=now() WHERE id=$1::uuid`, [bookingId, refund.refund_id, succeeded ? "refunded" : "refund_pending", succeeded ? "refunded" : "refund_pending", succeeded]);
      await query(`UPDATE notification_jobs SET state=$2,sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END,available_at=CASE WHEN $2='failed' THEN now()+interval '1 hour' ELSE available_at END,last_error=NULL WHERE dedupe_key=$1`, [`sponsor-refund:${bookingId}`, succeeded ? "sent" : "failed"]);
      return NextResponse.json({ ok: true, status: succeeded ? "refunded" : "refund_pending" });
    } catch (error) {
      await query(`INSERT INTO notification_jobs(job_type,dedupe_key,payload,state,last_error) VALUES('sponsor_refund',$1,jsonb_build_object('bookingId',$2,'reason','Unstarted booking cancellation'),'failed',$3) ON CONFLICT(dedupe_key) DO UPDATE SET state='failed',last_error=excluded.last_error,available_at=now()`, [`sponsor-refund:${bookingId}`, bookingId, error instanceof Error ? error.message.slice(0,500) : "provider error"]);
      return NextResponse.json({ ok: true, status: "refund_pending", message: "Cancellation recorded; the provider refund will be retried." }, { status: 202 });
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    if (code === "NOT_CANCELLABLE") return NextResponse.json({ error: "This booking cannot be cancelled automatically." }, { status: 409 });
    console.error("sponsor cancellation failed", code || "unknown");
    return NextResponse.json({ error: "Could not cancel this booking." }, { status: 500 });
  }
}
