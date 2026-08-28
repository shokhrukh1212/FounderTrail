import "server-only";
import { withTransaction } from "./db";

/** Removes short-lived anti-duplication identifiers after daily aggregates are durable. */
export async function cleanupPartnerTracking(): Promise<{ eventIds: number; visitorHashes: number; rateLimits: number }> {
  return withTransaction(async (client) => {
    const [eventIds, visitors, rateLimits] = await Promise.all([
      client.query(`DELETE FROM product_traffic_event_ids WHERE created_at < now() - interval '2 days'`),
      client.query(`DELETE FROM product_daily_visitors WHERE metric_date < (now() AT TIME ZONE 'UTC')::date - 2`),
      client.query(`DELETE FROM api_rate_limit_events WHERE created_at < now() - interval '2 days'`),
    ]);
    return { eventIds: eventIds.rowCount ?? 0, visitorHashes: visitors.rowCount ?? 0, rateLimits: rateLimits.rowCount ?? 0 };
  });
}
