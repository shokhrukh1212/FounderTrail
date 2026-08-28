import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { LocalTime } from "@/components/LocalTime";
import { ProductLogo } from "@/components/ProductLogo";
import { XShareLink } from "@/components/XShareLink";
import { VoteButton } from "@/components/VoteButton";
import { BIDINDEX_VISITOR_COOKIE } from "@/lib/bidindex-visitor";
import { config } from "@/lib/config";
import { METRIC_PERIOD_LABELS, METRIC_SOURCE_EXPLANATIONS, METRIC_SOURCE_LABELS, formatMinorUnits, metricDefinition, metricLabel } from "@/lib/metric-format";
import { getActiveVoteSlugs, getProductDetail } from "@/lib/product-data";
import { canonicalProductUrl } from "@/lib/product-share";
import { eventHash } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  const canonicalUrl = canonicalProductUrl(config.siteUrl, slug);
  const socialImageUrl = new URL("/og.jpg?share_version=2", `${config.siteUrl}/`).toString();
  return product ? { title: product.name, description: product.tagline, alternates: { canonical: canonicalUrl },
    openGraph: { title: product.name, description: product.tagline, type: "website", url: canonicalUrl, images: [{ url: socialImageUrl, width: 1200, height: 630, type: "image/jpeg", alt: `${config.siteName} — The home of bidding products.` }] },
    twitter: { card: "summary_large_image", title: product.name, description: product.tagline, images: [socialImageUrl] },
  } : { title: "Product not found" };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) notFound();
  const visitorId = (await cookies()).get(BIDINDEX_VISITOR_COOKIE)?.value ?? null;
  const voted = (await getActiveVoteSlugs(visitorId ? eventHash("bidindex:visitor", visitorId) : null)).has(slug);
  const screenshots = product.media.filter((item) => item.kind === "screenshot");
  return <main>
    <section className="product-masthead"><div className="app-shell product-masthead-inner">
      <ProductLogo productName={product.name} productUrl={product.websiteUrl} imageUrl={product.logoUrl} className="product-detail-logo" eager />
      <div className="product-identity"><div className="product-title-line"><h1>{product.name}</h1>{product.isVerified ? <span className="verified-product-badge" title="BidIndex confirmed this product’s domain and badge installation. Check each metric for its individual source.">✓ Verified product</span> : null}{product.isDemo ? <span className="demo-label">Demo data</span> : null}</div><p>{product.tagline}</p><div className="product-meta">{product.founderSocialHandle || product.founderName ? <span>By {product.founderSocialHandle || product.founderName}</span> : null}<span>Launched <LocalTime value={product.launchAt.toISOString()} dateOnly /></span>{product.weeklyPosition ? <span>#{product.weeklyPosition} this week</span> : null}</div><div className="category-list">{product.categories.slice(0, 1).map((category) => <span key={category.slug}>{category.name}</span>)}</div></div>
      <div className="product-primary-actions"><a className="button button-primary" href={`/go/${product.slug}`} target="_blank" rel="noopener noreferrer">Visit website ↗</a><VoteButton slug={product.slug} initialCount={product.voteCount} initialActive={voted} /><XShareLink siteUrl={config.siteUrl} slug={product.slug} productName={product.name} description={product.tagline} /></div>
    </div></section>
    <nav className="product-subnav" aria-label="Product sections"><div className="app-shell"><a href="#overview">Overview</a><a href="#metrics">Live metrics</a>{product.updates.length ? <a href="#updates">Updates</a> : null}<a href="#integration">Integration</a></div></nav>
    <div className="app-shell product-detail-layout"><article>
      <section id="overview" className="detail-section"><p className="eyebrow">Overview</p><h2>About {product.name}</h2>{product.description ? <p className="long-copy">{product.description}</p> : <p className="long-copy">{product.tagline}</p>}
        <dl className="product-facts">{product.founderName || product.founderSocialHandle ? <div><dt>Founder</dt><dd>{product.founderSocialHandle || product.founderName}</dd></div> : null}<div><dt>Launch date</dt><dd><LocalTime value={product.launchAt.toISOString()} dateOnly /></dd></div>{product.categories[0] ? <div><dt>Primary category</dt><dd>{product.categories[0].name}</dd></div> : null}<div><dt>Official website</dt><dd><a href={`/go/${product.slug}`} target="_blank" rel="noopener noreferrer">{new URL(product.websiteUrl).hostname}</a></dd></div>{product.dataDisclosure ? <div><dt>Data disclosure</dt><dd>{product.dataDisclosure}</dd></div> : null}</dl>
        {product.biddingMechanism || product.minimumBidMinor !== null || product.currentBidMinor !== null ? <div className="legacy-product-details"><h3>Product details</h3><dl className="product-facts">{product.biddingMechanism ? <div><dt>Bidding mechanism</dt><dd>{product.biddingMechanism}</dd></div> : null}{product.minimumBidMinor !== null && product.bidCurrency ? <div><dt>Minimum bid</dt><dd>{formatMinorUnits(product.minimumBidMinor, product.bidCurrency)}</dd></div> : null}{product.currentBidMinor !== null && product.bidCurrency ? <div><dt>Current bid</dt><dd>{formatMinorUnits(product.currentBidMinor, product.bidCurrency)}</dd></div> : null}</dl></div> : null}
      </section>
      {screenshots.length ? <section className="media-gallery" aria-label="Product screenshots">{screenshots.map((item) => <figure key={item.id}><Image src={item.url} alt={item.altText || `${product.name} screenshot`} width={960} height={600} unoptimized /></figure>)}</section> : null}
      <section id="metrics" className="detail-section"><p className="eyebrow">Live metrics</p><h2>Available numbers</h2>{product.metrics.length ? <div className="metric-card-grid">{product.metrics.map((metric) => <div className="metric-card" key={`${metric.type}-${metric.source}-${metric.currency}`} title={metricDefinition(metric.type)}><span>{metric.type.replaceAll("_", " ")}</span><strong>{metricLabel(metric)}</strong><small>{METRIC_PERIOD_LABELS[metric.measurementPeriod]}</small><small className={`source-label source-${metric.source}`} title={METRIC_SOURCE_EXPLANATIONS[metric.source]}>{METRIC_SOURCE_LABELS[metric.source]}</small><small>Updated <LocalTime value={metric.updatedAt.toISOString()} /></small>{metric.sourceUrl ? <a href={metric.sourceUrl} target="_blank" rel="nofollow noopener noreferrer">View public source ↗</a> : null}</div>)}</div> : <div className="quiet-empty"><strong>Not connected</strong><br />No usable metric data yet. Domain and badge verification can still verify this product without revenue data.</div>}</section>
      {product.updates.length ? <section id="updates" className="detail-section"><p className="eyebrow">Founder updates</p><h2>What’s new</h2><div className="update-timeline">{product.updates.map((update) => <article key={update.id}><div><span>{update.type}</span><LocalTime value={update.publishedAt.toISOString()} dateOnly /></div><h3>{update.title}</h3><p>{update.body}</p>{update.linkUrl ? <a href={update.linkUrl} rel="nofollow noopener noreferrer" target="_blank">Read more ↗</a> : null}</article>)}</div></section> : null}
      <section id="integration" className="detail-section"><p className="eyebrow">Integration</p><h2>How this product’s data is trusted</h2><p className="long-copy">Domain ownership plus a detected BidIndex badge creates the Verified product status. The badge measures approximate traffic, and BidIndex measures eligible outbound clicks from this site. Revenue requires optional authenticated partner events, a reviewed public source, or a future direct processor connection. Each metric identifies its own source.</p><Link className="text-link" href="/about">How verification works →</Link></section>
    </article><aside className="product-side-note"><strong>Data you can trust</strong><p>Every number identifies its own source. BidIndex never lets a payment improve organic ranking.</p>{product.publicAnalyticsUrl ? <a href={product.publicAnalyticsUrl} rel="nofollow noopener noreferrer" target="_blank">Public analytics ↗</a> : null}</aside></div>
  </main>;
}
