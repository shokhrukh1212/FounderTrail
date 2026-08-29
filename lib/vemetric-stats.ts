import { config } from "./config";
import { query } from "./db";

const ENDPOINT = "https://api.vemetric.com/v1/analytics/query";

// Vemetric's `interval:auto` only buckets by day for short ranges -- a 3-month range
// comes back grouped by week and a 1-year range by month. Summing either as if it were
// daily would undercount, so the window stays short and every day is stored as it goes.
const WINDOW = "7days";
const DAILY_BUCKET = /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.\d+)?Z$/;

export type VemetricDay = { date: string; users: number; pageviews: number };
export type VisitorStat = { total: number; source: "vemetric" | "first-party"; days: number; syncedAt: string | null };

export function vemetricStatsConfigured(): boolean {
  return Boolean(config.vemetric.apiKey);
}

/** Recent daily buckets. Throws rather than returning buckets that are not whole UTC days. */
export async function fetchVemetricDailyUsers(): Promise<VemetricDay[]> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: `Bearer ${config.vemetric.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ dateRange: WINDOW, metrics: ["users", "pageviews"], groupBy: ["interval:auto"], limit: 100 }),
    signal: AbortSignal.timeout(6_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Vemetric query failed with ${response.status}`);
  const body = await response.json() as { data?: Array<{ group?: { date?: unknown }; metrics?: { users?: unknown; pageviews?: unknown } }> };
  const rows = Array.isArray(body.data) ? body.data : [];
  return rows.map((row) => {
    const date = row.group?.date;
    const users = row.metrics?.users;
    if (typeof date !== "string" || !DAILY_BUCKET.test(date)) {
      throw new Error(`Vemetric returned a non-daily bucket (${String(date)}); refusing to store it as a day`);
    }
    if (typeof users !== "number" || !Number.isFinite(users) || users < 0) {
      throw new Error(`Vemetric returned an unusable user count for ${date}`);
    }
    const pageviews = row.metrics?.pageviews;
    return {
      date: date.slice(0, 10),
      users: Math.round(users),
      pageviews: typeof pageviews === "number" && pageviews >= 0 ? Math.round(pageviews) : 0,
    };
  });
}

/** Upserts the recent window. Today's row keeps moving until the day closes. */
export async function syncVemetricDailyVisitors(): Promise<number> {
  if (!vemetricStatsConfigured()) return 0;
  const days = await fetchVemetricDailyUsers();
  for (const day of days) {
    await query(
      `INSERT INTO vemetric_daily_visitors (metric_date,users,pageviews)
       VALUES ($1::date,$2,$3)
       ON CONFLICT (metric_date) DO UPDATE SET users=EXCLUDED.users,pageviews=EXCLUDED.pageviews,synced_at=now()`,
      [day.date, day.users, day.pageviews],
    );
  }
  return days.length;
}

export async function storedVemetricTotal(): Promise<{ total: number; days: number; syncedAt: string | null }> {
  const rows = await query<{ total: number; days: number; synced_at: Date | null }>(
    `SELECT coalesce(sum(users),0)::int AS total, count(*)::int AS days, max(synced_at) AS synced_at FROM vemetric_daily_visitors`,
  );
  const row = rows[0];
  return { total: row?.total ?? 0, days: row?.days ?? 0, syncedAt: row?.synced_at?.toISOString() ?? null };
}

/** Syncs when the stored window has gone stale, then reports whatever survived. */
export async function refreshVemetricTotal(maxAgeSeconds = 60): Promise<{ total: number; days: number; syncedAt: string | null }> {
  const stored = await storedVemetricTotal();
  const age = stored.syncedAt ? (Date.now() - Date.parse(stored.syncedAt)) / 1000 : Number.POSITIVE_INFINITY;
  if (!vemetricStatsConfigured() || age < maxAgeSeconds) return stored;
  try {
    await syncVemetricDailyVisitors();
  } catch (error) {
    // A stale total beats no total; the admin chip shows when it was last synced.
    console.error("vemetric sync failed", error instanceof Error ? error.message : "unknown error");
    return stored;
  }
  return storedVemetricTotal();
}
