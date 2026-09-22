export const PRO_INTRO_LIMIT = 20;
export const PRO_INTRO_PRICE_MINOR = 500;
export const PRO_STANDARD_PRICE_MINOR = 900;
export const PRO_CURRENCY = "USD" as const;
export const PRO_RESERVATION_HOURS = 24;

export type ProEnvironment = "test_mode" | "live_mode";
export type ProEntitlementStatus = "active" | "suspended" | "revoked";

export function priceForAvailability(availableIntroSlots: number): number {
  return availableIntroSlots > 0 ? PRO_INTRO_PRICE_MINOR : PRO_STANDARD_PRICE_MINOR;
}

export function nextIntroSlot(usedSlots: Iterable<number>): number | null {
  const used = new Set(usedSlots);
  for (let slot = 1; slot <= PRO_INTRO_LIMIT; slot += 1) if (!used.has(slot)) return slot;
  return null;
}

export function isAcceptedProPrice(value: unknown): value is 500 | 900 {
  return value === PRO_INTRO_PRICE_MINOR || value === PRO_STANDARD_PRICE_MINOR;
}

export type ProLifecycleState = {
  orderStatus: string;
  entitlementStatus: ProEntitlementStatus | null;
  disputeState: string | null;
};

/** Pure transition policy used by webhook processing and unit tests. */
export function disputeTransition(current: ProLifecycleState, event: string): ProLifecycleState {
  if (current.orderStatus === "refunded" || current.entitlementStatus === "revoked") return current;
  const state = event.replace(/^dispute\./, "");
  if (state === "opened" || state === "challenged") {
    return { orderStatus: "disputed", entitlementStatus: "suspended", disputeState: state };
  }
  if (state === "won" || state === "cancelled") {
    return { orderStatus: "paid", entitlementStatus: "active", disputeState: state };
  }
  if (state === "accepted" || state === "lost" || state === "expired") {
    return { orderStatus: "disputed", entitlementStatus: "revoked", disputeState: state };
  }
  return current;
}

export function fullRefundReached(input: { paidTotalMinor: number; refundedTotalMinor: number }): boolean {
  return input.paidTotalMinor > 0 && input.refundedTotalMinor >= input.paidTotalMinor;
}
