import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { config, isDodoConfigured, sponsorTier } from "@/lib/config";
import { allocateSponsorSlot } from "@/lib/sponsorship";
import { faultBody, reportServerError } from "@/lib/observability";
import { query, withTransaction } from "@/lib/db";
import { getDodoClient } from "@/lib/dodo";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isDodoConfigured()) return NextResponse.json({ error: "Sponsorship booking is not available yet." }, { status: 503 });
  const body = await request.json().catch(() => null) as { productId?: unknown; startAt?: unknown; durationDays?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const startAt = typeof body?.startAt === "string" ? new Date(body.startAt) : new Date(Number.NaN);
  const earliest = Date.now() + config.sponsorship.minimumLeadMinutes * 60_000;
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !Number.isFinite(startAt.getTime()) || startAt.getTime() < earliest || startAt.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: `Choose a start at least ${config.sponsorship.minimumLeadMinutes} minutes from now and within one year.` }, { status: 400 });
  }
  const tier = sponsorTier(Number(body?.durationDays));
  if (!tier) return NextResponse.json({ error: "Choose one of the available placement lengths." }, { status: 400 });
  const endAt = new Date(startAt.getTime() + tier.days * 24 * 60 * 60 * 1000);
  const holdExpiresAt = new Date(Date.now() + config.sponsorship.holdMinutes * 60_000);
  let booking: { id: string; slug: string; name: string; tagline: string; website_url: string };
  try {
    booking = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "sponsor-booking", keyHash: eventHash("sponsor-booking:user", user.id), limit: 5, windowSeconds: 3600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      await client.query(`UPDATE sponsor_bookings SET booking_status='expired_hold',payment_status='cancelled',updated_at=now() WHERE booking_status='held' AND payment_status IN ('pending','processing') AND hold_expires_at<=now()`);
      const products = await client.query<{ id: string; slug: string; name: string; tagline: string; website_url: string }>(
        `SELECT p.id::text,p.slug,p.name,p.tagline,p.website_url FROM products p
          WHERE p.id=$1::uuid AND p.status='published' AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2) FOR UPDATE`,
        [productId, user.id],
      );
      const product = products.rows[0];
      if (!product) throw new Error("NOT_ALLOWED");
      const slot = await allocateSponsorSlot(client, startAt, endAt);
      if (slot === null) throw new Error("SOLD_OUT");
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO sponsor_bookings(product_id,purchaser_id,start_at,end_at,hold_expires_at,slot_index,duration_days,price_minor,currency,creative_name,creative_tagline,destination_url,provider_environment)
         VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id::text`,
        [product.id, user.id, startAt, endAt, holdExpiresAt, slot, tier.days, tier.priceMinor, config.sponsorship.currency, product.name, product.tagline, product.website_url, config.dodoPayments.environment],
      );
      return { ...product, id: inserted.rows[0].id };
    });
  } catch (error) {
    const code = error as { code?: string; message?: string };
    if (code.message === "RATE_LIMITED") return NextResponse.json({ error: "Too many booking attempts. Try again later." }, { status: 429 });
    if (code.message === "NOT_ALLOWED") return NextResponse.json({ error: "Only a verified owner of an approved public startup can book this placement." }, { status: 403 });
    if (code.message === "SOLD_OUT" || code.code === "23P01") {
      return NextResponse.json({ error: `All ${config.sponsorship.slots} placements are taken for that period. Choose another start date.` }, { status: 409 });
    }
    const correlationId = reportServerError("sponsor.hold", error, { productId, durationDays: tier.days });
    return NextResponse.json(faultBody("Could not hold that sponsorship period.", correlationId), { status: 500 });
  }
  try {
    const session = await getDodoClient().checkoutSessions.create({
      product_cart: [{ product_id: tier.productId, quantity: 1 }],
      billing_currency: config.sponsorship.currency,
      customer: { email: user.email, name: user.name },
      return_url: `${config.siteUrl}/promote/${encodeURIComponent(booking.slug)}?booking=${booking.id}`,
      cancel_url: `${config.siteUrl}/promote/${encodeURIComponent(booking.slug)}?booking=${booking.id}&cancelled=1`,
      metadata: { foundertrail_booking_id: booking.id, foundertrail_product_id: productId, foundertrail_environment: config.dodoPayments.environment },
      feature_flags: { allow_currency_selection: false, allow_discount_code: false, redirect_immediately: true },
      customization: { show_order_details: true, theme: "light" },
    }, { idempotencyKey: `foundertrail-sponsor-${booking.id}` });
    if (!session.checkout_url) throw new Error("CHECKOUT_URL_MISSING");
    await query(`UPDATE sponsor_bookings SET dodo_checkout_session_id=$2,dodo_payment_id=coalesce($3,dodo_payment_id),updated_at=now() WHERE id=$1::uuid`, [booking.id, session.session_id, session.payment_id ?? null]);
    return NextResponse.json({ bookingId: booking.id, checkoutUrl: session.checkout_url, holdExpiresAt: holdExpiresAt.toISOString(), startAt: startAt.toISOString(), endAt: endAt.toISOString() }, { status: 201 });
  } catch (error) {
    await query(`UPDATE sponsor_bookings SET booking_status='failed',payment_status='failed',updated_at=now() WHERE id=$1::uuid AND payment_status='pending'`, [booking.id]).catch(() => {});
    console.error("Dodo checkout creation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "The payment provider could not open checkout. Your slot was released." }, { status: 502 });
  }
}
