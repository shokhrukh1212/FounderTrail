import Link from "next/link";
import { ProductLogo } from "./ProductLogo";
import { CommentsLink } from "./CommentsLink";
import { FollowButton } from "./FollowButton";
import { VoteButton } from "./VoteButton";
import { categoryFilterHref } from "@/lib/categories";
import type { StartupCard } from "@/lib/foundertrail-data";
import { ProBadge } from "./ProBadge";

/**
 * One product row, shared by the weekly launch list, community favourites and the
 * discovery directory so all three read identically.
 *
 * Clicking anywhere on the row opens the product page, but the row is not one big anchor:
 * the name link is stretched over it in CSS, while the category chips (directory filter)
 * and the vote, comment and follow controls stay separate targets above it. Nesting them
 * inside a row-wide anchor would make them ambiguous for keyboard and screen-reader users.
 */
export function StartupRow({ product, position }: { product: StartupCard; position?: number }) {
  const productHref = `/product/${product.slug}`;
  return <article className="startup-row">
    <span className="product-position">{position ? `#${position}` : ""}</span>
    <Link className="startup-row-logo" href={productHref} tabIndex={-1} aria-hidden="true">
      <ProductLogo imageUrl={product.logoUrl} productUrl={product.websiteUrl} productName={product.name} className="product-list-logo" />
    </Link>
    <div className="startup-row-copy">
      <div className="startup-name-line">
        <Link className="startup-name-link" href={productHref}>
          <h2>{product.name}</h2>
          <span className="startup-name-arrow" aria-hidden="true">→</span>
        </Link>
        {product.isPro ? <ProBadge /> : null}
      </div>
      <p>{product.tagline}</p>
      {product.categories.length ? <div className="startup-meta">
        {product.categories.map((category) => <Link key={category.slug} href={categoryFilterHref(category.slug)}>{category.name}</Link>)}
      </div> : null}
    </div>
    <div className="startup-actions">
      <VoteButton slug={product.slug} initialCount={product.allTimeUpvotes} initialActive={product.upvoted} productName={product.name} />
      <CommentsLink slug={product.slug} productName={product.name} count={product.commentCount} />
      <FollowButton slug={product.slug} initialActive={product.followed} productName={product.name} />
    </div>
  </article>;
}
