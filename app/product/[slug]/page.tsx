import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { LocalTime } from "@/components/LocalTime";
import { ProductLogo } from "@/components/ProductLogo";
import { ShareButton } from "@/components/ShareButton";
import { VoteButton } from "@/components/VoteButton";
import { BIDINDEX_VISITOR_COOKIE } from "@/lib/bidindex-visitor";
import { METRIC_SOURCE_LABELS, formatMinorUnits, metricLabel } from "@/lib/metric-format";
import { getActiveVoteSlugs, getProductDetail } from "@/lib/product-data";
import { eventHash } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  return product ? { title: `${product.name} — BidIndex`, description: product.tagline } : { title: "Product not found — BidIndex" };
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
      <ProductLogo productName={product.name} productUrl={null} imageUrl={product.logoUrl} className="product-detail-logo" eager />
      <div className="product-identity"><div className="product-title-line"><h1>{product.name}</h1>{product.isDemo ? <span className="demo-label">Demo data</span> : null}</div><p>{product.tagline}</p><div className="product-meta"><span>By {product.founderSocialHandle || product.founderName}</span><span>Launched <LocalTime value={product.launchAt.toISOString()} dateOnly /></span>{product.weeklyPosition ? <span>#{product.weeklyPosition} this week</span> : null}</div><div className="category-list">{product.categories.map((category) => <span key={category.slug}>{category.name}</span>)}</div></div>
      <div className="product-primary-actions"><a className="button button-primary" href={`/go/${product.slug}`} target="_blank" rel="noopener noreferrer">Visit website ↗</a><VoteButton slug={product.slug} initialCount={product.voteCount} initialActive={voted} /><ShareButton title={product.name} /></div>
    </div></section>
    <nav className="product-subnav" aria-label="Product sections"><div className="app-shell"><a href="#overview">Overview</a><a href="#metrics">Live metrics</a><a href="#updates">Updates</a><a href="#integration">Integration</a></div></nav>
    <div className="app-shell product-detail-layout"><article>
      <section id="overview" className="detail-section"><p className="eyebrow">Overview</p><h2>About {product.name}</h2><p className="long-copy">{product.description}</p>
        <dl className="product-facts"><div><dt>Bidding mechanism</dt><dd>{product.biddingMechanism}</dd></div>{product.minimumBidMinor !== null && product.bidCurrency ? <div><dt>Minimum bid</dt><dd>{formatMinorUnits(product.minimumBidMinor, product.bidCurrency)}</dd></div> : null}{product.currentBidMinor !== null && product.bidCurrency ? <div><dt>Current bid</dt><dd>{formatMinorUnits(product.currentBidMinor, product.bidCurrency)}</dd></div> : null}<div><dt>Founder</dt><dd>{product.founderName}</dd></div><div><dt>Official website</dt><dd><a href={`/go/${product.slug}`} target="_blank" rel="noopener noreferrer">{new URL(product.websiteUrl).hostname}</a></dd></div><div><dt>Data disclosure</dt><dd>{product.dataDisclosure || "No additional disclosure supplied."}</dd></div></dl>
      </section>
      {screenshots.length ? <section className="media-gallery" aria-label="Product screenshots">{screenshots.map((item) => <figure key={item.id}><Image src={item.url} alt={item.altText || `${product.name} screenshot`} width={960} height={600} unoptimized /></figure>)}</section> : null}
      <section id="metrics" className="detail-section"><p className="eyebrow">Live metrics</p><h2>Available numbers</h2>{product.metrics.length ? <div className="metric-card-grid">{product.metrics.map((metric) => <div className="metric-card" key={`${metric.type}-${metric.source}-${metric.currency}`}><span>{metric.type.replaceAll("_", " ")}</span><strong>{metricLabel(metric)}</strong><small className={`source-label source-${metric.source}`}>{METRIC_SOURCE_LABELS[metric.source]}</small><small>Updated <LocalTime value={metric.updatedAt.toISOString()} /></small>{metric.sourceUrl ? <a href={metric.sourceUrl} target="_blank" rel="nofollow noopener noreferrer">View public source ↗</a> : null}</div>)}</div> : <div className="quiet-empty"><strong>Unavailable</strong><br />Metrics are unavailable. The founder can connect the partner integration from their management page.</div>}</section>
      <section id="updates" className="detail-section"><p className="eyebrow">Founder updates</p><h2>What’s new</h2>{product.updates.length ? <div className="update-timeline">{product.updates.map((update) => <article key={update.id}><div><span>{update.type}</span><LocalTime value={update.publishedAt.toISOString()} dateOnly /></div><h3>{update.title}</h3><p>{update.body}</p>{update.linkUrl ? <a href={update.linkUrl} rel="nofollow noopener noreferrer" target="_blank">Read more ↗</a> : null}</article>)}</div> : <div className="quiet-empty">No founder updates yet.</div>}</section>
      <section id="integration" className="detail-section"><p className="eyebrow">Integration</p><h2>Verification is metric-specific</h2><p className="long-copy">The BidIndex partner integration can verify privacy-conscious visitors and authenticated server events. A verified domain does not automatically verify revenue or any other metric.</p><Link className="text-link" href="/about">How verification works →</Link></section>
    </article><aside className="product-side-note"><strong>Data you can trust</strong><p>Every number identifies its own source. BidIndex never lets a payment improve organic ranking.</p>{product.publicAnalyticsUrl ? <a href={product.publicAnalyticsUrl} rel="nofollow noopener noreferrer" target="_blank">Public analytics ↗</a> : null}</aside></div>
  </main>;
}
