import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hashIntegrationSecret, integrationSecretMatches, newIntegrationSecret } from "../integration-security";
import { allowedOrigin, compareTrending, validEventId, validEventTime } from "../integration-validation";
import { publicHttpUrl, validateProductSubmission } from "../product-validation";

const coreMigration = readFileSync(new URL("../../migrations/001_bidindex_core.up.sql", import.meta.url), "utf8");
const partnerMigration = readFileSync(new URL("../../migrations/002_partner_network.up.sql", import.meta.url), "utf8");
const voteRoute = readFileSync(new URL("../../app/api/products/[slug]/vote/route.ts", import.meta.url), "utf8");
const clickRoute = readFileSync(new URL("../product-click.ts", import.meta.url), "utf8");
const partnerEvents = readFileSync(new URL("../partner-events.ts", import.meta.url), "utf8");
const productData = readFileSync(new URL("../product-data.ts", import.meta.url), "utf8");

test("votes are unique, reversible, and cannot seed production totals", () => {
  assert.match(coreMigration, /PRIMARY KEY \(product_id, voter_hash\)/);
  assert.match(voteRoute, /ON CONFLICT \(product_id, voter_hash\)/);
  assert.match(voteRoute, /active = EXCLUDED\.active/);
  assert.match(voteRoute, /VALUES \(\$1::uuid,\$2,\$3,\$4,false/);
  assert.match(productData, /process\.env\.NODE_ENV === "production" \? `p\.is_demo = false`/);
});

test("trending orders all-time votes then verified outbound clicks", () => {
  const now = new Date("2026-08-27T00:00:00Z");
  const items = [
    { id: "b", voteCount: 5, totalClicks: 9, publishedAt: now },
    { id: "a", voteCount: 6, totalClicks: 0, publishedAt: now },
    { id: "c", voteCount: 5, totalClicks: 10, publishedAt: now },
  ].sort(compareTrending);
  assert.deepEqual(items.map((item) => item.id), ["a", "c", "b"]);
});

test("outbound redirects resolve only stored, public product URLs and count uniquely", () => {
  assert.equal(publicHttpUrl("http://127.0.0.1/admin").ok, false);
  assert.equal(publicHttpUrl("javascript:alert(1)").ok, false);
  assert.equal(publicHttpUrl("https://example.com/path").ok, true);
  assert.match(clickRoute, /product\.website_url/);
  assert.match(coreMigration, /product_outbound_click_unique_counted_idx/);
});

test("integration authentication rejects wrong secrets", () => {
  const secret = newIntegrationSecret();
  assert.equal(integrationSecretMatches(hashIntegrationSecret(secret), secret), true);
  assert.equal(integrationSecretMatches(hashIntegrationSecret(secret), newIntegrationSecret()), false);
  assert.equal(integrationSecretMatches(hashIntegrationSecret(secret), "browser-value"), false);
});

test("partner origins must exactly match the registered domain", () => {
  assert.equal(allowedOrigin("https://example.com", "example.com"), true);
  assert.equal(allowedOrigin("https://www.example.com", "example.com"), true);
  assert.equal(allowedOrigin("https://evil.example.com", "example.com"), false);
  assert.equal(allowedOrigin("null", "example.com"), false);
});

test("money events require integer minor units and idempotent identifiers", () => {
  assert.equal(validEventId("order_123"), true);
  assert.equal(validEventTime("2026-08-27T10:00:00.000Z", Date.parse("2026-08-27T10:05:00.000Z"))?.toISOString(), "2026-08-27T10:00:00.000Z");
  assert.match(partnerMigration, /UNIQUE \(integration_id, event_id\)/);
  assert.match(partnerMigration, /value_minor\s+bigint/);
  assert.match(partnerEvents, /Number\.isSafeInteger\(amount\)/);
  assert.match(partnerEvents, /ON CONFLICT \(integration_id,event_id\) DO NOTHING/);
  assert.match(partnerEvents, /currency\.toUpperCase\(\)/);
});

test("product submission validates required public fields", () => {
  const form = new FormData();
  Object.entries({ websiteUrl: "https://launch.example", name: "Launch", tagline: "Transparent bids", contactEmail: "maker@example.com", launchDate: "2026-08-27", ownershipConsent: "on" }).forEach(([key,value]) => form.set(key,value));
  assert.equal(validateProductSubmission(form).ok, true);
  assert.equal(form.has("categories"), false);
  form.delete("contactEmail");
  assert.equal(validateProductSubmission(form).ok, false);
  form.set("contactEmail","maker@example.com");
  form.set("websiteUrl", "http://localhost:3000/internal");
  assert.equal(validateProductSubmission(form).ok, false);
});
