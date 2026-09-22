import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { databaseHost, getPool } from "../lib/db";

async function main() {
  // Say out loud which database is about to be changed. A migration pointed at the wrong
  // host is the expensive mistake here, and the host is not a secret.
  console.log(`migrating ${databaseHost()}${process.env.USE_TEST_DATABASE === "true" ? " (rehearsal branch)" : ""}`);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(`SELECT pg_advisory_lock($1)`, [8_140_25_02]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const directory = join(process.cwd(), "migrations");
    const files = readdirSync(directory).filter((file) => /^\d+_.+\.up\.sql$/.test(file)).sort();
    for (const file of files) {
      const sql = readFileSync(join(directory, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        `SELECT checksum FROM schema_migrations WHERE name = $1`,
        [file],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Applied migration ${file} has changed`);
        }
        console.log(`already applied: ${file}`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)`,
          [file, checksum],
        );
        await client.query("COMMIT");
        console.log(`applied: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query(`SELECT pg_advisory_unlock($1)`, [8_140_25_02]).catch(() => {});
    client.release();
  }

  const tables = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log("tables:", tables.rows.map((t) => t.table_name).join(", "));
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
