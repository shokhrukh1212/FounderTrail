/**
 * Database contract checks.
 *
 * These are the invariants that source-text assertions cannot prove: real constraint
 * behaviour, real parameter-type inference, real concurrency. Everything runs inside a
 * transaction that is ALWAYS rolled back, and the script never commits.
 *
 * Prefers TEST_DATABASE_URL. It will fall back to DATABASE_URL because every statement is
 * rolled back, but it says loudly which database it used.
 *
 * Run: npx tsx --env-file=.env.local scripts/db-contract-check.ts
 */
import { createHash, randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";

const connectionString = process.env.TEST_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
if (!connectionString) {
  console.error("Set TEST_DATABASE_URL (preferred) or DATABASE_URL.");
  process.exit(1);
}
const usingTestDatabase = Boolean(process.env.TEST_DATABASE_URL?.trim());

/** Hostname only -- never the credentials. */
function hostOf(connection: string): string {
  try { return new URL(connection).hostname; } catch { return ""; }
}

let passed = 0;
let failed = 0;

function describe(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const e = error as Record<string, unknown>;
  return ["code", "message", "constraint", "detail"]
    .map((key) => (e[key] ? `${key}=${String(e[key])}` : ""))
    .filter(Boolean)
    .join(" ");
}

function record(ok: boolean, name: string, detail = ""): void {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? `\n         ${detail}` : ""}`);
}

/** Each check gets its own savepoint so one failure cannot abort the others. */
async function check(client: PoolClient, name: string, fn: () => Promise<string | void>): Promise<void> {
  await client.query("SAVEPOINT c");
  try {
    const detail = await fn();
    await client.query("RELEASE SAVEPOINT c");
    record(true, name, detail || "");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT c");
    record(false, name, describe(error));
  }
}

/** Assert that fn is rejected by a specific constraint. Here a rejection is the pass. */
async function checkRejects(client: PoolClient, name: string, constraint: string, fn: () => Promise<unknown>): Promise<void> {
  await client.query("SAVEPOINT c");
  try {
    await fn();
    await client.query("RELEASE SAVEPOINT c");
    record(false, name, "the statement was accepted but should have been rejected");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT c");
    const actual = (error as { constraint?: string }).constraint;
    record(actual === constraint, name, actual === constraint ? `rejected by ${actual}` : describe(error));
  }
}

async function claimContracts(client: PoolClient): Promise<void> {
  console.log("\nOwnership claims\n");
  const product = await client.query<{ id: string; slug: string }>(
    "SELECT id::text,slug FROM products WHERE status='published' ORDER BY created_at LIMIT 1",
  );
  const user = await client.query<{ id: string }>(
    "SELECT id FROM app_users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1",
  );
  if (!product.rows[0] || !user.rows[0]) {
    record(false, "fixtures available", `published products=${product.rowCount} accounts=${user.rowCount}`);
    return;
  }
  const productId = product.rows[0].id;
  const userId = user.rows[0].id;
  const tokenHash = createHash("sha256").update(randomBytes(24)).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Clear any real pending claim inside the rolled-back transaction so the checks below
  // start from a known state without touching committed data.
  await client.query("DELETE FROM product_claims WHERE product_id=$1::uuid AND state='pending'", [productId]);

  let claimId = "";
  await check(client, "domain_file claim insert (route SQL)", async () => {
    const inserted = await client.query<{ id: string; evidence_method: string }>(
      `INSERT INTO product_claims(product_id,requester_id,evidence_method,challenge_token_hash,challenge_expires_at,evidence)
       VALUES($2::uuid,$3,$4,$5,$6,jsonb_build_object('competing_owner',$1::boolean)) RETURNING id::text,evidence_method`,
      [false, productId, userId, "domain_file", tokenHash, expiresAt],
    );
    claimId = inserted.rows[0]!.id;
    return `evidence_method=${inserted.rows[0]!.evidence_method}`;
  });

  await checkRejects(client, "a second pending claim is refused", "product_claim_pending_idx", () =>
    client.query(
      `INSERT INTO product_claims(product_id,requester_id,evidence_method,challenge_token_hash,challenge_expires_at,evidence)
       VALUES($2::uuid,$3,$4,$5,$6,jsonb_build_object('competing_owner',$1::boolean))`,
      [false, productId, userId, "domain_file", tokenHash, expiresAt],
    ));

  await check(client, "manual-review fallback keeps prior evidence (route SQL)", async () => {
    await client.query(
      `UPDATE product_claims SET evidence=jsonb_build_object('source','new_submission') WHERE id=$1::uuid`, [claimId]);
    const updated = await client.query<{ evidence: Record<string, unknown>; evidence_method: string; challenge_token_hash: string | null }>(
      `UPDATE product_claims SET evidence_method=$2,challenge_token_hash=$3,challenge_expires_at=$4,
              evidence=evidence || jsonb_build_object('competing_owner',$1::boolean,'manual_review_requested',true),updated_at=now()
       WHERE id=$5::uuid RETURNING evidence,evidence_method,challenge_token_hash`,
      [false, "manual_admin", null, null, claimId],
    );
    const row = updated.rows[0]!;
    if (row.evidence.source !== "new_submission") throw new Error("the original evidence.source was lost");
    if (row.evidence.manual_review_requested !== true) throw new Error("manual_review_requested was not recorded");
    if (row.challenge_token_hash !== null) throw new Error("a manual-review claim must carry no challenge");
    return `evidence_method=${row.evidence_method} evidence keys=${Object.keys(row.evidence).sort().join(",")}`;
  });

  await check(client, "upvote audit insert (route SQL)", async () => {
    await client.query(
      `INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details)
       VALUES($1,'user',$2,$3::uuid,jsonb_build_object('active',$4::boolean,'launchEligible',$5::boolean))`,
      [userId, "product_upvote_set", productId, true, false],
    );
  });

  await check(client, "admin claim-review audit insert (route SQL)", async () => {
    await client.query(
      `INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,claim_id,details)
       VALUES($1,'admin',$2,$3::uuid,$4::uuid,jsonb_build_object('reason',$5::text))`,
      [userId, "product.claim.approved", productId, claimId, "verified by domain file"],
    );
  });
}


async function sponsorContracts(client: PoolClient): Promise<void> {
  console.log("\nSponsor inventory\n");
  const product = await client.query<{ id: string }>("SELECT id::text FROM products WHERE status='published' ORDER BY created_at LIMIT 1");
  const user = await client.query<{ id: string }>("SELECT id FROM app_users WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1");
  if (!product.rows[0] || !user.rows[0]) { record(false, "sponsor fixtures available"); return; }
  const productId = product.rows[0].id;
  const userId = user.rows[0].id;

  // Far enough out that a real booking cannot collide with these rolled-back rows. Each
  // check gets its own week, because a check that succeeds keeps its rows for the rest of
  // the transaction and would otherwise occupy the slot the next one needs.
  const origin = Date.UTC(2099, 0, 6);
  let week = 0;
  const nextWeek = () => new Date(origin + (week++) * 60 * 86_400_000);
  const book = (slot: number, days: number, from: Date, priceMinor = 2000, endOverride?: Date) => {
    const end = endOverride ?? new Date(from.getTime() + days * 86_400_000);
    return client.query(
      `INSERT INTO sponsor_bookings(product_id,purchaser_id,start_at,end_at,slot_index,duration_days,price_minor,currency,
                                    creative_name,creative_tagline,destination_url,provider_environment,booking_status)
       VALUES($1::uuid,$2,$3,$4,$5,$6,$7,'USD','Contract check','A contract check row','https://example.com','test_mode','held')`,
      [productId, userId, from, end, slot, days, priceMinor],
    );
  };

  const shared = nextWeek();
  await check(client, "three 7-day sponsors can share one week", async () => {
    await book(0, 7, shared); await book(1, 7, shared); await book(2, 7, shared);
    const count = await client.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM sponsor_bookings WHERE start_at=$1 AND booking_status='held'", [shared]);
    if (count.rows[0]!.n !== "3") throw new Error(`expected 3 concurrent slots, got ${count.rows[0]!.n}`);
    return "slots 0, 1 and 2 all booked for the same interval";
  });

  await checkRejects(client, "a fourth overlapping sponsor is impossible", "sponsor_bookings_slot_index_check",
    () => book(3, 7, shared));

  const contested = nextWeek();
  await checkRejects(client, "two sponsors cannot share one slot", "sponsor_bookings_slot_no_overlap", async () => {
    await book(0, 7, contested); await book(0, 7, contested);
  });

  const adjacent = nextWeek();
  await check(client, "adjacent weeks in the same slot are allowed", async () => {
    await book(0, 7, adjacent);
    await book(0, 7, new Date(adjacent.getTime() + 7 * 86_400_000));
    return "[start,end) and [end,next) do not collide";
  });

  const monthly = nextWeek();
  await check(client, "a 30-day placement is accepted", async () => {
    await book(0, 30, monthly, 6000);
    return "duration_days=30 at 6000 minor";
  });

  await checkRejects(client, "end_at must match duration_days", "sponsor_bookings_duration_matches_interval",
    () => book(0, 30, nextWeek(), 6000, new Date(origin + 7 * 86_400_000)));

  await checkRejects(client, "a duration outside the allowed range is refused", "sponsor_bookings_duration_days_check",
    () => book(0, 400, nextWeek(), 6000));

  const legacy = nextWeek();
  await check(client, "historical USD 9.00 bookings remain valid", async () => {
    await book(0, 7, legacy, 900);
    return "price_minor=900 still accepted";
  });

  const free = nextWeek();
  await check(client, "an audited complimentary campaign needs no fake payment", async () => {
    await book(0, 7, free, 0);
    await client.query(
      `UPDATE sponsor_bookings SET payment_status='complimentary',complimentary_reason=$2 WHERE start_at=$1 AND price_minor=0`,
      [free, "Contract check: audited complimentary placement"]);
    return "price_minor=0 with payment_status='complimentary'";
  });
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: connectionString!.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full"), options: "-c timezone=UTC", max: 2 });
  const info = await pool.query<{ name: string }>("SELECT current_database() AS name");
  console.log(`\ndatabase=${info.rows[0]?.name} host=${hostOf(connectionString!)} source=${usingTestDatabase ? "TEST_DATABASE_URL" : "DATABASE_URL (rollback only)"}`);
  if (usingTestDatabase) {
    const live = hostOf(process.env.DATABASE_URL ?? "");
    console.log(live && live === hostOf(connectionString!)
      ? "WARNING: TEST_DATABASE_URL points at the same host as DATABASE_URL"
      : `separate from DATABASE_URL host=${live || "unset"}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await claimContracts(client);
    await sponsorContracts(client);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
  }
  await pool.end();
  console.log(`\n${passed} passed, ${failed} failed -- transaction rolled back, nothing written\n`);
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error("contract check failed:", describe(error));
  process.exit(1);
});
