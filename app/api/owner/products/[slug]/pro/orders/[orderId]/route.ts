import { NextResponse } from "next/server";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(request: Request, context: RouteContext<"/api/owner/products/[slug]/pro/orders/[orderId]">) {
  const user = await currentUserFromHeaders(request.headers).catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug, orderId } = await context.params;
  const rows = await query<{
    id: string; name: string; status: string; quoted_price_minor: number; currency: string;
    reservation_expires_at: Date | null; entitlement_status: string | null; checkout_url: string | null; purchaser_id: string;
  }>(
    `SELECT o.id::text,p.name,o.status,o.quoted_price_minor,o.currency,o.reservation_expires_at,e.status AS entitlement_status,o.checkout_url,o.purchaser_id
       FROM pro_launch_orders o JOIN products p ON p.id=o.product_id
       LEFT JOIN pro_entitlements e ON e.product_id=p.id
      WHERE o.id=$1::uuid AND p.slug=$2
        AND (o.purchaser_id=$3 OR EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$3)
          OR EXISTS(SELECT 1 FROM app_users u WHERE u.id=$3 AND u.role='admin'))`,
    [orderId, slug, user.id],
  ).catch(() => []);
  const row = rows[0];
  if (!row) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({
    id: row.id, startupName: row.name, orderStatus: row.status, entitlementStatus: row.entitlement_status,
    priceMinor: row.quoted_price_minor, currency: row.currency,
    reservationExpiresAt: row.reservation_expires_at?.toISOString() ?? null,
    checkoutUrl: row.purchaser_id === user.id && row.status === "checkout_created" && row.reservation_expires_at && row.reservation_expires_at > new Date() ? row.checkout_url : null,
  }, { headers: { "cache-control": "no-store" } });
}
