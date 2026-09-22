import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hashIntegrationSecret, integrationSecretMatches, newIntegrationSecret } from "../integration-security";
import { allowedOrigin, compareTrending, validEventId, validEventTime } from "../integration-validation";
import { publicHttpUrl, validateProductSubmission } from "../product-validation";

const coreMigration = readFileSync(new URL("../../migrations/001_bidindex_core.up.sql", import.meta.url), "utf8");
const partnerMigration = readFileSync(new URL("../../migrations/002_partner_network.up.sql", import.meta.url), "utf8");
const voteRoute = readFileSync(new URL("../../app/api/products/[slug]/vote/route.ts", import.meta.url), "utf8");
const launchVoteRoute = readFileSync(new URL("../../app/api/launches/[launchId]/vote/route.ts", import.meta.url), "utf8");
const founderTrailMigration = readFileSync(new URL("../../migrations/011_foundertrail_core.up.sql", import.meta.url), "utf8");
const permanentVoteMigration = readFileSync(new URL("../../migrations/013_permanent_upvotes_and_classification.up.sql", import.meta.url), "utf8");
const clickRoute = readFileSync(new URL("../product-click.ts", import.meta.url), "utf8");
const partnerEvents = readFileSync(new URL("../partner-events.ts", import.meta.url), "utf8");
const productData = readFileSync(new URL("../product-data.ts", import.meta.url), "utf8");

test("legacy support is preserved while authenticated product upvotes are unique and reversible", () => {
  assert.match(coreMigration, /PRIMARY KEY \(product_id, voter_hash\)/);
  assert.match(voteRoute, /currentUserFromHeaders/);
  assert.match(voteRoute, /body\.active/);
  assert.match(voteRoute, /first_upvoted_at/);
  assert.match(voteRoute, /user_id=\$2/);
  assert.match(permanentVoteMigration, /product_votes_authenticated_user_idx/);
  assert.match(permanentVoteMigration, /anonymous/i);
  assert.match(founderTrailMigration, /PRIMARY KEY\(launch_id, user_id\)/);
  assert.match(voteRoute, /ON CONFLICT\(launch_id,user_id\)/);
  assert.match(voteRoute, /Owners cannot upvote their own product/i);
  assert.match(launchVoteRoute, /status: 410/);
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
  Object.entries({ websiteUrl: "https://launch.example", name: "Launch", tagline: "A useful startup", contactEmail: "maker@example.com", categories: "developer-tools", ownershipConsent: "on" }).forEach(([key,value]) => form.set(key,value));
  assert.equal(validateProductSubmission(form).ok, true);
  // One to three categories, chosen by a person; pricing stays optional.
  form.set("categories", "developer-tools,ai-assistants,productivity,marketing-seo");
  assert.equal(validateProductSubmission(form).ok, false);
  form.set("categories", "other,developer-tools");
  assert.equal(validateProductSubmission(form).ok, false);
  form.set("categories", "developer-tools");
  form.delete("contactEmail");
  assert.equal(validateProductSubmission(form).ok, false);
  form.set("contactEmail","maker@example.com");
  form.set("websiteUrl", "http://localhost:3000/internal");
  assert.equal(validateProductSubmission(form).ok, false);
});
