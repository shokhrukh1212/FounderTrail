/**
 * Creates or compares a privacy-safe migration baseline.
 *
 * Raw contacts, tokens, URLs and descriptions never enter the report. Stable hashes
 * prove that protected values survived while table counts and product relationships
 * make additions or losses visible. Reports belong under the ignored backups folder.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getPool } from "../lib/db";

type ProductFingerprint = {
  id: string;
  slugHash: string;
  urlHash: string;
  contactHash: string;
  ownerHash: string | null;
  legacyVotes: number;
  outboundClicks: number;
  media: number;
  updates: number;
};

type Report = {
  format: 1;
  capturedAt: string;
  databaseFingerprint: string;
  schemaMigrations: string[];
  tableCounts: Record<string, number>;
  products: ProductFingerprint[];
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function connectionFingerprint(): string {
  const raw = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  try {
    const url = new URL(raw);
    return digest(`${url.hostname}/${url.pathname.replace(/^\//, "")}`).slice(0, 16);
  } catch {
    return "unconfigured";
  }
}

async function capture(): Promise<Report> {
  const pool = getPool();
  const tableRows = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
  );
  const tableCounts: Record<string, number> = {};
  for (const { table_name } of tableRows.rows) {
    if (!/^[a-z_][a-z0-9_]*$/.test(table_name)) throw new Error("Unsafe table identifier");
    const result = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM "${table_name}"`);
    tableCounts[table_name] = result.rows[0]?.count ?? 0;
  }
  const products = await pool.query<{
    id: string; slug: string; website_url: string; contact_email: string;
    token_hash: string | null; legacy_votes: number; outbound_clicks: number;
    media: number; updates: number;
  }>(`SELECT p.id::text,p.slug,p.website_url,p.contact_email,o.token_hash,
      (SELECT count(*)::int FROM product_votes v WHERE v.product_id=p.id) AS legacy_votes,
      (SELECT count(*)::int FROM product_outbound_click_events e WHERE e.product_id=p.id AND e.outcome='counted') AS outbound_clicks,
      (SELECT count(*)::int FROM product_media m WHERE m.product_id=p.id) AS media,
      (SELECT count(*)::int FROM product_updates u WHERE u.product_id=p.id) AS updates
    FROM products p LEFT JOIN product_owner_credentials o ON o.product_id=p.id
    ORDER BY p.id`);
  const migrations = await pool.query<{ name: string }>(
    `SELECT name FROM schema_migrations ORDER BY name`,
  ).catch(() => ({ rows: [] as Array<{ name: string }> }));
  return {
    format: 1,
    capturedAt: new Date().toISOString(),
    databaseFingerprint: connectionFingerprint(),
    schemaMigrations: migrations.rows.map((row) => row.name),
    tableCounts,
    products: products.rows.map((row) => ({
      id: row.id,
      slugHash: digest(row.slug),
      urlHash: digest(row.website_url),
      contactHash: digest(row.contact_email.trim().toLowerCase()),
      ownerHash: row.token_hash ? digest(row.token_hash) : null,
      legacyVotes: row.legacy_votes,
      outboundClicks: row.outbound_clicks,
      media: row.media,
      updates: row.updates,
    })),
  };
}

async function recordReconciliation(before:Report,after:Report,failures:string[],artifactHash:string){
  await getPool().query(`INSERT INTO migration_reconciliation_runs(database_fingerprint,baseline_captured_at,result,baseline_product_count,current_product_count,failure_count,artifact_hash,schema_migrations) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[after.databaseFingerprint,before.capturedAt,failures.length?"failed":"passed",before.products.length,after.products.length,failures.length,artifactHash,JSON.stringify(after.schemaMigrations)]);
}

function compare(before: Report, after: Report) {
  const failures: string[] = [];
  if (before.databaseFingerprint !== after.databaseFingerprint) failures.push("database fingerprint differs");
  const byId = new Map(after.products.map((product) => [product.id, product]));
  for (const original of before.products) {
    const current = byId.get(original.id);
    if (!current) { failures.push(`missing product ${original.id}`); continue; }
    for (const field of ["slugHash", "urlHash", "contactHash", "ownerHash"] as const) {
      if (original[field] !== current[field]) failures.push(`${original.id}: ${field} changed`);
    }
    for (const field of ["legacyVotes", "outboundClicks", "media", "updates"] as const) {
      if (current[field] < original[field]) failures.push(`${original.id}: ${field} decreased`);
    }
  }
  return failures;
}

async function main() {
  try{
    const mode = process.argv[2];
    const file = resolve(process.argv[3] ?? "backups/foundertrail-baseline.json");
    const report = await capture();
    if (mode === "baseline") {
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
      console.log(`baseline: ${report.products.length} products across ${Object.keys(report.tableCounts).length} tables`);
      console.log(`wrote ${file}`);
      return;
    }
    if (mode !== "reconcile") throw new Error("Use baseline or reconcile mode.");
    const baselineText=readFileSync(file,"utf8");
    const before = JSON.parse(baselineText) as Report;
    const failures = compare(before, report);
    await recordReconciliation(before,report,failures,digest(baselineText));
    console.log(`reconciled ${before.products.length} original products; current total ${report.products.length}`);
    if (failures.length) {
      failures.slice(0, 50).forEach((failure) => console.error(`FAIL: ${failure}`));
      throw new Error(`${failures.length} reconciliation failure(s)`);
    }
    console.log("reconciliation passed and recorded for the admin health view");
  }finally{
    await getPool().end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "baseline failed");
  process.exit(1);
});
