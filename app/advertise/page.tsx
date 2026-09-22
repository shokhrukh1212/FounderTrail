import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { currentUserFromHeaders } from "@/lib/auth";
import { ahrefsProof, config, isDodoConfigured, sponsorSavings, sponsorTiers } from "@/lib/config";
import { query } from "@/lib/db";
import { getSponsorAvailability } from "@/lib/foundertrail-data";
import { LocalTime } from "@/components/LocalTime";

export const metadata: Metadata = {
  title: "Advertise on FounderTrail",
  description: "Three sponsored placements site-wide. Fixed price, fixed duration, clearly labelled, and completely separate from organic ranking.",
};
export const dynamic = "force-dynamic";

function money(minor: number): string {
  return `$${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`;
}

export default async function AdvertisePage() {
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  const [metrics, availability] = await Promise.all([
    query<{ approved: number; clicks: number; visitor_days: number }>(
      `SELECT (SELECT count(*)::int FROM products WHERE status='published' AND NOT is_demo) AS approved,
              (SELECT count(*)::int FROM product_outbound_click_events WHERE outcome='counted') AS clicks,
              (SELECT count(*)::int FROM visitor_days) AS visitor_days`),
    getSponsorAvailability(new Date(), 28),
  ]);
  const live = metrics[0];
  const tiers = sponsorTiers();
  const savings = sponsorSavings();
  const proof = ahrefsProof();
  const openDays = availability.filter((day) => day.used < day.capacity);

  return <main className="app-shell inner-page advertise-page">
    <header className="page-heading">
      <p className="eyebrow">Advertise</p>
      <h1>Put your startup in front of people already browsing startups.</h1>
      <p>Three sponsored placements run site-wide at any moment. They are clearly labelled, fixed in price and length, and kept completely separate from upvotes, launch order and community ranking. Paying changes where your startup is <em>shown</em>, never where it <em>ranks</em>.</p>
    </header>

    <section className="settings-card">
      <h2>What you get</h2>
      <ul className="advertise-placements">
        <li><strong>Homepage</strong> — a card in <em>Featured sponsors</em>, below the startups launching this week and above Community favourites.</li>
        <li><strong>Discover</strong> — a row inside the directory, after organic results 3, 8 and 13. Sponsored rows carry no rank number and never move an organic result.</li>
        <li><strong>Startup pages</strong> — one compact card between the overview and the discussion. Active sponsors rotate evenly, and your card never appears on your own page.</li>
      </ul>
      <p className="form-hint">Every placement shows your approved logo, name, one-line description and category, with a <strong>Promoted</strong> label. The outbound link is marked <code>rel=&quot;sponsored&quot;</code>. FounderTrail does not sell followed links and never will.</p>
    </section>

    <section className="settings-card">
      <h2>Price</h2>
      <div className="advertise-tiers">
        {tiers.map((tier) => <div key={tier.days} className="advertise-tier">
          <strong>{tier.days} days</strong>
          <span className="advertise-price">{money(tier.priceMinor)}</span>
          <small>One-time payment in {config.sponsorship.currency}. Not a subscription — nothing renews and nothing is charged again.</small>
          {savings && tier.days === 30 ? <span className="advertise-saving">Save {money(savings.savedMinor)} ({savings.percent}%) versus {savings.periods} separate 7-day placements</span> : null}
        </div>)}
      </div>
      <p className="form-hint">Your placement starts at the exact UTC instant you choose and ends {tiers.map((tier) => tier.days).join(" or ")} days later. Start and end times are shown in your local time during checkout.</p>
    </section>

    <section className="settings-card">
      <h2>Availability</h2>
      <p>Capacity is three concurrent placements, enforced by the database rather than by policy. A fourth overlapping campaign cannot be bought.</p>
      <div className="sponsor-inventory-calendar">
        {availability.slice(0, 14).map((day) => <span key={day.date} className={day.used < day.capacity ? "is-available" : "is-booked"}>
          <strong><LocalTime value={day.date} dateOnly /></strong>
          <small>{day.used} / {day.capacity} taken</small>
        </span>)}
      </div>
      <p className="form-hint">{openDays.length ? `${openDays.length} of the next 28 days still have a free placement.` : "Every placement is taken for the next 28 days."} An open slot is availability, not a sale.</p>
    </section>

    <section className="settings-card">
      <h2>What we actually measure</h2>
      <p>You get impressions, outbound clicks, click-through rate, a breakdown by placement and a daily trend. An impression counts when your placement is at least half visible for one continuous second in a visible tab. A click counts once per page view and only when a matching impression was recorded first.</p>
      <p className="metric-disclosure"><strong>These are traffic signals, not customers.</strong> We do not call a click a visit, a signup or a sale, and we do not promise sales, rankings, backlinks or any number of clicks.</p>
      <h3>FounderTrail today</h3>
      <div className="metric-card-grid">
        <div className="metric-card"><span>Approved startups</span><strong>{live?.approved ?? 0}</strong><small>Published listings, all time, excluding demo records</small></div>
        <div className="metric-card"><span>Outbound clicks</span><strong>{live?.clicks ?? 0}</strong><small>Counted clicks on startup website links, all time. Not unique people and not confirmed visits.</small></div>
        <div className="metric-card"><span>Visitor days</span><strong>{live?.visitor_days ?? 0}</strong><small>One browser counted once per UTC day, all time. This is visits, not people.</small></div>
      </div>
      {proof ? <p className="form-hint">
        <strong>Ahrefs Domain Rating: {proof.rating}</strong> — checked {proof.checkedAt}. Domain Rating is <a className="text-link" href="https://ahrefs.com/website-authority-checker" target="_blank" rel="noopener noreferrer nofollow">Ahrefs&apos; own backlink metric</a>, scored 0–100. It is not a Google ranking signal and says nothing about how much traffic you will receive.
      </p> : null}
    </section>

    <section className="settings-card">
      <h2>Content rules</h2>
      <ul>
        <li>You must own the startup you are advertising, or be authorised to market it, and the listing must already be approved.</li>
        <li>The creative is your approved listing: its real logo, name and one-line description. No separate ad copy, no claims we cannot check.</li>
        <li>No adult content, gambling, deceptive financial offers, malware, scraped or impersonated brands, or anything unlawful where we operate.</li>
        <li>We can pause or cancel a campaign that breaks these rules and refund the unserved remainder.</li>
      </ul>
      <h3>Refunds and cancellation</h3>
      <p>Cancel before your placement starts and the full amount is refunded. Cancel while it is running and it stops being shown under the stated policy; the served portion is not refunded. If we fail to deliver a placement we booked, that is our error and it is refunded in full. Payments, refunds and disputes are handled by Dodo Payments as merchant of record.</p>
    </section>

    <section className="settings-card">
      <h2>Ready?</h2>
      {!isDodoConfigured() ? <>
        <p className="manager-notice">Sponsored placements are not open for purchase yet. Nothing here is charged and no slot is being held.</p>
        <p className="form-hint">Everything above is live and accurate; only checkout is disabled.</p>
      </> : !user ? <>
        <p>Sign in with Google, choose an approved startup you own, pick a start date and length, and complete hosted checkout.</p>
        <Link className="button button-primary" href="/sign-in?returnTo=%2Fadvertise">Sign in to continue</Link>
      </> : <>
        <p>Choose an approved startup you own, pick a start date and length, then complete hosted checkout. Your placement activates only after the payment is confirmed by the provider.</p>
        <div className="button-row">
          <Link className="button button-primary" href="/my-products">Choose a startup</Link>
          <Link className="button button-secondary" href="/submit">Submit a startup first</Link>
        </div>
      </>}
      <p className="form-hint">A startup has to be submitted and approved before it can be advertised. Submitting is free and always will be.</p>
    </section>
  </main>;
}
