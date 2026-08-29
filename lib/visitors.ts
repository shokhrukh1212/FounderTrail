import type { PoolClient } from "pg";
import { query } from "./db";
import { refreshVemetricTotal, type VisitorStat, vemetricStatsConfigured } from "./vemetric-stats";

// One row per visitor per UTC day, so a returning browser is counted again the next day.
// Rows only exist for eligible visits, which is why no `eligible` filter is needed here.
export const ALL_TIME_VISITOR_COUNT_SQL = `SELECT count(*)::int AS count FROM visitor_days`;

export async function countAllTimeVisitors(client: PoolClient): Promise<number> {
  const rows = await client.query<{ count: number }>(ALL_TIME_VISITOR_COUNT_SQL);
  return rows.rows[0]?.count ?? 0;
}

export async function getVisitorTotal(): Promise<number> {
  const rows = await query<{ count: number }>(ALL_TIME_VISITOR_COUNT_SQL);
  return Number(rows[0]?.count ?? 0);
}

/**
 * What the admin header shows. Vemetric sees every visitor from the moment the page
 * loads, including the traffic that predates our own tracker, so it wins when present;
 * `visitor_days` stays the fallback for when the key is missing or the sync is empty.
 */
export async function getAdminVisitorStat(): Promise<VisitorStat> {
  if (vemetricStatsConfigured()) {
    const vemetric = await refreshVemetricTotal();
    if (vemetric.days > 0) return { total: vemetric.total, source: "vemetric", days: vemetric.days, syncedAt: vemetric.syncedAt };
  }
  return { total: await getVisitorTotal(), source: "first-party", days: 0, syncedAt: null };
}
