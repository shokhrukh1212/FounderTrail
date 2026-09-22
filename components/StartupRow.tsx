import Link from "next/link";
import { ProductLogo } from "./ProductLogo";
import { FollowButton } from "./FollowButton";
import { VoteButton } from "./VoteButton";
import type { StartupCard } from "@/lib/foundertrail-data";

function price(product: StartupCard): string | null {
  if (product.startingPriceMinor !== null && product.pricingCurrency) {
    return `From ${new Intl.NumberFormat("en", { style: "currency", currency: product.pricingCurrency }).format(product.startingPriceMinor / 100)}`;
  }
  const labels: Record<string, string> = { free: "Free", freemium: "Freemium", paid: "Paid", open_source: "Open source", contact: "Contact sales" };
  return product.pricingModel ? labels[product.pricingModel] ?? null : null;
}

export function StartupRow({ product, position, weekly = false }: { product: StartupCard; position?: number; weekly?: boolean }) {
  const pricing = price(product);
  return <article className="startup-row">
    <span className="product-position">{position ? `#${position}` : ""}</span>
    <ProductLogo imageUrl={product.logoUrl} productUrl={product.websiteUrl} productName={product.name} className="product-list-logo" />
    <div className="startup-row-copy">
      <Link href={`/product/${product.slug}`}><h2>{product.name}</h2></Link>
      <p>{product.tagline}</p>
      <div className="startup-meta">
        {product.category ? <span>{product.category.name}</span> : null}
        {pricing ? <span>{pricing}</span> : null}
        <span>{product.outboundClicks.toLocaleString()} outbound click{product.outboundClicks === 1 ? "" : "s"}</span>
        {weekly ? <span>{product.launchVotes.toLocaleString()} this week</span> : null}
      </div>
    </div>
    <div className="startup-actions">
      <VoteButton slug={product.slug} initialCount={product.allTimeUpvotes} initialActive={product.upvoted} />
      <a href={`/go/${product.slug}?source=directory`} target="_blank" rel="ugc noopener noreferrer" className="text-link">Visit website ↗</a>
      <FollowButton slug={product.slug} initialActive={product.followed} />
    </div>
  </article>;
}
