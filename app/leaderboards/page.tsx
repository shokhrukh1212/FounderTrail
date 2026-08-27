import type { Metadata } from "next";
import Link from "next/link";
import { ProductRow } from "@/components/ProductRow";
import { formatCompactNumber, formatMinorUnits, METRIC_SOURCE_LABELS } from "@/lib/metric-format";
import { getMetricLeaderboard, type MetricType } from "@/lib/product-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Leaderboards" };

const options = [
  { key: "upvotes", label: "Most upvoted" },
  { key: "revenue", label: "Revenue" },
  { key: "visitors", label: "Visitors" },
  { key: "outbound_clicks", label: "Clicks" },
] as const;

export default async function Leaderboards({ searchParams }: {
  searchParams: Promise<{ metric?: string; currency?: string }>;
}) {
  const params = await searchParams;
  const selected = options.some((option) => option.key === params.metric) ? params.metric! : "upvotes";
  const currency = /^[A-Za-z]{3}$/.test(params.currency ?? "") ? params.currency!.toUpperCase() : "USD";
  const products = await getMetricLeaderboard({
    metric: selected as MetricType | "upvotes",
    currency: selected === "revenue" ? currency : undefined,
  });
  return (
    <main className="app-shell inner-page">
      <header className="page-heading">
        <p className="eyebrow">Transparent rankings</p>
        <h1>Leaderboards</h1>
        <p>Organic community signals and source-qualified metrics. Payments never improve these positions.</p>
      </header>
      <nav className="filter-tabs leaderboard-tabs" aria-label="Leaderboard metric">
        {options.map((option) => <Link key={option.key} className={selected === option.key ? "is-active" : ""} href={`/leaderboards?metric=${option.key}${option.key === "revenue" ? `&currency=${currency}` : ""}`}>{option.label}</Link>)}
      </nav>
      {selected === "revenue" ? (
        <form className="currency-filter" action="/leaderboards" method="get">
          <input type="hidden" name="metric" value="revenue" />
          <label htmlFor="currency">Currency</label>
          <input id="currency" name="currency" defaultValue={currency} maxLength={3} pattern="[A-Za-z]{3}" />
          <button type="submit">Apply</button>
        </form>
      ) : null}
      <div className="leaderboard-value-heading"><span>Product</span><span>Ranked value</span></div>
      <div className="product-list leaderboard-product-list">
        {products.length ? products.map((product, index) => (
          <div className="leaderboard-row-wrap" key={product.id}>
            <ProductRow product={product} position={index + 1} />
            <div className="leaderboard-value">
              <strong>{selected === "revenue" ? formatMinorUnits(product.leaderboardValue, currency) : formatCompactNumber(product.leaderboardValue)}</strong>
              <span>{product.leaderboardSource === "community" ? "Community upvotes" : METRIC_SOURCE_LABELS[product.leaderboardSource]}</span>
            </div>
          </div>
        )) : <div className="empty-state"><h2>No eligible products</h2><p>No source-qualified values are available for this leaderboard.</p></div>}
      </div>
    </main>
  );
}
