import type { PoolClient } from "pg";
import { insertFunnelEvent } from "./analytics";
import { launchWeek, parseLaunchChoice } from "./launch-policy";

/** Caller holds the product row lock. One launch per product is enforced in Postgres. */
export async function saveLaunch(client: PoolClient, productId: string, userId: string, choice: unknown, instant: unknown, reschedule = false) {
  const clock = await client.query<{ now: Date }>(`SELECT clock_timestamp() AS now`);
  const now = new Date(clock.rows[0].now);
  const selected = parseLaunchChoice(choice, instant, now);
  const rows = await client.query<{ id: string; starts_at: Date; state: string }>(`SELECT id::text,starts_at,state FROM product_launches WHERE product_id=$1::uuid FOR UPDATE`, [productId]);
  const previous = rows.rows[0];
  if (previous && previous.state !== "cancelled" && !reschedule) return previous;
  if (previous && (previous.state === "completed" || (previous.state !== "cancelled" && new Date(previous.starts_at) <= now))) throw new Error("A launch that has started cannot be changed or repeated.");
  if (!selected.startsAt) {
    if (previous && previous.state !== "cancelled") {
      await client.query(`UPDATE product_launches SET state='cancelled' WHERE id=$1::uuid`, [previous.id]);
      await insertFunnelEvent(client, { name: "launch_cancelled", idempotencyKey: `${previous.id}:${previous.starts_at.toISOString()}`, eventData: { productId } });
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id) VALUES($1,'user','launch_cancelled',$2::uuid)`, [userId, productId]);
    }
    return null;
  }
  const week = launchWeek(selected.startsAt);
  const weeks = await client.query<{ id: string }>(`INSERT INTO launch_weeks(starts_at,ends_at,state) VALUES($1,$2,$3) ON CONFLICT(starts_at) DO UPDATE SET ends_at=excluded.ends_at RETURNING id::text`, [week.startsAt, week.endsAt, selected.startsAt <= now ? "active" : "scheduled"]);
  const launch = await client.query<{ id: string; starts_at: Date; state: string }>(`INSERT INTO product_launches(product_id,launch_week_id,state,approved_at,starts_at) VALUES($1::uuid,$2::uuid,$3,$4,$4)
    ON CONFLICT(product_id) DO UPDATE SET launch_week_id=excluded.launch_week_id,state=excluded.state,starts_at=excluded.starts_at,approved_at=excluded.approved_at RETURNING id::text,starts_at,state`, [productId, weeks.rows[0].id, selected.startsAt <= now ? "active" : "scheduled", selected.startsAt]);
  const event = selected.choice === "now" ? "launch_now_completed" : previous ? "launch_rescheduled" : "launch_scheduled";
  await insertFunnelEvent(client, { name: event, idempotencyKey: `${launch.rows[0].id}:${selected.startsAt.toISOString()}`, eventData: { productId, startsAt: selected.startsAt.toISOString() } });
  await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details) VALUES($1,'user',$2,$3::uuid,jsonb_build_object('startsAt',$4::text))`, [userId, event, productId, selected.startsAt.toISOString()]);
  return launch.rows[0];
}
