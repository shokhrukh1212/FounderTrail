import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "../lib/db";

async function main() {
  if (process.env.NODE_ENV === "production" || !process.argv.includes("--confirm")) {
    throw new Error("Down migrations require a non-production environment and --confirm");
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [8_140_25_02]);
    const requested = process.argv.find((argument) => /^\d+_.+\.up\.sql$/.test(argument));
    const selected = requested
      ? { name: requested }
      : (await client.query<{ name: string }>(
          `SELECT name FROM schema_migrations ORDER BY applied_at DESC, name DESC LIMIT 1`,
        )).rows[0];
    if (!selected) throw new Error("No applied migration found");
    const downFile = selected.name.replace(/\.up\.sql$/, ".down.sql");
    const available = new Set(readdirSync(join(process.cwd(), "migrations")));
    if (!available.has(downFile)) throw new Error(`Missing down migration ${downFile}`);
    const sql = readFileSync(join(process.cwd(), "migrations", downFile), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query(`DELETE FROM schema_migrations WHERE name = $1`, [selected.name]);
      await client.query("COMMIT");
      console.log(`reverted: ${selected.name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    await client.query(`SELECT pg_advisory_unlock($1)`, [8_140_25_02]).catch(() => {});
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "migration rollback failed");
  process.exit(1);
});
