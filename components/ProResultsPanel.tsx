import Link from "next/link";
import { PrintReportButton } from "@/components/PrintReportButton";
import { getProReport } from "@/lib/pro-results";

function value(number: number | null) { return number === null ? "Not available" : number.toLocaleString(); }

/** The Results tab: the seven-day Pro summary, or the upgrade path when Pro is not active. */
export async function ProResultsPanel({ slug, productId, entitlementStatus }: {
  slug: string;
  productId: string;
  entitlementStatus: string | null;
}) {
  if (entitlementStatus !== "active") {
    return <section className="settings-card results-locked">
      <h2>{entitlementStatus === "suspended" ? "Results are temporarily suspended" : "A Pro upgrade is required"}</h2>
      <p>Pro includes one private seven-day summary of recorded views, outbound clicks, net community activity and visible comments. Your free startup page and historical activity remain unchanged.</p>
      {!entitlementStatus ? <Link className="button button-primary" href={`/manage/${slug}/pro`}>Upgrade to Pro</Link> : null}
    </section>;
  }
  const report = await getProReport(productId);
  if (!report) return <section className="settings-card"><h2>Your report starts with your launch</h2><p>After approval, schedule your launch to begin the seven-day report. Your private launch tools are already available.</p></section>;
  const start = new Date(report.startsAt), end = new Date(report.endsAt);
  const activityMax = Math.max(1, ...report.days.map((day) => day.views + day.clicks + Math.max(0, day.upvotes) + Math.max(0, day.followers) + day.comments));
  return <section className="results-page results-tab" aria-labelledby="results-heading">
    <header className="owner-tab-heading results-heading"><div><h2 id="results-heading">Seven-day results summary</h2><p>{start.toLocaleString("en", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} → {end.toLocaleString("en", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })} · UTC</p></div><PrintReportButton /></header>
    <section className={`report-status status-${report.status}`}><strong>{report.status === "scheduled" ? `Your summary starts on ${start.toLocaleDateString("en", { timeZone: "UTC", dateStyle: "medium" })}` : report.status === "in_progress" ? "In progress" : "Complete"}</strong><span>{report.anchorKind === "future_launch" ? "Anchored to the startup's scheduled launch." : "Anchored to Pro activation."} Last updated {new Date(report.lastUpdatedAt).toLocaleString("en", { timeZone: "UTC" })} UTC.</span></section>
    {!report.coverageComplete ? <section className="manager-notice"><h2>Some metrics are not available</h2><p>This reporting window began before FounderTrail had complete prospective activity tracking. Historical totals were not relabelled as new activity.</p></section> : <>
      <section className="report-metrics"><article><span>Recorded profile views</span><strong>{value(report.metrics.views)}</strong><small>One eligible browser per startup per UTC day.</small></article><article><span>Recorded outbound clicks</span><strong>{value(report.metrics.clicks)}</strong><small>One counted click per browser and startup under current deduplication.</small></article><article><span>Net upvote change</span><strong>{value(report.metrics.netUpvotes)}</strong><small>Upvotes added minus removals during the window.</small></article><article><span>Net follower change</span><strong>{value(report.metrics.netFollowers)}</strong><small>Follows added minus unfollows during the window.</small></article><article><span>New public comments</span><strong>{value(report.metrics.comments)}</strong><small>Comments still visible when the report was calculated.</small></article></section>
      <section className="settings-card report-summary"><h2>What FounderTrail recorded</h2><p>Between {start.toLocaleDateString("en", { timeZone: "UTC" })} and {end.toLocaleDateString("en", { timeZone: "UTC" })}, {report.startupName} recorded {report.metrics.views} profile views, {report.metrics.clicks} website clicks, and a net change of {report.metrics.netFollowers} followers.</p><p className="form-hint">These are observed events around the startup. They are not customers, conversions, unique people, or evidence that Pro caused the activity.</p></section>
      <section className="settings-card report-activity"><h2>Daily activity</h2><div className="activity-bars" aria-hidden="true">{report.days.map((day) => { const total = day.views + day.clicks + Math.max(0, day.upvotes) + Math.max(0, day.followers) + day.comments; return <div key={day.start}><span style={{ height: `${Math.max(4, (total / activityMax) * 140)}px` }} /><small>{new Date(day.start).toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric" })}</small></div>; })}</div><table><caption className="sr-only">Daily results in UTC</caption><thead><tr><th>UTC period</th><th>Views</th><th>Clicks</th><th>Net upvotes</th><th>Net followers</th><th>Comments</th></tr></thead><tbody>{report.days.map((day) => <tr key={day.start}><th>{new Date(day.start).toLocaleString("en", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric" })}</th><td>{day.views}</td><td>{day.clicks}</td><td>{day.upvotes}</td><td>{day.followers}</td><td>{day.comments}</td></tr>)}</tbody></table></section>
    </>}
  </section>;
}
