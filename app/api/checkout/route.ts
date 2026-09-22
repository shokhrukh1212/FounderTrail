import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The paid-ranking checkout is retired. Keep the route as an explicit tombstone so
 * old clients cannot create new Lemon Squeezy advertising orders, while the status
 * route and webhook remain available to reconcile historical orders.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Paid ranking is no longer available. FounderTrail sponsorship uses its separate Dodo Payments booking flow.",
      code: "LEGACY_CHECKOUT_RETIRED",
    },
    {
      status: 410,
      headers: { "cache-control": "no-store" },
    },
  );
}
