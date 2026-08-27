import type { PoolClient } from "pg";

export async function consumeRateLimit(
  client: PoolClient,
  input: { action: string; keyHash: string; limit: number; windowSeconds: number },
): Promise<boolean> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${input.action}:${input.keyHash}`]);
  const rows = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM api_rate_limit_events
      WHERE action = $1 AND key_hash = $2
        AND created_at >= now() - ($3::text || ' seconds')::interval`,
    [input.action, input.keyHash, input.windowSeconds],
  );
  if ((rows.rows[0]?.count ?? 0) >= input.limit) return false;
  await client.query(
    `INSERT INTO api_rate_limit_events (action, key_hash) VALUES ($1, $2)`,
    [input.action, input.keyHash],
  );
  return true;
}
