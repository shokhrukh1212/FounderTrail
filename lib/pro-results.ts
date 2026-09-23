import "server-only";
import type { PoolClient } from "pg";
import { query, withTransaction } from "./db";

export type ProReportDay = { start: string; end: string; views: number; clicks: number; upvotes: number; followers: number; comments: number };
export type ProReportData = {
  id: string;
  startupName: string;
  slug: string;
  anchorKind: "activation" | "future_launch";
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "in_progress" | "complete";
  coverageComplete: boolean;
  lastUpdatedAt: string;
  metrics: { views: number | null; clicks: number | null; netUpvotes: number | null; netFollowers: number | null; comments: number | null };
  days: ProReportDay[];
};

async function synchronizeFutureAnchor(client: PoolClient, window: { id: string; product_id: string; anchor_kind: string; launch_id: string | null; starts_at: Date }) {
  if (window.anchor_kind !== "future_launch" || new Date(window.starts_at).getTime() <= Date.now() || !window.launch_id) return;
  const bound = await client.query<{ state: string; starts_at: Date }>(
    `SELECT pl.state,lw.starts_at FROM product_launches pl JOIN launch_weeks lw ON lw.id=pl.launch_week_id WHERE pl.id=$1::uuid`, [window.launch_id],
  );
  const launch = bound.rows[0];
  if (launch && launch.state !== "cancelled") {
    if (new Date(launch.starts_at).getTime() !== new Date(window.starts_at).getTime()) await client.query(`UPDATE pro_result_windows SET starts_at=$2,ends_at=$2+interval '7 days',updated_at=now() WHERE id=$1::uuid`, [window.id, launch.starts_at]);
    return;
  }
  const replacement = await client.query<{ id: string; starts_at: Date }>(
    `SELECT pl.id::text,lw.starts_at FROM product_launches pl JOIN launch_weeks lw ON lw.id=pl.launch_week_id
      WHERE pl.product_id=$1::uuid AND pl.state IN ('scheduled','active') AND lw.starts_at>now() ORDER BY lw.starts_at LIMIT 1`, [window.product_id],
  );
  if (replacement.rows[0]) await client.query(`UPDATE pro_result_windows SET launch_id=$2::uuid,starts_at=$3,ends_at=$3+interval '7 days',updated_at=now() WHERE id=$1::uuid`, [window.id, replacement.rows[0].id, replacement.rows[0].starts_at]);
  else await client.query(`UPDATE pro_result_windows SET anchor_kind='activation',launch_id=NULL,starts_at=now(),ends_at=now()+interval '7 days',status='in_progress',updated_at=now() WHERE id=$1::uuid`, [window.id]);
}

async function calculate(client: PoolClient, productId: string, start: Date, end: Date): Promise<{ metrics: ProReportData["metrics"]; days: ProReportDay[] }> {
  const rows = await client.query<{
    slice_start: Date; slice_end: Date; views: number; clicks: number; upvotes: number; followers: number; comments: number;
  }>(
    `WITH slices AS (
       SELECT $2::timestamptz + make_interval(days=>n) AS slice_start,
              LEAST($3::timestamptz,$2::timestamptz + make_interval(days=>n+1)) AS slice_end
       FROM generate_series(0,6) n
     ) SELECT s.slice_start,s.slice_end,
       (SELECT count(*)::int FROM product_listing_view_events e WHERE e.product_id=$1::uuid AND e.outcome='counted' AND e.created_at>=s.slice_start AND e.created_at<s.slice_end) AS views,
       (SELECT count(*)::int FROM product_outbound_click_events e WHERE e.product_id=$1::uuid AND e.outcome='counted' AND e.created_at>=s.slice_start AND e.created_at<s.slice_end) AS clicks,
       (SELECT coalesce(sum(e.change),0)::int FROM product_community_activity_events e WHERE e.product_id=$1::uuid AND e.event_type='upvote' AND e.created_at>=s.slice_start AND e.created_at<s.slice_end) AS upvotes,
       (SELECT coalesce(sum(e.change),0)::int FROM product_community_activity_events e WHERE e.product_id=$1::uuid AND e.event_type='follow' AND e.created_at>=s.slice_start AND e.created_at<s.slice_end) AS followers,
       (SELECT count(*)::int FROM product_comments c WHERE c.product_id=$1::uuid AND c.hidden_at IS NULL AND c.created_at>=s.slice_start AND c.created_at<s.slice_end) AS comments
     FROM slices s ORDER BY s.slice_start`,
    [productId, start, end],
  );
  const days = rows.rows.map((row) => ({ start: new Date(row.slice_start).toISOString(), end: new Date(row.slice_end).toISOString(), views: Number(row.views), clicks: Number(row.clicks), upvotes: Number(row.upvotes), followers: Number(row.followers), comments: Number(row.comments) }));
  return {
    metrics: {
      views: days.reduce((sum, day) => sum + day.views, 0), clicks: days.reduce((sum, day) => sum + day.clicks, 0),
      netUpvotes: days.reduce((sum, day) => sum + day.upvotes, 0), netFollowers: days.reduce((sum, day) => sum + day.followers, 0),
      comments: days.reduce((sum, day) => sum + day.comments, 0),
    }, days,
  };
}

export async function getProReport(productId: string): Promise<ProReportData | null> {
  return withTransaction(async (client) => {
    // A pre-approval purchase has no reporting window until its real launch exists.
    await client.query(`INSERT INTO pro_result_windows(product_id,entitlement_order_id,anchor_kind,launch_id,starts_at,ends_at,coverage_starts_at,status)
      SELECT e.product_id,e.source_order_id,'future_launch',pl.id,lw.starts_at,lw.starts_at+interval '7 days',c.starts_at,
        CASE WHEN lw.starts_at>now() THEN 'scheduled' ELSE 'in_progress' END
      FROM pro_entitlements e JOIN pro_launch_orders o ON o.id=e.source_order_id
      JOIN products p ON p.id=e.product_id
      JOIN product_launches pl ON pl.product_id=p.id JOIN launch_weeks lw ON lw.id=pl.launch_week_id
      CROSS JOIN pro_reporting_coverage c
      WHERE e.product_id=$1::uuid AND e.status='active' AND o.purchased_before_approval
        AND p.status='published' AND pl.state IN ('scheduled','active','completed')
      ORDER BY lw.starts_at LIMIT 1 ON CONFLICT(product_id) DO NOTHING`, [productId]);
    let rows = await client.query<{
      id: string; product_id: string; name: string; slug: string; anchor_kind: "activation" | "future_launch";
      launch_id: string | null; starts_at: Date; ends_at: Date; coverage_starts_at: Date;
      status: "scheduled" | "in_progress" | "complete"; snapshot: ProReportData | null; last_calculated_at: Date | null;
    }>(
      `SELECT w.id::text,w.product_id::text,p.name,p.slug,w.anchor_kind,w.launch_id::text,w.starts_at,w.ends_at,
              w.coverage_starts_at,w.status,w.snapshot,w.last_calculated_at
       FROM pro_result_windows w JOIN products p ON p.id=w.product_id WHERE w.product_id=$1::uuid FOR UPDATE OF w`,
      [productId],
    );
    let window = rows.rows[0];
    if (!window) return null;
    if (window.anchor_kind === "future_launch") {
      const cancelled = await client.query(`SELECT 1 FROM pro_launch_orders o JOIN product_launches pl ON pl.id=$2::uuid WHERE o.id=(SELECT entitlement_order_id FROM pro_result_windows WHERE id=$1::uuid) AND o.purchased_before_approval AND pl.state='cancelled'`, [window.id, window.launch_id]);
      if (cancelled.rows[0]) {
        await client.query(`DELETE FROM pro_result_windows WHERE id=$1::uuid AND status<>'complete'`, [window.id]);
        if (window.status !== "complete") return null;
      }
    }
    await synchronizeFutureAnchor(client, window);
    rows = await client.query<typeof window>(
      `SELECT w.id::text,w.product_id::text,p.name,p.slug,w.anchor_kind,w.launch_id::text,w.starts_at,w.ends_at,
              w.coverage_starts_at,w.status,w.snapshot,w.last_calculated_at
       FROM pro_result_windows w JOIN products p ON p.id=w.product_id WHERE w.id=$1::uuid FOR UPDATE OF w`, [window.id],
    );
    window = rows.rows[0];
    if (window.status === "complete" && window.snapshot) return window.snapshot;
    const now = new Date(); const start = new Date(window.starts_at); const end = new Date(window.ends_at);
    const status: ProReportData["status"] = now < start ? "scheduled" : now < end ? "in_progress" : "complete";
    const coverageComplete = new Date(window.coverage_starts_at) <= start;
    const calculated = coverageComplete ? await calculate(client, productId, start, end) : { metrics: { views: null, clicks: null, netUpvotes: null, netFollowers: null, comments: null }, days: [] };
    const report: ProReportData = {
      id: window.id, startupName: window.name, slug: window.slug, anchorKind: window.anchor_kind,
      startsAt: start.toISOString(), endsAt: end.toISOString(), status, coverageComplete,
      lastUpdatedAt: now.toISOString(), metrics: calculated.metrics, days: calculated.days,
    };
    if (status === "complete") await client.query(`UPDATE pro_result_windows SET status='complete',snapshot=$2::jsonb,finalized_at=now(),last_calculated_at=now(),updated_at=now() WHERE id=$1::uuid`, [window.id, JSON.stringify(report)]);
    else await client.query(`UPDATE pro_result_windows SET status=$2,last_calculated_at=now(),updated_at=now() WHERE id=$1::uuid`, [window.id, status]);
    return report;
  });
}

export async function finalizeDueProReports(limit = 20): Promise<number> {
  const due = await query<{ product_id: string }>(`SELECT product_id::text FROM pro_result_windows WHERE status<>'complete' AND ends_at<=now() ORDER BY ends_at LIMIT $1`, [limit]);
  let finalized = 0;
  for (const row of due) if ((await getProReport(row.product_id))?.status === "complete") finalized += 1;
  return finalized;
}
