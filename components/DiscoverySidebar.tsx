import Link from "next/link";
import { formatCompactNumber, formatMinorUnits } from "@/lib/metric-format";
import type { EcosystemSnapshot, LatestUpdate } from "@/lib/product-data";

export function DiscoverySidebar({ snapshot, updates }: { snapshot: EcosystemSnapshot; updates: LatestUpdate[] }) {
  return (
    <aside className="discovery-sidebar" aria-label="Ecosystem information">
      <section className="sidebar-section">
        <h2>Ecosystem snapshot</h2>
        <dl className="snapshot-grid">
          <div><dt>Products tracked</dt><dd>{snapshot.products.toLocaleString()}</dd></div>
          <div><dt>Verified products</dt><dd>{snapshot.verifiedPartners.toLocaleString()}</dd></div>
          <div><dt>Public revenue</dt><dd>{snapshot.revenueByCurrency.length
            ? snapshot.revenueByCurrency.slice(0, 2).map((item) => formatMinorUnits(item.value, item.currency)).join(" · ")
            : "Not available"}</dd></div>
          <div><dt>Outbound clicks</dt><dd>{formatCompactNumber(snapshot.outboundClicks)}</dd></div>
        </dl>
        <p className="sidebar-note">Currencies are shown separately. Founder-reported revenue is excluded.</p>
      </section>
      <section className="sidebar-section">
        <h2>Latest founder updates</h2>
        {updates.length ? <ul className="updates-list">{updates.map((update) => (
          <li key={update.id}>
            <Link href={`/product/${update.productSlug}#updates`}>
              <span>{update.title}</span>
              <small>{update.productName}{update.isDemo ? " · Demo" : ""}</small>
            </Link>
          </li>
        ))}</ul> : <p className="sidebar-empty">No founder updates yet.</p>}
      </section>
    </aside>
  );
}
