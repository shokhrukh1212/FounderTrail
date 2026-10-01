import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { checkTestDatabase, testConnectionString } from "../../scripts/dev-test";

test("test development never falls back to a configured production database", () => {
  assert.throws(() => testConnectionString({ DATABASE_URL: "postgres://production.example/live" }), /TEST_DATABASE_URL is not set/);
  assert.equal(testConnectionString({ TEST_DATABASE_URL: " postgres://localhost/rehearsal ", DATABASE_URL: "postgres://production.example/live" }), "postgres://localhost/rehearsal");
});

test("invalid test connection strings produce instructions without exposing credentials", () => {
  for (const url of ["https://person:private-password@db.example/test", "postgres://person:private-password@db.example", "not-a-database-url"]) {
    assert.throws(() => testConnectionString({ TEST_DATABASE_URL: url }), (error: Error) => {
      assert.match(error.message, /PostgreSQL connection URL/);
      assert.doesNotMatch(error.message, /private-password|person|db\.example/);
      return true;
    });
  }
});

test("database startup failures are sanitized and close the connection", async () => {
  let closed = false;
  await assert.rejects(checkTestDatabase("postgres://localhost/test", () => ({
    async connect() { throw Object.assign(new Error("private-password at production.example"), { code: "ECONNREFUSED" }); },
    async query() { throw new Error("must not query after a failed connection"); },
    async end() { closed = true; },
  })), (error: Error) => {
    assert.match(error.message, /ECONNREFUSED/);
    assert.doesNotMatch(error.message, /private-password|production\.example/);
    return true;
  });
  assert.equal(closed, true);
});

test("unmigrated test databases receive migration instructions without schema writes", async () => {
  const queries: string[] = [];
  let closed = false;
  await assert.rejects(checkTestDatabase("postgres://localhost/test", () => ({
    async connect() {},
    async query(sql) { queries.push(sql); return { rows: [] }; },
    async end() { closed = true; },
  })), /npm run migrate:test/);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /^SELECT .*information_schema\.columns/);
  assert.equal(closed, true);
});

test("a complete instant-launch schema passes the read-only startup check", async () => {
  const schema = {
    products: ["launch_choice", "requested_launch_at", "legacy_contact_email"],
    product_launches: ["starts_at"],
    product_identities: ["identity", "product_id"],
    product_activation: ["product_id", "post_draft", "share_state", "composer_opened_at"],
    product_access_tokens: ["token_hash", "product_id", "claimant_id", "expires_at", "consumed_at"],
    app_users: ["google_authority_email", "google_authority_at"],
  };
  let closed = false;
  await checkTestDatabase("postgres://localhost/test", () => ({
    async connect() {},
    async query() {
      return { rows: Object.entries(schema).flatMap(([table_name, columns]) => columns.map((column_name) => ({ table_name, column_name }))) };
    },
    async end() { closed = true; },
  }));
  assert.equal(closed, true);
});

test("dev:test exits before starting Next.js when configuration is missing", () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "foundertrail-dev-test-"));
  try {
    const result = spawnSync(process.execPath, ["--import", path.resolve("node_modules/tsx/dist/loader.mjs"), path.resolve("scripts/dev-test.ts")], {
      cwd,
      env: { ...process.env, TEST_DATABASE_URL: "", DATABASE_URL: "postgres://production.example/live" },
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /TEST_DATABASE_URL is not set/);
    assert.doesNotMatch(result.stdout + result.stderr, /production\.example|Starting Next\.js|Ready in/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
