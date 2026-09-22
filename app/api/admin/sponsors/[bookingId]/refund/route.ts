import { NextResponse } from "next/server";

import { validAdminRequest } from "@/lib/admin-auth";
import { currentUserFromHeaders } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { getDodoClient } from "@/lib/dodo";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/admin/sponsors/[bookingId]/refund">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await validAdminRequest(request))) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const actor = await currentUserFromHeaders(request.headers).catch(() => null);
  const { bookingId } = await context.params;
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (!reason) return NextResponse.json({ error: "Record a refund reason." }, { status: 400 });
  const paymentId = await withTransaction(async (client) => {
    const found = await client.query<{ dodo_payment_id: string | null; payment_status: string }>(`SELECT dodo_payment_id,payment_status FROM sponsor_bookings WHERE id=$1::uuid FOR UPDATE`, [bookingId]);
    const booking = found.rows[0];
    if (!booking?.dodo_payment_id || !["paid","conflict"].includes(booking.payment_status)) return null;
    await client.query(`UPDATE sponsor_bookings SET payment_status='refund_pending',booking_status='refund_pending',refund_requested_at=now(),updated_at=now() WHERE id=$1::uuid`, [bookingId]);
    await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,booking_id,details) VALUES($1,'admin','sponsor.refund.requested',$2::uuid,jsonb_build_object('reason',$3::text))`, [actor?.id ?? null, bookingId, reason]);
    await client.query(`INSERT INTO notification_jobs(job_type,dedupe_key,payload)
      VALUES('sponsor_refund',$1,jsonb_build_object('bookingId',$2::text,'reason',$3::text))
      ON CONFLICT(dedupe_key) DO UPDATE SET state=CASE WHEN notification_jobs.state='sent' THEN 'sent' ELSE 'pending' END,available_at=now(),last_error=NULL`, [`sponsor-refund:${bookingId}`, bookingId, reason]);
    return booking.dodo_payment_id;
  });
  if (!paymentId) return NextResponse.json({ error: "This booking has no refundable paid payment." }, { status: 409 });
  try {
    const refund = await getDodoClient().refunds.create({ payment_id: paymentId, reason, metadata: { foundertrail_booking_id: bookingId } }, { idempotencyKey: `foundertrail-refund-${bookingId}` });
    const succeeded = refund.status === "succeeded";
    await query(`UPDATE sponsor_bookings SET dodo_refund_id=$2,payment_status=$3,booking_status=$4,refunded_at=CASE WHEN $5 THEN now() ELSE refunded_at END,updated_at=now() WHERE id=$1::uuid`, [bookingId, refund.refund_id, succeeded ? "refunded" : "refund_pending", succeeded ? "refunded" : "refund_pending", succeeded]);
    await query(`UPDATE notification_jobs SET state=$2,sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END,available_at=CASE WHEN $2='failed' THEN now()+interval '1 hour' ELSE available_at END,last_error=NULL WHERE dedupe_key=$1`, [`sponsor-refund:${bookingId}`, succeeded ? "sent" : "failed"]);
    return NextResponse.json({ status: succeeded ? "refunded" : "refund_pending" });
  } catch (error) {
    await query(`INSERT INTO notification_jobs(job_type,dedupe_key,payload,state,last_error) VALUES('sponsor_refund',$1,jsonb_build_object('bookingId',$2::text,'reason',$3::text),'failed',$4) ON CONFLICT(dedupe_key) DO UPDATE SET state='failed',last_error=excluded.last_error,available_at=now()`, [`sponsor-refund:${bookingId}`, bookingId, reason, error instanceof Error ? error.message.slice(0,500) : "provider error"]);
    return NextResponse.json({ status: "refund_pending" }, { status: 202 });
  }
}
