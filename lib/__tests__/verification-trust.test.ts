import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { containsBadgeInstallation, containsVerificationMeta, productVerificationTimestamp } from "../product-verification";

const metricFormat = readFileSync(new URL("../metric-format.ts", import.meta.url), "utf8");
const partnerEvents = readFileSync(new URL("../partner-events.ts", import.meta.url), "utf8");
const visitorRoute = readFileSync(new URL("../../app/api/events/visitor/route.ts", import.meta.url), "utf8");
const badgeScript = readFileSync(new URL("../../app/embed/badge.js/route.ts", import.meta.url), "utf8");
const verificationRoute = readFileSync(new URL("../../app/api/owner/products/[slug]/verify-domain/route.ts", import.meta.url), "utf8");
const badgeRoute = readFileSync(new URL("../../app/api/owner/products/[slug]/check-badge/route.ts", import.meta.url), "utf8");
const ownerRoute = readFileSync(new URL("../../app/api/owner/products/[slug]/route.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../migrations/005_verification_metric_trust.up.sql", import.meta.url), "utf8");
const partnerMigration = readFileSync(new URL("../../migrations/002_partner_network.up.sql", import.meta.url), "utf8");

test("domain verification recognizes only the exact BidIndex meta token", () => {
  const token = "bidindex_example-token";
  assert.equal(containsVerificationMeta(`<meta content="${token}" name="bidindex-verification">`, token), true);
  assert.equal(containsVerificationMeta(`<meta name="bidindex-verification" content="wrong">`, token), false);
  assert.equal(containsVerificationMeta(`<meta name="something-else" content="${token}">`, token), false);
});

test("badge detection requires the expected script origin, path, and project ID", () => {
  const project = "12345678-1234-1234-1234-123456789abc";
  const valid = `<script async data-project="${project}" src="https://index.example/embed/badge.js"></script>`;
  assert.equal(containsBadgeInstallation(valid, project, "https://index.example"), true);
  assert.equal(containsBadgeInstallation(valid, "00000000-0000-0000-0000-000000000000", "https://index.example"), false);
  assert.equal(containsBadgeInstallation(valid.replace("index.example", "evil.example"), project, "https://index.example"), false);
});

test("product verification requires domain and badge, never revenue", () => {
  const domain = new Date("2026-08-28T10:00:00Z");
  const badge = new Date("2026-08-28T10:01:00Z");
  const now = new Date("2026-08-28T10:02:00Z");
  assert.equal(productVerificationTimestamp(domain, null, null, now), null);
  assert.equal(productVerificationTimestamp(null, badge, null, now), null);
  assert.equal(productVerificationTimestamp(domain, badge, null, now), now);
  assert.doesNotMatch(productVerificationTimestamp.toString(), /revenue|secret|event/i);
});

test("metric source labels communicate who measured or supplied each value", () => {
  assert.match(metricFormat, /measured_by_bidindex: "Measured by FounderTrail"/);
  assert.match(metricFormat, /processor_verified: "Processor verified"/);
  assert.match(metricFormat, /partner_connected: "Partner connected"/);
  assert.match(metricFormat, /publicly_sourced: "Publicly sourced"/);
  assert.match(metricFormat, /founder_reported: "Founder reported"/);
  assert.match(metricFormat, /unavailable: "Unavailable"/);
  assert.match(metricFormat, /supplied by the partner/i);
});

test("visitor measurement is domain-bound, ephemeral, and privacy conscious", () => {
  assert.match(visitorRoute, /allowedOrigin/);
  assert.match(visitorRoute, /dailyVisitorHash/);
  assert.match(visitorRoute, /product_daily_visitors/);
  assert.match(visitorRoute, /ON CONFLICT DO NOTHING RETURNING visitor_hash/);
  assert.doesNotMatch(visitorRoute, /raw_ip|ip_address/);
  assert.match(badgeScript, /sendBeacon/);
  assert.doesNotMatch(badgeScript, /localStorage|document\.cookie|location\.search|location\.hash/);
});

test("partner events are authenticated, idempotent, currency-safe, and refund-aware", () => {
  assert.match(partnerEvents, /integrationSecretMatches/);
  assert.match(partnerEvents, /allowedKeys/);
  assert.match(partnerEvents, /Number\.isSafeInteger\(amount\)/);
  assert.match(partnerEvents, /\^\[A-Z\]\{3\}\$/);
  assert.match(partnerEvents, /ON CONFLICT \(integration_id,event_id\) DO NOTHING/);
  assert.match(partnerEvents, /event\.type === "refund"/);
  assert.match(partnerEvents, /-amount/);
  assert.match(partnerEvents, /"partner_connected"|partner_connected/);
});

test("owner verification and editing routes authorize the product credential", () => {
  for (const source of [verificationRoute, badgeRoute, ownerRoute]) {
    assert.match(source, /authenticateOwner/);
    assert.match(source, /owner\.productId|owner\?\.productId/);
  }
});

test("verification migration is additive and keeps product and metric states separate", () => {
  assert.match(partnerMigration, /domain_verified_at/);
  assert.match(migration, /badge_installed_at/);
  assert.match(migration, /product_verified_at/);
  assert.match(migration, /source_status/);
  assert.match(migration, /partner_connected/);
  assert.match(migration, /processor_verified/);
  assert.doesNotMatch(migration, /DROP TABLE products/i);
});
