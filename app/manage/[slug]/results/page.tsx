import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PrintReportButton } from "@/components/PrintReportButton";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";
import { getProReport } from "@/lib/pro-results";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pro results", robots: { index: false, follow: false } };

function value(number: number | null) { return number === null ? "Not available" : number.toLocaleString(); }

export default async function ResultsPage({ params }: PageProps<"/manage/[slug]/results">) {
  const { slug } = await params;
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(`/manage/${slug}/results`)}`);
  const products = await query<{ id: string; name: string; entitlement_status: string | null }>(
    `SELECT p.id::text,p.name,e.status AS entitlement_status FROM products p LEFT JOIN pro_entitlements e ON e.product_id=p.id
      WHERE p.slug=$1 AND (EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2)
       OR EXISTS(SELECT 1 FROM app_users au WHERE au.id=$2 AND au.role='admin'))`, [slug, user.id],
  );
  const product = products[0]; if (!product) notFound();
  if (product.entitlement_status !== "active") return <main className="app-shell inner-page narrow-page"><header className="page-heading"><p className="eyebrow">Pro results</p><h1>{product.name}</h1></header><section className="settings-card"><h2>{product.entitlement_status === "suspended" ? "Results are temporarily suspended" : "A Pro upgrade is required"}</h2><p>Your free startup page and historical activity remain unchanged.</p>{!product.entitlement_status ? <Link className="button button-primary" href={`/manage/${slug}/pro`}>Upgrade to Pro</Link> : null}</section></main>;
  const report = await getProReport(product.id);
  if (!report) return <main className="app-shell inner-page narrow-page"><section className="settings-card"><h1>Results are being prepared</h1><p>Reload shortly. Your launch tools are already available.</p></section></main>;
  const start = new Date(report.startsAt), end = new Date(report.endsAt);
  const activityMax = Math.max(1, ...report.days.map((day) => day.views + day.clicks + Math.max(0, day.upvotes) + Math.max(0, day.followers) + day.comments));
  return <main className="app-shell inner-page results-page">
    <header className="page-heading results-heading"><div><p className="eyebrow">Seven-day results summary</p><h1>{report.startupName}</h1><p>{start.toLocaleString("en", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} → {end.toLocaleString("en", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} · UTC</p></div><PrintReportButton /><nav className="owner-page-nav print-hide"><Link href={`/manage/${slug}`}>Overview</Link><Link href={`/manage/${slug}/launch-kit`}>Launch kit</Link><Link aria-current="page" href={`/manage/${slug}/results`}>Results</Link></nav></header>
    <section className={`report-status status-${report.status}`}><strong>{report.status === "scheduled" ? `Your summary starts on ${start.toLocaleDateString("en", { timeZone: "UTC", dateStyle: "medium" })}` : report.status === "in_progress" ? "In progress" : "Complete"}</strong><span>{report.anchorKind === "future_launch" ? "Anchored to the startup's scheduled launch." : "Anchored to Pro activation."} Last updated {new Date(report.lastUpdatedAt).toLocaleString("en", { timeZone: "UTC" })} UTC.</span></section>
    {!report.coverageComplete ? <section className="manager-notice"><h2>Some metrics are not available</h2><p>This reporting window began before FounderTrail had complete prospective activity tracking. Historical totals were not relabelled as new activity.</p></section> : <>
      <section className="report-metrics"><article><span>Recorded profile views</span><strong>{value(report.metrics.views)}</strong><small>One eligible browser per startup per UTC day.</small></article><article><span>Recorded outbound clicks</span><strong>{value(report.metrics.clicks)}</strong><small>One counted click per browser and startup under current deduplication.</small></article><article><span>Net upvote change</span><strong>{value(report.metrics.netUpvotes)}</strong><small>Upvotes added minus removals during the window.</small></article><article><span>Net follower change</span><strong>{value(report.metrics.netFollowers)}</strong><small>Follows added minus unfollows during the window.</small></article><article><span>New public comments</span><strong>{value(report.metrics.comments)}</strong><small>Comments still visible when the report was calculated.</small></article></section>
      <section className="settings-card report-summary"><h2>What FounderTrail recorded</h2><p>Between {start.toLocaleDateString("en", { timeZone: "UTC" })} and {end.toLocaleDateString("en", { timeZone: "UTC" })}, {report.startupName} recorded {report.metrics.views} profile views, {report.metrics.clicks} website clicks, and a net change of {report.metrics.netFollowers} followers.</p><p className="form-hint">These are observed events around the startup. They are not customers, conversions, unique people, or evidence that Pro caused the activity.</p></section>
      <section className="settings-card report-activity"><h2>Daily activity</h2><div className="activity-bars" aria-hidden="true">{report.days.map((day) => { const total = day.views + day.clicks + Math.max(0, day.upvotes) + Math.max(0, day.followers) + day.comments; return <div key={day.start}><span style={{ height: `${Math.max(4, (total / activityMax) * 140)}px` }} /><small>{new Date(day.start).toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric" })}</small></div>; })}</div><table><caption className="sr-only">Daily results in UTC</caption><thead><tr><th>UTC period</th><th>Views</th><th>Clicks</th><th>Net upvotes</th><th>Net followers</th><th>Comments</th></tr></thead><tbody>{report.days.map((day) => <tr key={day.start}><th>{new Date(day.start).toLocaleString("en", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric" })}</th><td>{day.views}</td><td>{day.clicks}</td><td>{day.upvotes}</td><td>{day.followers}</td><td>{day.comments}</td></tr>)}</tbody></table></section>
    </>}
  </main>;
}
