import { createHash } from "node:crypto";
import { getPool } from "../lib/db";

const origin = (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
const selectedEnvironment = process.env.NODE_ENV || (local ? "local" : "unspecified");
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

function present(name: string, minimum = 1) {
  const value = process.env[name]?.trim() ?? "";
  return { name, present: value.length >= minimum };
}

function databaseFingerprint() {
  try {
    const value = new URL(databaseUrl);
    return createHash("sha256").update(`${value.hostname}/${value.pathname}`).digest("hex").slice(0, 12);
  } catch {
    return null;
  }
}

async function main() {
const report = {
  selectedEnvironment,
  publicOrigin: origin,
  googleCallback: `${origin}/api/auth/callback/google`,
  database: { configured: Boolean(databaseUrl), reachable: false, fingerprint: databaseFingerprint(), latestMigration: null as string | null },
  auth: [present("AUTH_SECRET", 32), present("GOOGLE_CLIENT_ID"), present("GOOGLE_CLIENT_SECRET")],
  admin: { verifiedGoogleAdministrators: 0 },
  ready: false,
};

let openedPool = false;
try {
  if (databaseUrl) {
    const pool = getPool();
    openedPool = true;
    await pool.query("SELECT 1");
    report.database.reachable = true;
    const migration = await pool.query<{ name: string }>("SELECT name FROM schema_migrations ORDER BY applied_at DESC,name DESC LIMIT 1").catch(() => ({ rows: [] as Array<{ name: string }> }));
    report.database.latestMigration = migration.rows[0]?.name ?? null;
    const admins = await pool.query<{ count: number }>(`SELECT count(DISTINCT u.id)::int AS count
      FROM app_users u JOIN auth_accounts a ON a.user_id=u.id AND a.provider_id='google'
      WHERE u.role='admin' AND u.email_verified AND u.deleted_at IS NULL`).catch(() => ({ rows: [{ count: 0 }] }));
    report.admin.verifiedGoogleAdministrators = admins.rows[0]?.count ?? 0;
  }
} catch (error) {
  Object.assign(report.database, { error: error instanceof Error ? error.message.replace(databaseUrl, "[connection hidden]").slice(0, 240) : "Connection failed" });
} finally {
  if (openedPool) await getPool().end();
}

report.ready = report.database.reachable
  && report.auth.every((item) => item.present)
  && report.admin.verifiedGoogleAdministrators > 0;

console.log(JSON.stringify(report, null, 2));
if (!report.ready) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Readiness check failed.");
  process.exit(1);
});
