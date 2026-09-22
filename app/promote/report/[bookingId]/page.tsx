import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";
import { signInUrl } from "@/lib/return-to";
import { LocalTime } from "@/components/LocalTime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaign report", robots: { index: false, follow: false } };

const PLACEMENT_LABELS: Record<string, string> = {
  home_featured: "Homepage · Featured sponsors",
  discover_inline: "Directory row",
  product_detail: "Startup page",
  this_week_desktop: "This week · desktop (legacy)",
  this_week_mobile: "This week · mobile (legacy)",
  discover_desktop: "Discover · desktop (legacy)",
  discover_mobile: "Discover · mobile (legacy)",
};

function rate(clicks: number, impressions: number): string {
  return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "—";
}

export default async function CampaignReportPage({ params }: PageProps<"/promote/report/[bookingId]">) {
  const { bookingId } = await params;
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(signInUrl(`/promote/report/${bookingId}`));
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) notFound();

  // Ownership is checked in the query itself: a sponsor only ever sees their own campaign,
  // and no visitor identifier or other buyer's data is selected at all.
  const bookings = await query<{
    id: string; slug: string; name: string; booking_status: string; payment_status: string;
    start_at: Date; end_at: Date; duration_days: number; price_minor: number; currency: string;
  }>(
    `SELECT b.id::text,p.slug,b.creative_name AS name,b.booking_status,b.payment_status,
            b.start_at,b.end_at,b.duration_days,b.price_minor,b.currency
       FROM sponsor_bookings b JOIN products p ON p.id=b.product_id
      WHERE b.id=$1::uuid AND b.purchaser_id=$2`,
    [bookingId, user.id],
  );
  const booking = bookings[0];
  if (!booking) notFound();

  const [byPlacement, byDay] = await Promise.all([
    query<{ placement: string; impressions: number; clicks: number }>(
      `SELECT placement,
              count(*) FILTER (WHERE event_type='impression')::int AS impressions,
              count(*) FILTER (WHERE event_type='outbound_click')::int AS clicks
         FROM sponsor_events WHERE booking_id=$1::uuid GROUP BY placement ORDER BY placement`,
      [bookingId],
    ),
    query<{ day: Date; impressions: number; clicks: number }>(
      `SELECT date_trunc('day', created_at) AS day,
              count(*) FILTER (WHERE event_type='impression')::int AS impressions,
              count(*) FILTER (WHERE event_type='outbound_click')::int AS clicks
         FROM sponsor_events WHERE booking_id=$1::uuid GROUP BY 1 ORDER BY 1`,
      [bookingId],
    ),
  ]);

  const impressions = byPlacement.reduce((total, row) => total + row.impressions, 0);
  const clicks = byPlacement.reduce((total, row) => total + row.clicks, 0);
  const peak = Math.max(1, ...byDay.map((row) => row.impressions));

  return <main className="app-shell inner-page account-page">
    <header className="page-heading">
      <p className="eyebrow">Campaign report · {booking.name}</p>
      <h1>{booking.booking_status.replaceAll("_", " ")}</h1>
      <p>
        <LocalTime value={booking.start_at.toISOString()} /> → <LocalTime value={booking.end_at.toISOString()} />
        {" · "}{booking.duration_days} days · ${(booking.price_minor / 100).toFixed(2)} {booking.currency} · payment {booking.payment_status.replaceAll("_", " ")}
      </p>
      <Link className="text-link" href={`/promote/${booking.slug}`}>← Back to promotion</Link>
    </header>

    <section className="metric-card-grid">
      <div className="metric-card"><span>Impressions</span><strong>{impressions.toLocaleString()}</strong><small>At least half visible for one second in a visible tab</small></div>
      <div className="metric-card"><span>Outbound clicks</span><strong>{clicks.toLocaleString()}</strong><small>One per page view, only after a matching impression</small></div>
      <div className="metric-card"><span>Click-through rate</span><strong>{rate(clicks, impressions)}</strong><small>Clicks divided by impressions</small></div>
    </section>

    <section className="settings-card">
      <h2>By placement</h2>
      {byPlacement.length ? <dl className="report-breakdown">
        {byPlacement.map((row) => <div key={row.placement}>
          <dt>{PLACEMENT_LABELS[row.placement] ?? row.placement}</dt>
          <dd>{row.impressions.toLocaleString()} impressions · {row.clicks.toLocaleString()} clicks · {rate(row.clicks, row.impressions)}</dd>
        </div>)}
      </dl> : <div className="quiet-empty">No qualified events recorded yet.</div>}
    </section>

    <section className="settings-card">
      <h2>Daily trend</h2>
      {byDay.length ? <div className="report-trend">
        {byDay.map((row) => <div key={row.day.toISOString()}>
          <span className="report-bar" style={{ height: `${Math.round((row.impressions / peak) * 100)}%` }} aria-hidden="true" />
          <small><LocalTime value={row.day.toISOString()} dateOnly /></small>
          <small>{row.impressions.toLocaleString()} / {row.clicks.toLocaleString()}</small>
        </div>)}
      </div> : <div className="quiet-empty">No qualified events recorded yet.</div>}
      <p className="form-hint">Each bar is that day&apos;s impressions; the numbers below are impressions / clicks.</p>
    </section>

    <section className="policy-note">
      <h2>What these numbers are</h2>
      <p>Impressions and clicks are traffic signals measured by FounderTrail. They are <strong>not</strong> customers, signups, sales, or confirmed visits to your site, and we make no claim about what happened after someone left. Obvious duplicates, reloads and bots are excluded. Visitor identities are never shown here or stored in a form that identifies a person.</p>
    </section>
  </main>;
}
