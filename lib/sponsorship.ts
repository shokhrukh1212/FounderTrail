import "server-only";
import type DodoPayments from "dodopayments";
import type { PoolClient } from "pg";
import { config } from "./config";

export const SPONSOR_BOOKING_STATUSES = ["held","scheduled","active","completed","expired_hold","cancelled","refund_pending","refunded","payment_conflict","failed"] as const;

type PaymentEvent = {
  business_id: string;
  timestamp: string;
  type: "payment.succeeded" | "payment.processing" | "payment.failed" | "payment.cancelled";
  data: DodoPayments.Payment;
};
type RefundEvent = {
  business_id: string;
  timestamp: string;
  type: "refund.succeeded" | "refund.failed";
  data: DodoPayments.Refund;
};

function isRefundEvent(event: PaymentEvent | RefundEvent): event is RefundEvent {
  return event.type === "refund.succeeded" || event.type === "refund.failed";
}

export function minimalDodoEvent(event: PaymentEvent | RefundEvent): Record<string, unknown> {
  if (isRefundEvent(event)) return { type: event.type, business_id: event.business_id, timestamp: event.timestamp,
    data: { refund_id: event.data.refund_id, payment_id: event.data.payment_id, amount: event.data.amount,
      currency: event.data.currency, status: event.data.status, metadata: event.data.metadata },
  };
  return {
    type: event.type, business_id: event.business_id, timestamp: event.timestamp,
    data: { payment_id: event.data.payment_id, checkout_session_id: event.data.checkout_session_id,
      total_amount: event.data.total_amount, tax: event.data.tax, currency: event.data.currency,
      status: event.data.status, metadata: event.data.metadata, product_cart: event.data.product_cart },
  };
}

function metadataBookingId(metadata: Record<string, unknown> | null | undefined): string | null {
  const value = metadata?.foundertrail_booking_id;
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function processDodoEvent(client: PoolClient, event: PaymentEvent | RefundEvent): Promise<"processed" | "ignored"> {
  if (event.business_id !== config.dodoPayments.businessId) throw new Error("DODO_BUSINESS_MISMATCH");
  if (isRefundEvent(event)) {
    const bookingId = metadataBookingId(event.data.metadata) ?? null;
    const found = await client.query<{ id: string }>(
      `SELECT id::text FROM sponsor_bookings WHERE ($1::uuid IS NOT NULL AND id=$1::uuid) OR dodo_payment_id=$2 FOR UPDATE`,
      [bookingId, event.data.payment_id],
    );
    const booking = found.rows[0];
    if (!booking) return "ignored";
    if (event.type === "refund.succeeded") {
      await client.query(`UPDATE sponsor_bookings SET payment_status='refunded',booking_status='refunded',dodo_payment_id=coalesce(dodo_payment_id,$2),dodo_refund_id=$3,refunded_at=now(),updated_at=now() WHERE id=$1::uuid`, [booking.id, event.data.payment_id, event.data.refund_id]);
    } else {
      await client.query(`UPDATE sponsor_bookings SET payment_status='paid',booking_status=CASE WHEN start_at<=now() AND now()<end_at THEN 'active' WHEN now()<start_at THEN 'scheduled' ELSE 'completed' END,updated_at=now() WHERE id=$1::uuid AND payment_status='refund_pending'`, [booking.id]);
    }
    return "processed";
  }

  const bookingId = metadataBookingId(event.data.metadata);
  if (!bookingId) return "ignored";
  const result = await client.query<{ id: string; hold_expires_at: Date | null; start_at: Date; end_at: Date; booking_status: string; payment_status: string }>(
    `SELECT id::text,hold_expires_at,start_at,end_at,booking_status,payment_status FROM sponsor_bookings WHERE id=$1::uuid FOR UPDATE`, [bookingId],
  );
  const booking = result.rows[0];
  if (!booking) return "ignored";
  if (event.data.metadata?.foundertrail_environment !== config.dodoPayments.environment) throw new Error("DODO_ENVIRONMENT_MISMATCH");
  if (event.data.checkout_session_id && event.data.checkout_session_id !== (await client.query<{ dodo_checkout_session_id: string | null }>(`SELECT dodo_checkout_session_id FROM sponsor_bookings WHERE id=$1::uuid`, [booking.id])).rows[0]?.dodo_checkout_session_id) throw new Error("DODO_SESSION_MISMATCH");

  if (event.type === "payment.succeeded") {
    const productOk = event.data.product_cart?.length === 1
      && event.data.product_cart[0]?.product_id === config.dodoPayments.sponsorProductId
      && event.data.product_cart[0]?.quantity === 1;
    const tax = event.data.tax ?? 0;
    if (event.data.total_amount - tax !== config.sponsorship.priceMinor || event.data.currency !== config.sponsorship.currency || !productOk || event.data.subscription_id) throw new Error("DODO_ORDER_MISMATCH");
    if (booking.payment_status === "refunded" || booking.booking_status === "refunded") return "processed";
    if (!booking.hold_expires_at || booking.hold_expires_at.getTime() <= Date.now() || !["held","scheduled"].includes(booking.booking_status)) {
      await client.query(`UPDATE sponsor_bookings SET dodo_payment_id=$2,payment_status='conflict',booking_status='payment_conflict',paid_at=coalesce(paid_at,now()),updated_at=now() WHERE id=$1::uuid`, [booking.id, event.data.payment_id]);
      await client.query(`INSERT INTO notification_jobs(job_type,dedupe_key,payload) VALUES('sponsor_refund',$1,jsonb_build_object('bookingId',$2,'reason','Payment completed after the inventory hold expired')) ON CONFLICT(dedupe_key) DO NOTHING`, [`sponsor-refund:${event.data.payment_id}`, booking.id]);
      return "processed";
    }
    const status = booking.start_at.getTime() <= Date.now() && Date.now() < booking.end_at.getTime() ? "active" : "scheduled";
    await client.query(`UPDATE sponsor_bookings SET dodo_payment_id=$2,payment_status='paid',booking_status=$3,paid_at=coalesce(paid_at,now()),hold_expires_at=NULL,paid_total_minor=$4,paid_tax_minor=$5,updated_at=now() WHERE id=$1::uuid`, [booking.id, event.data.payment_id, status, event.data.total_amount, tax]);
    return "processed";
  }
  if (event.type === "payment.processing") {
    if (booking.payment_status === "pending") await client.query(`UPDATE sponsor_bookings SET payment_status='processing',dodo_payment_id=coalesce(dodo_payment_id,$2),updated_at=now() WHERE id=$1::uuid`, [booking.id, event.data.payment_id]);
    return "processed";
  }
  if (!["paid","refund_pending","refunded"].includes(booking.payment_status)) {
    await client.query(`UPDATE sponsor_bookings SET payment_status=$2,booking_status='failed',dodo_payment_id=coalesce(dodo_payment_id,$3),updated_at=now() WHERE id=$1::uuid`, [booking.id, event.type === "payment.cancelled" ? "cancelled" : "failed", event.data.payment_id]);
  }
  return "processed";
}
