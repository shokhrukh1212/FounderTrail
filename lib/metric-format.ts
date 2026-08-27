import type { MetricSource, ProductMetric } from "./product-data";

export const METRIC_SOURCE_LABELS: Record<MetricSource, string> = {
  verified_live: "Verified live",
  verified_by_bidindex: "Verified by BidIndex",
  publicly_sourced: "Publicly sourced",
  founder_reported: "Founder reported",
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
    current_bid: "current bid",
    highest_bid: "highest bid",
  };
  return `${value} ${label[metric.type]}`;
}
