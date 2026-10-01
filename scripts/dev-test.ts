import { spawn } from "node:child_process";
import { setDefaultResultOrder } from "node:dns";
import { createRequire } from "node:module";
import { setDefaultAutoSelectFamily } from "node:net";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));
const { loadEnvConfig } = nextRequire("@next/env") as typeof import("@next/env");

const setupInstructions = "Set TEST_DATABASE_URL in .env.local to an isolated PostgreSQL database, then run npm run migrate:test and npm run dev:test. See README.md (Local test database).";

export function testConnectionString(env: Record<string, string | undefined>): string {
  const connectionString = env.TEST_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error(`TEST_DATABASE_URL is not set. ${setupInstructions}`);
  }
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) {
      throw new Error("Invalid PostgreSQL URL");
    }
  } catch {
    throw new Error(`TEST_DATABASE_URL must be a PostgreSQL connection URL with a database name. ${setupInstructions}`);
  }
  return connectionString;
}

const requiredColumns: Record<string, string[]> = {
  products: ["launch_choice", "requested_launch_at", "legacy_contact_email"],
  product_launches: ["starts_at"],
  product_identities: ["identity", "product_id"],
  product_activation: ["product_id", "post_draft", "share_state", "composer_opened_at"],
  product_access_tokens: ["token_hash", "product_id", "claimant_id", "expires_at", "consumed_at"],
  app_users: ["google_authority_email", "google_authority_at"],
};

type DatabaseClient = {
  connect(): Promise<unknown>;
  query(sql: string, params: unknown[]): Promise<{ rows: { table_name: string; column_name: string }[] }>;
  end(): Promise<unknown>;
};

export async function checkTestDatabase(
  connectionString: string,
  createClient: (url: string) => DatabaseClient = (url) => new Client({
    connectionString: url.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full"),
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
    options: "-c timezone=UTC",
  }),
): Promise<void> {
  let client: DatabaseClient | undefined;
  let columns: { table_name: string; column_name: string }[];
  try {
    client = createClient(connectionString);
    await client.connect();
    // Read-only startup check. Applying migrations remains an explicit command.
    const result = await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [Object.keys(requiredColumns)],
    );
    columns = result.rows;
  } catch (error) {
    // Driver messages can include connection details. Only emit a diagnostic code.
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "connection failed";
    const safeCode = /^[A-Z0-9_]{2,30}$/.test(code) ? code : "connection failed";
    throw new Error(`Cannot connect to the test database (${safeCode}). Check TEST_DATABASE_URL and that the database is running and reachable.`);
  } finally {
    await client?.end().catch(() => {});
  }
  const existing = new Set(columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`));
  const missing = Object.entries(requiredColumns).flatMap(([table, names]) => names
    .filter((name) => !existing.has(`${table}.${name}`)).map((name) => `${table}.${name}`));
  if (missing.length) {
    throw new Error(`The test database needs the instant-launch migration (020). Run npm run migrate:test, then npm run dev:test. Missing: ${missing.join(", ")}.`);
  }
}

async function main(): Promise<void> {
  // Set before loading .env files so development always uses the test database.
  process.env.USE_TEST_DATABASE = "true";
  loadEnvConfig(process.cwd(), true);
  setDefaultResultOrder("ipv4first");
  setDefaultAutoSelectFamily(false);
  await checkTestDatabase(testConnectionString(process.env));
  console.log("Test database is ready. Starting Next.js…");
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
  const stop = (signal: NodeJS.Signals) => child.kill(signal);
  const interrupt = () => stop("SIGINT");
  const terminate = () => stop("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  const cleanup = () => {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  };
  child.on("error", () => {
    cleanup();
    console.error("[dev:test] Could not start Next.js.");
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    cleanup();
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 143);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: Error) => {
    console.error(`[dev:test] ${error.message}`);
    process.exitCode = 1;
  });
}
