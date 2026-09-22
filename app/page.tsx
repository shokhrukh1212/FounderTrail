import Link from "next/link";
import { headers } from "next/headers";
import { currentUserFromHeaders } from "@/lib/auth";
import { brandCopy } from "@/lib/brand";
import { isDodoConfigured } from "@/lib/config";
import { query } from "@/lib/db";
import { getActiveSponsor, getFounderTrailDiscovery, getUpdateFeed, type DiscoverySort, type FounderTrailView } from "@/lib/foundertrail-data";
import { StartupRow } from "@/components/StartupRow";
import { SponsorCard } from "@/components/SponsorCard";
import { ProductLogo } from "@/components/ProductLogo";
import { LocalTime } from "@/components/LocalTime";

export const dynamic = "force-dynamic";

const views: Array<{ id: FounderTrailView; label: string }> = [
  { id: "this_week", label: "This week" },
  { id: "discover", label: "All startups" },
  { id: "updates", label: "Updates" },
];

type HomeSearchParams = { view?: string; q?: string; category?: string; pricing?: string; sort?: string; page?: string };

function href(input: Record<string, string | number | undefined>, hash = "products") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) if (value !== undefined && value !== "") params.set(key, String(value));
  return `/?${params.toString()}#${hash}`;
}

function ProductList({ products, page, sort, weekly = false }: {
  products: Awaited<ReturnType<typeof getFounderTrailDiscovery>>["products"];
  page: number;
  sort: DiscoverySort;
  weekly?: boolean;
}) {
  return <div className="organic-list">{products.map((product, index) => <StartupRow
    key={product.id}
    product={product}
    weekly={weekly}
    position={weekly || sort === "most_upvoted" ? (page - 1) * 24 + index + 1 : undefined}
  />)}</div>;
}

export default async function Home({ searchParams }: { searchParams: Promise<HomeSearchParams> }) {
  const params = await searchParams;
  const view = views.some((item) => item.id === params.view) ? params.view as FounderTrailView : "this_week";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const sort: DiscoverySort = params.sort === "newest" ? "newest" : "most_upvoted";
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  const [categories, sponsor] = await Promise.all([
    query<{ slug: string; name: string; count: number }>(`SELECT c.slug,c.name,count(p.id)::int AS count
      FROM categories c LEFT JOIN products p ON p.primary_category_id=c.id AND p.status='published'
      WHERE c.slug=ANY($1::text[]) GROUP BY c.id,c.slug,c.name ORDER BY c.name`, [[
        "ai-tools", "productivity", "developer-tools", "marketing-seo", "sales-crm", "design-creative",
        "writing-content", "analytics-data", "finance-accounting", "ecommerce", "education", "health-fitness",
        "travel", "games", "directories-discovery", "advertising-sponsorship", "other",
      ]]),
    getActiveSponsor(),
  ]);
  const discovery = view === "updates" ? null : await getFounderTrailDiscovery({
    view,
    search: params.q,
    category: params.category,
    pricing: params.pricing,
    sort,
    page,
    userId: user?.id,
  });
  const community = view === "this_week" ? await getFounderTrailDiscovery({ view: "discover", sort, page: 1, userId: user?.id }) : null;
  const feed = view === "updates" ? await getUpdateFeed(page, user?.id ?? null) : null;
  const week = discovery?.week;
  const products = discovery?.products ?? [];
  const sectionTitle = view === "this_week" ? "Startups launching this week" : view === "discover" ? "All startups" : "Founder updates";
  const result = view === "this_week" ? community : discovery;
  const pageTotal = discovery?.pageCount ?? feed?.pageCount ?? 1;

  return <main>
    <section className="intro-section app-shell">
      <div><h1>{brandCopy.homepageHeadline}</h1><p>{brandCopy.homepageDescription}</p></div>
      <div className="intro-actions">
        <Link className="button button-primary" href="/submit">Submit your startup — free</Link>
        <Link className="button button-secondary" href="/?view=discover#products">Explore startups</Link>
      </div>
    </section>

    <section id="products" className="app-shell foundertrail-section">
      <header className="foundertrail-toolbar">
        <div><h2>{sectionTitle}</h2>{week ? <p>{week.startsAt.toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric" })}–{week.endsAt.toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })} · UTC</p> : null}</div>
        <nav className="filter-tabs" aria-label="Discovery views">{views.map((item) => <Link key={item.id} className={view === item.id ? "is-active" : ""} href={href({ view: item.id })}>{item.label}</Link>)}</nav>
      </header>

      {view === "discover" ? <form className="discovery-filters" action="/" method="get">
        <input type="hidden" name="view" value="discover" />
        <label><span className="sr-only">Search</span><input type="search" name="q" defaultValue={params.q} placeholder="Search names, descriptions and use cases" /></label>
        <label><span className="sr-only">Category</span><select name="category" defaultValue={params.category ?? ""}><option value="">All categories</option>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.name} ({category.count})</option>)}</select></label>
        <label><span className="sr-only">Pricing</span><select name="pricing" defaultValue={params.pricing ?? ""}><option value="">All pricing</option><option value="free">Free</option><option value="freemium">Freemium</option><option value="paid">Paid</option><option value="open_source">Open source</option><option value="contact">Contact sales</option><option value="unknown">Pricing not listed</option></select></label>
        <label><span className="sr-only">Sort</span><select name="sort" defaultValue={sort}><option value="most_upvoted">Most upvoted</option><option value="newest">Newest</option></select></label>
        <button className="button button-secondary">Apply</button>
      </form> : null}

      {view === "updates" ? <div className="update-feed">{feed?.updates.length ? feed.updates.map((update) => <article key={update.id}>
        <ProductLogo productName={update.productName} imageUrl={update.logoUrl} productUrl={null} className="product-list-logo" />
        <div><p><span className="status-pill">{update.type}</span> <LocalTime value={update.publishedAt.toISOString()} dateOnly /></p><h3><Link href={`/product/${update.productSlug}#updates`}>{update.title}</Link></h3><strong>{update.productName}</strong><p>{update.body}</p>{update.linkUrl ? <a href={update.linkUrl} rel="nofollow noopener noreferrer" target="_blank">Read more ↗</a> : null}</div>
      </article>) : <div className="empty-state compact-empty"><h3>No published updates yet</h3><p>{brandCopy.updatesIntroduction}</p></div>}</div> : null}

      {view === "this_week" ? <>
        <div className={`weekly-layout${products.length ? "" : " is-empty"}`}>
          <div>{products.length ? <ProductList products={products} page={discovery?.page ?? 1} sort={sort} weekly /> : <div className="weekly-empty"><div><h3>No launches this week yet.</h3><p>Discover the community below, or schedule your startup&apos;s launch.</p></div><div className="button-row"><Link className="button button-secondary" href="/my-products">Schedule your launch</Link><Link className="button button-secondary" href="#community">Browse startups</Link></div></div>}</div>
          {sponsor ? <aside className="sponsor-slot"><SponsorCard sponsor={sponsor} view={view} /></aside> : isDodoConfigured() ? <aside className="sponsor-slot"><div className="advertise-empty"><span>Sponsored placement</span><p>One clearly labelled startup for seven days.</p><Link href="/my-products">View sponsorship →</Link></div></aside> : null}
        </div>
        <section id="community" className="community-directory" aria-labelledby="community-heading">
          <header><div><p className="eyebrow">Community directory</p><h2 id="community-heading">{sort === "newest" ? "Recently added startups" : "Community favourites"}</h2><p>{sort === "newest" ? "The latest approved startups." : "Explore startups ranked by community upvotes."}</p></div><div className="community-controls"><form action="/" method="get"><input type="hidden" name="view" value="this_week" /><label><span className="sr-only">Sort community</span><select name="sort" defaultValue={sort}><option value="most_upvoted">Most upvoted</option><option value="newest">Newest</option></select></label><button className="button button-secondary">Apply</button></form><Link className="text-link" href="/?view=discover&sort=most_upvoted#products">Browse and filter all →</Link></div></header>
          {community?.products.length ? <ProductList products={community.products} page={1} sort={sort} /> : <div className="empty-state compact-empty"><h3>No startups found</h3></div>}
        </section>
      </> : null}

      {view === "discover" ? <>{result?.products.length ? <ProductList products={result.products} page={result.page} sort={sort} /> : <div className="empty-state compact-empty"><h3>No startups found</h3><p>Try broader filters.</p></div>}</> : null}

      {pageTotal > 1 && view !== "this_week" ? <nav className="pagination" aria-label="Pages">{page > 1 ? <Link href={href({ view, q: params.q, category: params.category, pricing: params.pricing, sort, page: page - 1 })}>Previous</Link> : null}<span>Page {page} of {pageTotal}</span>{page < pageTotal ? <Link href={href({ view, q: params.q, category: params.category, pricing: params.pricing, sort, page: page + 1 })}>Next</Link> : null}</nav> : null}
    </section>
  </main>;
}
