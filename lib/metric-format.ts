import type { MetricSource, ProductMetric } from "./product-data";

export type MetricDisplaySource = MetricSource | "unavailable";

export const METRIC_SOURCE_LABELS: Record<MetricDisplaySource, string> = {
  measured_by_bidindex: "Measured by FounderTrail",
  processor_verified: "Processor verified",
  partner_connected: "Partner connected",
  publicly_sourced: "Publicly sourced",
  founder_reported: "Founder reported",
  unavailable: "Unavailable",
};

export const METRIC_SOURCE_EXPLANATIONS: Record<MetricDisplaySource, string> = {
  measured_by_bidindex: "Directly measured by FounderTrail, such as eligible outbound clicks or privacy-conscious badge traffic.",
  processor_verified: "Received from a supported payment processor through an official verified connection.",
  partner_connected: "Sent by the product's authenticated server. The sender is authenticated, but the value is supplied by the partner.",
  publicly_sourced: "Taken from a public page reviewed by a FounderTrail administrator.",
  founder_reported: "Entered by the founder without technical verification.",
  unavailable: "No usable measurement is currently connected.",
};

export const METRIC_PERIOD_LABELS: Record<ProductMetric["measurementPeriod"], string> = {
  all_time: "All time",
  today: "Today",
  last_30_days: "Last 30 days",
};

export function formatMinorUnits(value: number, currency: string): string {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : undefined,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(value / (10 ** digits));
}

export function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10_000 ? 1 : 0,
  }).format(value);
}

export function metricLabel(metric: ProductMetric): string {
  const value = ["revenue", "current_bid", "highest_bid"].includes(metric.type)
    ? formatMinorUnits(metric.value, metric.currency)
    : formatCompactNumber(metric.value);
  const label: Record<ProductMetric["type"], string> = {
    revenue: "revenue",
    visitors: "visitors",
    outbound_clicks: "clicks",
    bids: "bids",
    purchases: "purchases",
    refunds: "refunds",
    current_bid: "current bid",
    highest_bid: "highest bid",
    partner_product_clicks: "product clicks",
  };
  return `${value} ${label[metric.type]}`;
}

export function metricDefinition(type: ProductMetric["type"]): string {
  const definitions: Record<ProductMetric["type"], string> = {
    visitors: "Approximate daily unique visitors measured using a rotating daily hash. Ad blockers, browser restrictions, and bots can affect this estimate.",
    revenue: "Net revenue events in the displayed currency. Different currencies are never combined.",
    outbound_clicks: "Eligible unique visits sent from FounderTrail to the product's approved website.",
    bids: "Authenticated bid events received for this product.",
    purchases: "Authenticated completed purchase events received for this product.",
    refunds: "Authenticated refund events received for this product.",
    current_bid: "The latest authenticated bid amount received in this currency.",
    highest_bid: "The highest authenticated bid amount received in this currency.",
    partner_product_clicks: "Product-click events supplied by the partner; these are separate from FounderTrail outbound clicks.",
  };
  return definitions[type];
}
