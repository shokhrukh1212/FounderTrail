import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Discussion } from "@/components/Discussion";
import { FollowButton } from "@/components/FollowButton";
import { LocalTime } from "@/components/LocalTime";
import { ProductClaim } from "@/components/ProductClaim";
import { ProductLogo } from "@/components/ProductLogo";
import { XShareLink } from "@/components/XShareLink";
import { VoteButton } from "@/components/VoteButton";
import { currentUserFromHeaders } from "@/lib/auth";
import { config } from "@/lib/config";
import { formatMinorUnits } from "@/lib/metric-format";
import { getProductDetail } from "@/lib/product-data";
import { getProductComments, getProductCommunityState, getPublishedConnectedMetrics, pricingLabel } from "@/lib/product-community";
import { canonicalProductUrl } from "@/lib/product-share";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return { title: "Startup not found", robots: { index: false, follow: false } };
  const canonicalUrl = canonicalProductUrl(config.siteUrl, slug);
  const image = new URL(`/product/${encodeURIComponent(slug)}/opengraph-image`, `${config.siteUrl}/`).toString();
  return {
    title: product.name,
    description: product.tagline,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: product.name, description: product.tagline, type: "website", url: canonicalUrl, images: [{ url: image, width: 1200, height: 630, alt: `${product.name} on ${config.siteName}` }] },
    twitter: { card: "summary_large_image", title: product.name, description: product.tagline, images: [image] },
  };
}

function money(valueMinor: number, currency: string) {
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(valueMinor / 100);
}

function xHandle(value: string | null): string | null {
  const handle = value?.trim().replace(/^@/, "") ?? "";
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

function FounderXLink({ handle }: { handle: string }) {
  return <a className="founder-x-link" href={`https://x.com/${encodeURIComponent(handle)}`} target="_blank" rel="noopener noreferrer nofollow" aria-label={`Open @${handle} on X in a new tab`}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.39L6.48 22H3.36l7.25-8.29L2.96 2H9.36l4.42 5.84L18.9 2Zm-1.1 17.84h1.73L8.42 4.05H6.57L17.8 19.84Z" /></svg>
    <span>@{handle}</span>
  </a>;
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const [product, user] = await Promise.all([getProductDetail(slug), currentUserFromHeaders(await headers()).catch(() => null)]);
  if (!product) notFound();
  const [community, comments, connectedMetrics] = await Promise.all([
    getProductCommunityState(product.id, user?.id ?? null),
    getProductComments(product.id, user?.id ?? null),
    getPublishedConnectedMetrics(product.id),
  ]);
  const screenshots = product.media.filter((item) => item.kind === "screenshot");
  const founderHandle = xHandle(product.founderSocialHandle);
  const pricing = pricingLabel(community);

  return <main>
    <section className="product-masthead"><div className="app-shell product-masthead-inner">
      <ProductLogo productName={product.name} productUrl={product.websiteUrl} imageUrl={product.logoUrl} className="product-detail-logo" eager />
      <div className="product-identity"><div className="product-title-line"><h1>{product.name}</h1>{community.ownershipState === "claimed" ? <span className="verified-product-badge" title="Control of this product has been verified.">✓ Ownership confirmed</span> : null}{product.isDemo ? <span className="demo-label">Demo data</span> : null}</div><p>{product.tagline}</p><div className="product-meta">{product.founderName ? <span>By {product.founderName}</span> : null}{founderHandle ? <FounderXLink handle={founderHandle} /> : null}<span>{pricing}</span>{product.categories[0] ? <span>{product.categories[0].name}</span> : null}</div></div>
      <div className="product-primary-actions"><a className="button button-primary" href={`/go/${product.slug}?source=product_page`} target="_blank" rel="noopener noreferrer">Visit website ↗</a><VoteButton slug={product.slug} initialCount={community.allTimeUpvotes} initialActive={community.upvoted} /><FollowButton slug={product.slug} initialActive={community.followed} initialCount={community.followerCount} />{community.isOwner ? <Link className="button button-secondary" href={`/manage/${product.slug}`}>Manage</Link> : null}<XShareLink siteUrl={config.siteUrl} slug={product.slug} productName={product.name} description={product.tagline} /></div>
    </div></section>

    <nav className="product-subnav" aria-label="Product sections"><div className="app-shell"><a href="#overview">Overview</a>{product.updates.length ? <a href="#updates">Updates</a> : null}<a href="#discussion">Discussion</a>{connectedMetrics.length ? <a href="#metrics">Metrics</a> : null}{community.ownershipState !== "claimed" ? <a href="#claim">Claim</a> : null}</div></nav>

    <div className="app-shell product-detail-layout"><article>
      <section id="overview" className="detail-section"><p className="eyebrow">Overview</p><h2>What {product.name} helps you do</h2><p className="long-copy">{community.useCase || product.description || product.tagline}</p><dl className="product-facts">{community.intendedAudience ? <div><dt>Made for</dt><dd>{community.intendedAudience}</dd></div> : null}{product.founderName || founderHandle ? <div><dt>Founder</dt><dd>{product.founderName ? <span>{product.founderName}</span> : null}{founderHandle ? <FounderXLink handle={founderHandle} /> : null}</dd></div> : null}<div><dt>Pricing</dt><dd>{pricing}</dd></div>{product.categories[0] ? <div><dt>Category</dt><dd>{product.categories[0].name}</dd></div> : null}<div><dt>All-time upvotes</dt><dd>{community.allTimeUpvotes.toLocaleString()}</dd></div><div><dt>Outbound clicks</dt><dd>{community.outboundClicks.toLocaleString()} clicks on this startup&apos;s website link</dd></div><div><dt>Listed since</dt><dd><LocalTime value={product.launchAt.toISOString()} dateOnly /></dd></div><div><dt>Official website</dt><dd><a href={`/go/${product.slug}?source=product_page`} target="_blank" rel="noopener noreferrer">{new URL(product.websiteUrl).hostname}</a></dd></div></dl>{product.description && product.description !== community.useCase ? <div className="product-description"><h3>About the product</h3><p className="long-copy">{product.description}</p></div> : null}</section>

      {screenshots.length ? <section className="media-gallery" aria-label="Product screenshots">{screenshots.map((item) => <figure key={item.id}><Image src={item.url} alt={item.altText || `${product.name} screenshot`} width={960} height={600} unoptimized /></figure>)}</section> : null}

      {product.updates.length ? <section id="updates" className="detail-section"><p className="eyebrow">Founder updates</p><h2>What’s new</h2><div className="update-timeline">{product.updates.map((update) => <article key={update.id}><div><span>{update.type}</span><LocalTime value={update.publishedAt.toISOString()} dateOnly /></div><h3>{update.title}</h3><p>{update.body}</p>{update.linkUrl ? <a href={update.linkUrl} rel="nofollow noopener noreferrer" target="_blank">Read more ↗</a> : null}</article>)}</div></section> : null}

      <section id="discussion" className="detail-section"><p className="eyebrow">Discussion</p><h2>Questions and feedback</h2><Discussion slug={product.slug} initialComments={comments} signedIn={Boolean(user)} /></section>

      {connectedMetrics.length ? <section id="metrics" className="detail-section"><p className="eyebrow">Optional connected metrics</p><h2>Shared by the founder</h2><div className="metric-card-grid">{connectedMetrics.map((metric) => <div className="metric-card" key={`${metric.type}-${metric.currency}`}><span>{metric.type === "mrr" ? "Current MRR" : "Collected revenue · trailing 30 days"}</span><strong>{money(metric.valueMinor, metric.currency)}</strong><small>Stripe · {metric.currency} · {metric.type === "mrr" ? "monthly-normalised eligible recurring subscriptions" : "charges collected, net of recorded refunds; tax excluded"}</small><small>{metric.stale ? "Stale · " : "Refreshed "}<LocalTime value={metric.refreshedAt.toISOString()} /></small></div>)}</div><p className="metric-disclosure">Revenue connected means the values came from the founder’s selected Stripe scope. It is not an audit of profit, product quality, or the whole business.</p></section> : null}

      <ProductClaim slug={product.slug} signedIn={Boolean(user)} state={community.ownershipState} />
    </article>

    <aside className="product-side-note">{community.launch ? <div><strong>{community.launch.active ? "Launching this week" : "Launch record"}</strong><p>{community.launch.startsAt.toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric" })}–{community.launch.endsAt.toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })} UTC · {community.launch.votes} this week&apos;s vote{community.launch.votes === 1 ? "" : "s"}</p><small>A first upvote cast during the live week counts here and in all-time support. Earlier support does not.</small></div> : null}<div><strong>{community.allTimeUpvotes.toLocaleString()} all-time upvote{community.allTimeUpvotes === 1 ? "" : "s"}</strong><p>Includes preserved historical support and active authenticated upvotes without double-counting launch votes.</p></div><div><strong>{community.outboundClicks.toLocaleString()} outbound click{community.outboundClicks === 1 ? "" : "s"}</strong><p>Clicks on the startup&apos;s website link; not unique customers or confirmed visits.</p></div><div><strong>{community.followerCount} follower{community.followerCount === 1 ? "" : "s"}</strong><p>Followers can find this startup’s published progress in their Following feed.</p></div>{product.biddingMechanism || product.minimumBidMinor !== null || product.currentBidMinor !== null ? <details className="legacy-details"><summary>Historical bidding details</summary><dl>{product.biddingMechanism ? <div><dt>Mechanism</dt><dd>{product.biddingMechanism}</dd></div> : null}{product.minimumBidMinor !== null && product.bidCurrency ? <div><dt>Minimum bid</dt><dd>{formatMinorUnits(product.minimumBidMinor, product.bidCurrency)}</dd></div> : null}{product.currentBidMinor !== null && product.bidCurrency ? <div><dt>Last recorded bid</dt><dd>{formatMinorUnits(product.currentBidMinor, product.bidCurrency)}</dd></div> : null}</dl></details> : null}</aside>
    </div>
  </main>;
}
