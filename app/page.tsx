import Link from "next/link";
import { cookies } from "next/headers";
import { DiscoverySidebar } from "@/components/DiscoverySidebar";
import { ProductRow } from "@/components/ProductRow";
import { BIDINDEX_VISITOR_COOKIE } from "@/lib/bidindex-visitor";
import { config } from "@/lib/config";
import { eventHash } from "@/lib/request-security";
import {
  DISCOVERY_VIEWS,
  getActiveVoteSlugs,
  getDiscoveryProducts,
  getEcosystemSnapshot,
  getLatestUpdates,
  type DiscoveryView,
} from "@/lib/product-data";

export const dynamic = "force-dynamic";

const tabs: Array<{ view: DiscoveryView; label: string }> = [
  { view: "today", label: "Launching today" },
  { view: "trending", label: "Trending this week" },
  { view: "verified", label: "Verified" },
  { view: "newest", label: "Newest" },
];

export default async function Home({ searchParams }: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const params = await searchParams;
  const view = DISCOVERY_VIEWS.includes(params.view as DiscoveryView) ? params.view as DiscoveryView : "trending";
  const search = (params.q ?? "").trim().slice(0, 80);
  const [products, snapshot, updates] = await Promise.all([
    getDiscoveryProducts({ view, query: search }),
    getEcosystemSnapshot(),
    getLatestUpdates(3),
  ]);
  const cookieStore = await cookies();
  const visitorId = cookieStore.get(BIDINDEX_VISITOR_COOKIE)?.value ?? cookieStore.get("yourhour_visitor")?.value ?? null;
  const voted = await getActiveVoteSlugs(visitorId ? eventHash("bidindex:visitor", visitorId) : null);
  const demoVisible = products.some((product) => product.isDemo);

  return (
    <main>
      <section className="intro-section app-shell">
        <div>
          <p className="eyebrow">Live bidding-product discovery</p>
          <h1>Discover the bidding products actually getting traction.</h1>
          <p>Explore new pay-to-rank products with transparent launches, community signals and verified live numbers.</p>
        </div>
        <div className="intro-actions">
          <Link className="button button-primary" href="/submit">Submit your product — free</Link>
          <Link className="button button-secondary" href="/?view=verified">See verified products</Link>
        </div>
      </section>

      <div className="app-shell discovery-layout">
        <section className="discovery-main" aria-labelledby="discovery-heading">
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
              <ProductRow key={product.id} product={product} position={index + 1} voted={voted.has(product.slug)} />
            )) : (
              <div className="empty-state">
                <h3>No products found</h3>
                <p>{search ? "Try a broader search or another filter." : "There are no published products in this view yet."}</p>
                <Link href="/submit">Submit the first product</Link>
              </div>
            )}
          </div>
        </section>
        <DiscoverySidebar snapshot={snapshot} updates={updates} />
      </div>
      {config.featurePromotions ? <p className="sr-only">Promotions are enabled, but no verified promotion is active.</p> : null}
    </main>
  );
}
