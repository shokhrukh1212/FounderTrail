/**
 * Creates the legacy schema in a brand-new, disposable database.
 *
 * This command is deliberately separate from `npm run migrate`: the legacy schema
 * contains historical data corrections and must never be replayed as part of a
 * normal production migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "../lib/db";

async function main() {
  if (process.env.CONFIRM_EMPTY_DATABASE !== "true") {
    throw new Error("Set CONFIRM_EMPTY_DATABASE=true only for a new disposable database.");
  }
  const pool = getPool();
  const existing = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE'`,
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0) {
    throw new Error("Refusing to bootstrap a database that already contains tables.");
  }
  await pool.query(readFileSync(join(process.cwd(), "lib", "schema.sql"), "utf8"));
  console.log("legacy bootstrap schema applied; run npm run migrate next");
  await pool.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "bootstrap failed");
  process.exit(1);
});
