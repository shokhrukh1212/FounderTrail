/**
 * The listed startup's own pricing, entered by its founder or an admin. This has nothing
 * to do with FounderTrail's Free/Pro checkout.
 *
 * Nothing in here infers, scrapes or estimates a price. If a founder has not supplied
 * pricing, the public surface shows no pricing at all rather than "Unknown" or
 * "See website", which would read as a claim about the product.
 */

export const PRICING_MODELS = ["free", "freemium", "paid", "contact"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const PRICING_BASES = ["one_time", "monthly", "yearly", "usage_based"] as const;
export type PricingBasis = (typeof PRICING_BASES)[number];

export const PRICING_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR"] as const;

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
  contact: "Contact sales",
};

export const PRICING_BASIS_LABELS: Record<PricingBasis, string> = {
  one_time: "One-time",
  monthly: "Monthly",
  yearly: "Yearly",
  usage_based: "Usage-based",
};

export type ProductPricing = {
  model: PricingModel | null;
  startingPriceMinor: number | null;
  currency: string | null;
  basis: PricingBasis | null;
  unit: string | null;
  perSeat: boolean;
};

export const EMPTY_PRICING: ProductPricing = {
  model: null, startingPriceMinor: null, currency: null, basis: null, unit: null, perSeat: false,
};

export type PricingInput = {
  pricingModel?: unknown;
  startingPrice?: unknown;
  pricingCurrency?: unknown;
  pricingBasis?: unknown;
  pricingUnit?: unknown;
  pricingPerSeat?: unknown;
};

export type PricingResult = { ok: true; value: ProductPricing } | { ok: false; error: string; field: string };

function raw(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

/**
 * Validate one pricing entry. An amount is optional everywhere; supplying one is what
 * makes a currency and a billing basis required, because "29" on its own is not a price.
 */
export function parsePricingInput(input: PricingInput): PricingResult {
  const model = raw(input.pricingModel);
  if (model && !(PRICING_MODELS as readonly string[]).includes(model)) {
    return { ok: false, error: "Choose Free, Freemium, Paid or Contact sales, or leave pricing blank.", field: "pricingModel" };
  }
  const amountRaw = raw(input.startingPrice);
  if (!model) {
    if (amountRaw) return { ok: false, error: "Choose a pricing model before entering an amount.", field: "pricingModel" };
    return { ok: true, value: { ...EMPTY_PRICING } };
  }
  const pricingModel = model as PricingModel;
  if (!amountRaw) return { ok: true, value: { ...EMPTY_PRICING, model: pricingModel } };

  if (pricingModel !== "freemium" && pricingModel !== "paid") {
    return { ok: false, error: "A starting amount only applies to Freemium or Paid pricing.", field: "startingPrice" };
  }
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(amountRaw)) {
    return { ok: false, error: "Enter the starting amount as a positive number, for example 9 or 29.50.", field: "startingPrice" };
  }
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000) {
    return { ok: false, error: "Enter a starting amount between 0 and 1,000,000.", field: "startingPrice" };
  }
  const currency = raw(input.pricingCurrency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "Choose the currency for the starting amount.", field: "pricingCurrency" };
  const basis = raw(input.pricingBasis);
  if (!(PRICING_BASES as readonly string[]).includes(basis)) {
    return { ok: false, error: "Choose whether the amount is one-time, monthly, yearly or usage-based.", field: "pricingBasis" };
  }
  const unit = raw(input.pricingUnit).slice(0, 60);
  if (basis === "usage_based" && !unit) {
    return { ok: false, error: "Name the billed unit, for example “per 1,000 credits”.", field: "pricingUnit" };
  }
  return { ok: true, value: {
    model: pricingModel,
    startingPriceMinor: Math.round(amount * 100),
    currency,
    basis: basis as PricingBasis,
    unit: basis === "usage_based" ? unit : null,
    perSeat: input.pricingPerSeat === true || input.pricingPerSeat === "on" || input.pricingPerSeat === "true",
  } };
}

function amountLabel(pricing: ProductPricing): string | null {
  if (pricing.startingPriceMinor === null || !pricing.currency || !pricing.basis) return null;
  const major = pricing.startingPriceMinor / 100;
  const amount = new Intl.NumberFormat("en", { maximumFractionDigits: 2, minimumFractionDigits: major % 1 === 0 ? 0 : 2 }).format(major);
  const suffix = pricing.basis === "monthly" ? "/month"
    : pricing.basis === "yearly" ? "/year"
    : pricing.basis === "usage_based" ? ` ${pricing.unit ?? ""}`.trimEnd()
    : " one-time";
  return `${pricing.currency} ${amount}${suffix}${pricing.perSeat ? " per seat" : ""}`;
}

/**
 * The single public pricing string, or null when there is nothing a founder or admin
 * actually supplied. Callers omit the row entirely on null.
 */
export function publicPricingLabel(pricing: ProductPricing | null | undefined): string | null {
  if (!pricing?.model) return null;
  const amount = amountLabel(pricing);
  if (!amount) return PRICING_MODEL_LABELS[pricing.model];
  if (pricing.model === "freemium") return `Freemium · Paid plans from ${amount}`;
  return `Paid · From ${amount}`;
}

/** The value a pricing form should start from, so clearing pricing is always possible. */
export function pricingFormValues(pricing: ProductPricing): {
  pricingModel: string; startingPrice: string; pricingCurrency: string; pricingBasis: string; pricingUnit: string; pricingPerSeat: boolean;
} {
  return {
    pricingModel: pricing.model ?? "",
    startingPrice: pricing.startingPriceMinor === null ? "" : String(pricing.startingPriceMinor / 100),
    pricingCurrency: pricing.currency ?? "USD",
    pricingBasis: pricing.basis ?? "",
    pricingUnit: pricing.unit ?? "",
    pricingPerSeat: pricing.perSeat,
  };
}
