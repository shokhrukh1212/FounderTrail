/**
 * Read-only claim diagnostic.
 *
 * Phase A runs pure parameter-inference probes that touch no table at all.
 * Phase B replays the exact SQL from app/api/products/[slug]/claims/route.ts
 * inside a transaction that is ALWAYS rolled back -- this script never commits.
 * Each replay runs inside its own SAVEPOINT so one failure cannot mask the next.
 *
 * Run: npx tsx --env-file=.env.local scripts/diagnose-claim.ts
 */
import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../lib/db";

function describe(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const e = error as Record<string, unknown>;
  return ["code", "message", "constraint", "detail", "hint"]
    .map((key) => (e[key] ? `${key}=${String(e[key])}` : ""))
    .filter(Boolean)
    .join("\n      ");
}

function line(ok: boolean, name: string, detail: string): void {
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}\n      ${detail}\n`);
}

/** Run one probe in its own savepoint so an expected failure does not abort the rest. */
async function attempt<T>(client: PoolClient, name: string, fn: () => Promise<T>): Promise<T | null> {
  await client.query("SAVEPOINT probe");
  try {
    const out = await fn();
    await client.query("RELEASE SAVEPOINT probe");
    return out;
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT probe");
    line(false, name, describe(error));
    return null;
  }
}

async function main(): Promise<void> {
  const pool = getPool();
  const db = await pool.query<{ name: string; version: string }>(
    "SELECT current_database() AS name, current_setting('server_version') AS version",
  );
  console.log(`\ndatabase=${db.rows[0]?.name} postgres=${db.rows[0]?.version}\n`);

  console.log("A. Parameter-type inference (no table is read or written)\n");
  const probes: Array<[string, string, unknown[]]> = [
    ["jsonb_build_object, UNCAST boolean param -- the shipped claims-route shape", "SELECT jsonb_build_object('competing_owner',$1) AS v", [true]],
    ["jsonb_build_object, CAST boolean param -- the fix", "SELECT jsonb_build_object('competing_owner',$1::boolean) AS v", [true]],
    ["jsonb_build_object, UNCAST text param -- the shipped admin-claims shape", "SELECT jsonb_build_object('reason',$1) AS v", ["example"]],
    ["jsonb_build_object, two UNCAST params -- the shipped upvote shape", "SELECT jsonb_build_object('active',$1,'launchEligible',$2) AS v", [true, false]],
  ];
  for (const [name, sql, params] of probes) {
    try {
      const result = await pool.query(sql, params);
      line(true, name, `returned ${JSON.stringify(result.rows[0]?.v)}`);
    } catch (error) {
      line(false, name, describe(error));
    }
  }

  console.log("B. Replay of the real claim transaction (always rolled back)\n");
  const product = await pool.query<{ id: string; slug: string }>(
    "SELECT id::text,slug FROM products WHERE status='published' ORDER BY created_at LIMIT 1",
  );
  const user = await pool.query<{ id: string }>(
    "SELECT id FROM app_users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1",
  );
  const target = product.rows[0];
  const actor = user.rows[0];
  if (!target || !actor) {
    console.log(`  skipped: published products=${product.rowCount} active accounts=${user.rowCount}\n`);
    await pool.end();
    return;
  }
  console.log(`  using product slug=${target.slug} and one existing account (id withheld)\n`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tokenHash = createHash("sha256").update(randomBytes(24)).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const owned = await client.query<{ user_id: string }>(
      "SELECT user_id FROM product_owners WHERE product_id=$1::uuid FOR UPDATE",
      [target.id],
    );
    line(true, "SELECT product_owners ... FOR UPDATE", `${owned.rowCount} owner row(s)`);
    const competing = owned.rows.length > 0;

    await attempt(client, "INSERT product_claims -- shipped SQL, UNCAST $5", async () => {
      await client.query(
        `INSERT INTO product_claims(product_id,requester_id,evidence_method,challenge_token_hash,challenge_expires_at,evidence)
         VALUES($1::uuid,$2,'domain_file',$3,$4,jsonb_build_object('competing_owner',$5)) RETURNING id::text`,
        [target.id, actor.id, tokenHash, expiresAt, competing],
      );
      line(true, "INSERT product_claims -- shipped SQL, UNCAST $5", "insert succeeded (bug not reproduced)");
    });

    const created = await attempt(client, "INSERT product_claims -- FIXED, $5::boolean", async () => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO product_claims(product_id,requester_id,evidence_method,challenge_token_hash,challenge_expires_at,evidence)
         VALUES($1::uuid,$2,'domain_file',$3,$4,jsonb_build_object('competing_owner',$5::boolean)) RETURNING id::text`,
        [target.id, actor.id, tokenHash, expiresAt, competing],
      );
      const id = inserted.rows[0]!.id;
      line(true, "INSERT product_claims -- FIXED, $5::boolean", "claim created");
      return id;
    });

    if (created) {
      await attempt(client, "repeat start reuses the single pending claim", async () => {
        const pending = await client.query<{ id: string }>(
          `SELECT id::text FROM product_claims WHERE product_id=$1::uuid AND state='pending' FOR UPDATE`,
          [target.id],
        );
        const reused = pending.rowCount === 1 && pending.rows[0]!.id === created;
        line(reused, "repeat start reuses the single pending claim", `${pending.rowCount} pending row(s)`);
        await client.query(
          `UPDATE product_claims SET evidence_method='domain_file',challenge_token_hash=$1,challenge_expires_at=$2,
                  evidence=jsonb_build_object('competing_owner',$3::boolean),updated_at=now() WHERE id=$4::uuid`,
          [tokenHash, expiresAt, competing, created],
        );
        line(true, "UPDATE product_claims -- FIXED, $3::boolean", "update succeeded");
      });

      // Here a rejection is the pass, so this probe is inverted on purpose.
      await client.query("SAVEPOINT probe");
      try {
        await client.query(
          `INSERT INTO product_claims(product_id,requester_id,evidence_method,challenge_token_hash,challenge_expires_at,evidence)
           VALUES($1::uuid,$2,'domain_file',$3,$4,jsonb_build_object('competing_owner',$5::boolean))`,
          [target.id, actor.id, tokenHash, expiresAt, competing],
        );
        await client.query("RELEASE SAVEPOINT probe");
        line(false, "product_claim_pending_idx blocks a second pending claim", "a duplicate pending claim was accepted");
      } catch (error) {
        await client.query("ROLLBACK TO SAVEPOINT probe");
        const code = (error as { constraint?: string }).constraint;
        line(code === "product_claim_pending_idx", "product_claim_pending_idx blocks a second pending claim",
          `rejected by ${code ?? "an unexpected error"}`);
      }
    }
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    console.log("  transaction rolled back; nothing was written\n");
  }
  await pool.end();
}

main().catch((error) => {
  console.error("diagnostic failed:", describe(error));
  process.exit(1);
});
