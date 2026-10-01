import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { config, isProLaunchConfigured } from "@/lib/config";
import { query, withTransaction } from "@/lib/db";
import { getDodoClient } from "@/lib/dodo";
import { reportServerError } from "@/lib/observability";
import { reserveProOrder, productIdForProProduct } from "@/lib/pro-launch";
import { isAcceptedProPrice } from "@/lib/pro-launch-policy";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";
import { recordFunnelEvent } from "@/lib/analytics";

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/pro/checkout">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers).catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!isProLaunchConfigured()) return NextResponse.json({ error: "Pro checkout is not available yet." }, { status: 503 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { acceptedPriceMinor?: unknown; entryPoint?: unknown } | null;
  if (!isAcceptedProPrice(body?.acceptedPriceMinor)) return NextResponse.json({ error: "Confirm the displayed price before continuing." }, { status: 400 });
  const acceptedPriceMinor = body.acceptedPriceMinor;
  const products = await query<{ id: string }>(`SELECT id::text FROM products WHERE slug=$1 LIMIT 1`, [slug]);
  if (!products[0]) return NextResponse.json({ error: "Startup not found." }, { status: 404 });

  let order;
  try {
    order = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "pro-checkout", keyHash: eventHash("pro-checkout:user", user.id), limit: 8, windowSeconds: 3600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      return reserveProOrder(client, {
        productId: products[0].id, purchaserId: user.id,
        acceptedPriceMinor, environment: config.dodoPayments.environment,
        entryPoint: body?.entryPoint === "submission" ? "submission" : "dashboard",
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("PRICE_CHANGED:")) return NextResponse.json({ error: "The introductory allocation changed. Review and accept the current price.", currentPriceMinor: Number(message.split(":")[1]) }, { status: 409 });
    if (message === "NOT_ELIGIBLE") return NextResponse.json({ error: "Open this startup from its authorized management account before upgrading." }, { status: 403 });
    if (message === "ALREADY_PRO") return NextResponse.json({ error: "This startup is already Pro.", redirectTo: `/manage/${encodeURIComponent(slug)}/launch-kit` }, { status: 409 });
    if (message === "PRO_SUSPENDED") return NextResponse.json({ error: "This startup's Pro access is suspended. Contact support before another purchase." }, { status: 409 });
    if (message === "ORDER_RECONCILING") return NextResponse.json({ error: "A previous checkout is still being confirmed. Please try again shortly." }, { status: 409 });
    if (message === "RATE_LIMITED") return NextResponse.json({ error: "Too many checkout attempts. Try again later." }, { status: 429 });
    const correlationId = reportServerError("pro.checkout.reserve", error, { slug });
    return NextResponse.json({ error: "Could not prepare checkout.", correlationId }, { status: 500 });
  }

  if (order.checkoutUrl) return NextResponse.json({ orderId: order.id, checkoutUrl: order.checkoutUrl, priceMinor: order.priceMinor, currency: "USD", reservationExpiresAt: order.reservationExpiresAt.toISOString(), reused: true });
  try {
    await query(`UPDATE pro_launch_orders SET checkout_requested_at=coalesce(checkout_requested_at,now()) WHERE id=$1::uuid`, [order.id]);
    const providerProductId = productIdForProProduct(order.priceMinor);
    const session = await getDodoClient().checkoutSessions.create({
      product_cart: [{ product_id: providerProductId, quantity: 1 }],
      billing_currency: "USD",
      customer: { email: user.email, name: user.name },
      return_url: `${config.siteUrl}/manage/${encodeURIComponent(order.slug)}/launch?checkout=returned&order=${encodeURIComponent(order.id)}`,
      cancel_url: `${config.siteUrl}/manage/${encodeURIComponent(order.slug)}/launch?checkout=cancelled&order=${encodeURIComponent(order.id)}`,
      metadata: {
        foundertrail_order_type: "pro_launch", foundertrail_pro_order_id: order.id,
        foundertrail_product_id: order.productId, foundertrail_environment: config.dodoPayments.environment,
      },
      feature_flags: { allow_currency_selection: false, allow_discount_code: false, redirect_immediately: true },
      customization: { show_order_details: true, theme: "light" },
    }, { idempotencyKey: `foundertrail-pro-${order.id}` });
    if (!session.checkout_url) throw new Error("CHECKOUT_URL_MISSING");
    await query(
      `UPDATE pro_launch_orders SET status='checkout_created',dodo_checkout_session_id=$2,
       dodo_payment_id=coalesce($3,dodo_payment_id),checkout_url=$4,updated_at=now()
       WHERE id=$1::uuid AND status IN ('held','checkout_created')`,
      [order.id, session.session_id, session.payment_id ?? null, session.checkout_url],
    );
    await recordFunnelEvent({ name: "checkout_started", idempotencyKey: `pro-checkout:${order.id}`, eventData: { product: "pro_launch", entryPoint: body?.entryPoint === "submission" ? "submission" : "dashboard" } }).catch(() => {});
    return NextResponse.json({ orderId: order.id, checkoutUrl: session.checkout_url, priceMinor: order.priceMinor, currency: "USD", reservationExpiresAt: order.reservationExpiresAt.toISOString(), reused: false }, { status: 201 });
  } catch (error) {
    // Once Dodo has created a session, retain the reservation. A retry uses the same
    // idempotency key and can persist that session instead of releasing a potentially
    // payable intro allocation.
    // A timeout can occur after the provider creates the session. Keep the order
    // and its idempotency key so retries cannot create a second payable checkout.
    reportServerError("pro.checkout.provider", error, { orderId: order.id });
    return NextResponse.json({ error: "The payment provider could not open checkout. No upgrade was activated." }, { status: 502 });
  }
}
