import Link from "next/link";
import { ProductLogo } from "./ProductLogo";
import { VoteButton } from "./VoteButton";
import { metricLabel } from "@/lib/metric-format";
import { preferredMetrics, type ProductCardData } from "@/lib/product-data";

export function ProductRow({ product, position, voted = false, showPosition = true }: {
  product: ProductCardData;
  position: number;
  voted?: boolean;
  showPosition?: boolean;
}) {
  const metrics = preferredMetrics(product.metrics);
  return (
    <article className="product-row">
      <Link className="product-row-link" href={`/product/${product.slug}`} aria-label={`View ${product.name}`} />
      {showPosition ? <span className="product-position">{position}</span> : null}
      <ProductLogo imageUrl={product.logoUrl} productUrl={null} productName={product.name} className="product-list-logo" />
      <div className="product-row-copy">
        <div className="product-title-line">
          <h2>{product.name}</h2>
          {product.isDemo ? <span className="demo-label">Demo</span> : null}
          {product.metrics.some((metric) => metric.source === "verified_live" || metric.source === "verified_by_bidindex")
            ? <span className="verified-mark" title="Has at least one technically verified metric">✓</span>
            : null}
        </div>
        <p className="product-tagline">{product.tagline}</p>
        <div className="category-list" aria-label="Categories">
          {product.categories.slice(0, 3).map((category) => <span key={category.slug}>{category.name}</span>)}
        </div>
        <p className="product-metrics">
          {metrics.length ? metrics.map(metricLabel).join(" · ") : "Metrics not available"}
          <span> · {product.updateCount} {product.updateCount === 1 ? "update" : "updates"}</span>
        </p>
      </div>
      <div className="product-row-vote"><VoteButton slug={product.slug} initialCount={product.voteCount} initialActive={voted} /></div>
    </article>
  );
}
