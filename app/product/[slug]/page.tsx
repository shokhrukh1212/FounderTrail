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
import { ProBadge } from "@/components/ProBadge";
import { currentUserFromHeaders } from "@/lib/auth";
import { config } from "@/lib/config";
import { formatMinorUnits } from "@/lib/metric-format";
import { getProductDetail } from "@/lib/product-data";
import { getProductComments, getProductCommunityState } from "@/lib/product-community";
import { publicPricingLabel } from "@/lib/product-pricing";
import { categoryFilterHref } from "@/lib/categories";
import { canonicalProductUrl, productShareImageUrl } from "@/lib/product-share";
import { getProState } from "@/lib/pro-launch";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return { title: "Startup not found", robots: { index: false, follow: false } };
  const canonicalUrl = canonicalProductUrl(config.siteUrl, slug);
  const image = productShareImageUrl(config.siteUrl, slug);
  return {
    title: product.displayName,
    description: product.tagline,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: product.displayName, description: product.tagline, type: "website", url: canonicalUrl, images: [{ url: image, width: 1200, height: 630, alt: `${product.displayName} on ${config.siteName}` }] },
    twitter: { card: "summary_large_image", title: product.displayName, description: product.tagline, images: [image] },
  };
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
  const [community, comments, pro] = await Promise.all([
    getProductCommunityState(product.id, user?.id ?? null),
    getProductComments(product.id, user?.id ?? null),
    getProState(product.id),
  ]);
  const screenshots = product.media.filter((item) => item.kind === "screenshot");
  const founderHandle = xHandle(product.founderSocialHandle);
  // Null when no founder or admin has supplied pricing: the row is then left out entirely
  // rather than printing "Unknown" or "See website", which would read as a claim.
  const pricing = publicPricingLabel(community.pricing);

  return <main>
    <section className="product-masthead"><div className="app-shell product-masthead-inner">
      <ProductLogo productName={product.displayName} productUrl={product.websiteUrl} imageUrl={product.logoUrl} className="product-detail-logo" eager />
      <div className="product-identity"><div className={`product-title-line ${styles.titleLine}`}><h1>{product.displayName}</h1>{pro.status === "active" ? <ProBadge /> : null}{community.ownershipState === "claimed" ? <span className="verified-product-badge" title="Control of this product has been verified.">✓ Ownership confirmed</span> : null}{product.isDemo ? <span className="demo-label">Demo data</span> : null}</div><p>{product.tagline}</p><div className="product-meta">{product.founderName ? <span>By {product.founderName}</span> : null}{founderHandle ? <FounderXLink handle={founderHandle} /> : null}{pricing ? <span>{pricing}</span> : null}{product.categories.map((category) => <Link key={category.slug} href={categoryFilterHref(category.slug)}>{category.name}</Link>)}</div></div>
      <div className={styles.headerActions}>
        <div className={styles.primaryActions}>
          <VoteButton slug={product.slug} productName={product.displayName} initialCount={community.allTimeUpvotes} initialActive={community.upvoted} showLabel />
          <a className="button button-secondary" href={`/go/${product.slug}?source=product_page`} target="_blank" rel="ugc noopener noreferrer">Visit website ↗</a>
        </div>
        <div className={styles.socialActions}>
          <FollowButton slug={product.slug} productName={product.displayName} initialActive={community.followed} initialCount={community.followerCount} />
          <span className={styles.separator} aria-hidden="true" />
          <XShareLink className={styles.shareLink} siteUrl={config.siteUrl} slug={product.slug} productName={product.displayName} />
        </div>
      </div>
    </div></section>

    <div className={styles.toolbar}>
      <div className={`app-shell ${styles.toolbarInner}`}>
        <nav className={styles.sectionLinks} aria-label="Product sections">
          <a href="#overview">Overview</a>
          {product.updates.length ? <a href="#updates">Updates</a> : null}
          <a href="#discussion">Discussion</a>
          {community.ownershipState !== "claimed" ? <a href="#claim">Claim</a> : null}
        </nav>
        {community.isOwner ? <div className={styles.ownerActions} role="group" aria-label="Owner tools">
          <Link className="button button-secondary" href={`/manage/${product.slug}`}>Manage</Link>
          <Link className="button button-secondary" href={`/manage/${product.slug}/launch`}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="4.5" width="14" height="13" rx="2" /><path d="M6.5 2.5v4m7-4v4M3 9h14" /></svg>
            {community.launch ? "Launch details" : "Schedule launch"}
          </Link>
        </div> : null}
      </div>
    </div>

    <div className="app-shell product-detail-layout"><article>
      <section id="overview" className="detail-section"><p className="eyebrow">About</p><h2>Overview</h2><p className="long-copy">{community.useCase || product.description || product.tagline}</p><dl className="product-facts">{community.intendedAudience ? <div><dt>Made for</dt><dd>{community.intendedAudience}</dd></div> : null}{product.founderName || founderHandle ? <div><dt>Founder</dt><dd>{product.founderName ? <span>{product.founderName}</span> : null}{founderHandle ? <FounderXLink handle={founderHandle} /> : null}</dd></div> : null}{pricing ? <div><dt>Pricing</dt><dd>{pricing}</dd></div> : null}{product.categories.length ? <div><dt>{product.categories.length === 1 ? "Category" : "Categories"}</dt><dd className="detail-category-list">{product.categories.map((category) => <Link key={category.slug} href={categoryFilterHref(category.slug)}>{category.name}</Link>)}</dd></div> : null}<div><dt>All-time upvotes</dt><dd>{community.allTimeUpvotes.toLocaleString()}</dd></div><div><dt>Outbound clicks</dt><dd>{community.outboundClicks.toLocaleString()} clicks on this startup&apos;s website link</dd></div><div><dt>Listed since</dt><dd><LocalTime value={product.launchAt.toISOString()} dateOnly /></dd></div><div><dt>Official website</dt><dd><a href={`/go/${product.slug}?source=product_page`} target="_blank" rel="ugc noopener noreferrer">{new URL(product.websiteUrl).hostname}</a></dd></div></dl>{product.description && product.description !== community.useCase ? <div className="product-description"><h3>About the product</h3><p className="long-copy">{product.description}</p></div> : null}</section>

      {screenshots.length ? <section className="media-gallery" aria-label="Product screenshots">{screenshots.map((item) => <figure key={item.id}><Image src={item.url} alt={item.altText || `${product.displayName} screenshot`} width={960} height={600} unoptimized /></figure>)}</section> : null}

      {product.updates.length ? <section id="updates" className="detail-section"><p className="eyebrow">Founder updates</p><h2>What’s new</h2><div className="update-timeline">{product.updates.map((update) => <article key={update.id}><div><span>{update.type}</span><LocalTime value={update.publishedAt.toISOString()} dateOnly /></div><h3>{update.title}</h3><p>{update.body}</p>{update.linkUrl ? <a href={update.linkUrl} rel="nofollow noopener noreferrer" target="_blank">Read more ↗</a> : null}</article>)}</div></section> : null}

      <section id="discussion" className="detail-section"><p className="eyebrow">Discussion</p><h2>Questions and feedback</h2><p className="section-lede">{community.commentCount === 0 ? "No questions yet." : `${community.commentCount.toLocaleString()} visible ${community.commentCount === 1 ? "post" : "posts"}, including replies.`}</p><Discussion slug={product.slug} initialComments={comments} signedIn={Boolean(user)} /></section>

      {/* Once ownership is confirmed, the claim block has nothing left to offer here. */}
      {community.ownershipState !== "claimed" ? <ProductClaim slug={product.slug} signedIn={Boolean(user)} state={community.ownershipState} /> : null}
    </article>

    <aside className="product-side-note">{community.launch ? <div><strong>{community.launch.active ? "Launching this week" : "Launch record"}</strong><p>{community.launch.startsAt.toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric" })}–{community.launch.endsAt.toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })} UTC · {community.launch.votes} this week&apos;s vote{community.launch.votes === 1 ? "" : "s"}</p><small>A first upvote cast during the live week counts here and in all-time support. Earlier support does not.</small></div> : null}<div><strong>{community.allTimeUpvotes.toLocaleString()} all-time upvote{community.allTimeUpvotes === 1 ? "" : "s"}</strong><p>Includes preserved historical support and active authenticated upvotes without double-counting launch votes.</p></div><div><strong>{community.outboundClicks.toLocaleString()} outbound click{community.outboundClicks === 1 ? "" : "s"}</strong><p>Clicks on the startup&apos;s website link; not unique customers or confirmed visits.</p></div><div><strong>{community.followerCount} follower{community.followerCount === 1 ? "" : "s"}</strong><p>Followers can find this startup’s published progress in their Following feed.</p></div>{product.biddingMechanism || product.minimumBidMinor !== null || product.currentBidMinor !== null ? <details className="legacy-details"><summary>Historical bidding details</summary><dl>{product.biddingMechanism ? <div><dt>Mechanism</dt><dd>{product.biddingMechanism}</dd></div> : null}{product.minimumBidMinor !== null && product.bidCurrency ? <div><dt>Minimum bid</dt><dd>{formatMinorUnits(product.minimumBidMinor, product.bidCurrency)}</dd></div> : null}{product.currentBidMinor !== null && product.bidCurrency ? <div><dt>Last recorded bid</dt><dd>{formatMinorUnits(product.currentBidMinor, product.bidCurrency)}</dd></div> : null}</dl></details> : null}</aside>
    </div>
  </main>;
}
