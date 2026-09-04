import Link from "next/link";
import { cookies } from "next/headers";
import { DiscoverySidebar } from "@/components/DiscoverySidebar";
import { ProductRow } from "@/components/ProductRow";
import { BIDINDEX_VISITOR_COOKIE } from "@/lib/bidindex-visitor";
import { brandCopy } from "@/lib/brand";
import { config } from "@/lib/config";
import { query } from "@/lib/db";
import { pageWindow } from "@/lib/discovery-pagination";
import { eventHash } from "@/lib/request-security";
import {
  DISCOVERY_VIEWS,
  getActiveVoteSlugs,
  getDiscoveryPage,
  getEcosystemSnapshot,
  getLatestUpdates,
  type DiscoveryView,
} from "@/lib/product-data";

export const dynamic = "force-dynamic";

const tabs: Array<{ view: DiscoveryView; label: string }> = [
  { view: "today", label: "Launching today" },
  { view: "trending", label: "Trending" },
  { view: "verified", label: "Verified" },
  { view: "newest", label: "Newest" },
];
const emptyCopy: Record<DiscoveryView, string> = {
  today: "No products have launched today yet.",
  trending: "Trending products will appear as founders and visitors participate.",
  verified: "No products have connected verified data yet.",
  newest: "No approved products yet. Be the first founder to submit.",
};

export default async function Home({ searchParams }: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const view = DISCOVERY_VIEWS.includes(params.view as DiscoveryView) ? params.view as DiscoveryView : "trending";
  const search = (params.q ?? "").trim().slice(0, 80);
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const [listing, snapshot, updates,foundingBanner] = await Promise.all([
    getDiscoveryPage({ view, query: search, page: Number.isFinite(requestedPage) ? requestedPage : 1 }),
    getEcosystemSnapshot(),
    getLatestUpdates(3),
    query<{founding_banner_enabled:boolean;founding_banner_ends_at:Date|null}>(`SELECT founding_banner_enabled,founding_banner_ends_at FROM site_config WHERE singleton=true`),
  ]);
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(BIDINDEX_VISITOR_COOKIE)?.value ?? cookieStore.get("yourhour_visitor")?.value ?? null;
  const voted = await getActiveVoteSlugs(visitorId ? eventHash("bidindex:visitor", visitorId) : null);
  const { products, total, page, pageCount, offset } = listing;
  const demoVisible = products.some((product) => product.isDemo);
  const pageHref = (target: number) => {
    const linkParams = new URLSearchParams({ view });
    if (search) linkParams.set("q", search);
    if (target > 1) linkParams.set("page", String(target));
    return `/?${linkParams.toString()}#products`;
  };

  return (
    <main>
      <section className="intro-section app-shell">
        <div>
          <h1>{brandCopy.homepageHeadline}</h1>
          <p>{brandCopy.homepageDescription}</p>
        </div>
        <div className="intro-actions">
          <Link className="button button-primary" href="#products">Explore products</Link>
          <Link className="button button-secondary" href="/submit">Submit your product — free</Link>
        </div>
      </section>

      {foundingBanner[0]?.founding_banner_enabled&&(!foundingBanner[0].founding_banner_ends_at||new Date(foundingBanner[0].founding_banner_ends_at)>new Date())?<aside className="founding-banner app-shell"><div><strong>Founding products are live</strong><p>Discover the first products building the bidding-product ecosystem.</p></div><Link className="button button-secondary" href="/founding">Explore all founding products</Link></aside>:null}

      <div className="app-shell discovery-layout">
        <section id="products" className="discovery-main" aria-labelledby="discovery-heading">
          <div className="discovery-toolbar">
            <div>
              <h2 id="discovery-heading">Discover products</h2>
              {search ? <p>Results for “{search}”</p> : null}
            </div>
            <nav className="filter-tabs" aria-label="Discovery filters">
              {tabs.map((tab) => (
                <Link
                  key={tab.view}
                  className={view === tab.view ? "is-active" : ""}
                  href={`/?view=${tab.view}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                >{tab.label}</Link>
              ))}
            </nav>
          </div>
          {demoVisible ? <p className="demo-notice"><strong>Demo data</strong> — these local development products and numbers are synthetic.</p> : null}
          <div className="product-list">
            {products.length ? products.map((product, index) => (
              <ProductRow key={product.id} product={product} position={offset + index + 1} voted={voted.has(product.slug)} />
            )) : (
              <div className="empty-state">
                <h3>No products found</h3>
                <p>{search ? "Try a broader search or another filter." : emptyCopy[view]}</p>
                <Link href="/submit">Submit the first product</Link>
              </div>
            )}
          </div>
          {total ? (
            <footer className="discovery-footer">
              {pageCount > 1 ? (
                <nav className="pagination" aria-label="Discovery pages">
                  {page > 1
                    ? <Link className="pagination-step" href={pageHref(page - 1)} rel="prev">Previous</Link>
                    : <span className="pagination-step is-disabled" aria-hidden="true">Previous</span>}
                  {pageWindow(page, pageCount).map((item, index) => item === null
                    ? <span key={`gap-${index}`} className="pagination-gap" aria-hidden="true">…</span>
                    : item === page
                      ? <span key={item} className="is-current" aria-current="page">{item}</span>
                      : <Link key={item} href={pageHref(item)} aria-label={`Page ${item}`}>{item}</Link>)}
                  {page < pageCount
                    ? <Link className="pagination-step" href={pageHref(page + 1)} rel="next">Next</Link>
                    : <span className="pagination-step is-disabled" aria-hidden="true">Next</span>}
                </nav>
              ) : null}
              <p className="discovery-count">
                Showing <strong>{offset + 1}–{offset + products.length}</strong> of <strong>{total}</strong>{" "}
                {total === 1 ? "product" : "products"}
                {pageCount > 1 ? <> · Page {page} of {pageCount}</> : null}
              </p>
            </footer>
          ) : null}
        </section>
        <DiscoverySidebar snapshot={snapshot} updates={updates} />
      </div>
      {config.featurePromotions ? <p className="sr-only">Promotions are enabled, but no verified promotion is active.</p> : null}
    </main>
  );
}
