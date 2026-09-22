import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PRO_INTRO_LIMIT,
  PRO_INTRO_PRICE_MINOR,
  PRO_STANDARD_PRICE_MINOR,
  disputeTransition,
  fullRefundReached,
  nextIntroSlot,
  priceForAvailability,
} from "../pro-launch-policy";
import { defaultLaunchKitDraft, generatedSocial, normalizeLaunchKitDraft, type LaunchFacts } from "../launch-kit";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../migrations/016_pro_launch.up.sql");
const proLaunch = read("../pro-launch.ts");
const checkout = read("../../app/api/owner/products/[slug]/pro/checkout/route.ts");
const webhook = read("../../app/api/webhooks/dodo/route.ts");
const studio = read("../../components/LaunchStudio.tsx");
const report = read("../pro-results.ts");
const badge = read("../../components/ProBadge.tsx");

const facts: LaunchFacts = {
  name: "Acme",
  tagline: "A calm way to ship",
  useCase: "Coordinate product launches",
  audience: "small software teams",
  websiteUrl: "https://acme.example/",
  founderTrailUrl: "https://foundertrail.example/product/acme",
  launchState: "live",
};

test("intro allocation has twenty monotonic slots and a server-owned price", () => {
  assert.equal(PRO_INTRO_LIMIT, 20);
  assert.equal(nextIntroSlot([]), 1);
  assert.equal(nextIntroSlot([1, 2, 4]), 3);
  assert.equal(nextIntroSlot(Array.from({ length: 20 }, (_, index) => index + 1)), null);
  assert.equal(priceForAvailability(1), PRO_INTRO_PRICE_MINOR);
  assert.equal(priceForAvailability(0), PRO_STANDARD_PRICE_MINOR);
  assert.match(proLaunch, /pg_advisory_xact_lock/);
  assert.match(proLaunch, /priorIntro/);
  assert.match(proLaunch, /paid_at IS NOT NULL/);
  assert.match(proLaunch, /error\.code === "42P01"/);
  assert.match(proLaunch, /Pro features are temporarily unavailable/);
});

test("refund and dispute policy is monotonic", () => {
  assert.equal(fullRefundReached({ paidTotalMinor: 900, refundedTotalMinor: 899 }), false);
  assert.equal(fullRefundReached({ paidTotalMinor: 900, refundedTotalMinor: 900 }), true);
  assert.deepEqual(
    disputeTransition({ orderStatus: "paid", entitlementStatus: "active", disputeState: null }, "dispute.opened"),
    { orderStatus: "disputed", entitlementStatus: "suspended", disputeState: "opened" },
  );
  assert.deepEqual(
    disputeTransition({ orderStatus: "disputed", entitlementStatus: "suspended", disputeState: "opened" }, "dispute.won"),
    { orderStatus: "paid", entitlementStatus: "active", disputeState: "won" },
  );
  const refunded = { orderStatus: "refunded", entitlementStatus: "revoked" as const, disputeState: null };
  assert.deepEqual(disputeTransition(refunded, "dispute.won"), refunded);
});

test("the additive schema separates orders, access, reports, drafts, and telemetry", () => {
  assert.doesNotMatch(migration, /DROP TABLE products|DELETE FROM products|TRUNCATE/i);
  for (const table of [
    "pro_launch_orders", "pro_entitlements", "pro_entitlement_events", "pro_result_windows",
    "pro_launch_kit_drafts", "pro_launch_kit_assets", "product_community_activity_events",
    "pro_refunds", "pro_export_events", "pro_reporting_coverage",
  ]) assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
  assert.match(migration, /ON pro_launch_orders\(provider_environment,intro_slot\)/);
  assert.match(migration, /intro_slot BETWEEN 1 AND 20/);
  assert.match(migration, /quoted_price_minor IN \(500,900\)/);
  assert.match(migration, /ends_at=starts_at\+interval '7 days'/);
});

test("checkout trusts ownership and server-side SKU validation, not the return URL", () => {
  assert.match(checkout, /isAcceptedProPrice/);
  assert.match(checkout, /reserveProOrder/);
  assert.match(checkout, /product_cart: \[\{ product_id: providerProductId, quantity: 1 \}\]/);
  assert.match(checkout, /allow_currency_selection: false/);
  assert.match(checkout, /allow_discount_code: false/);
  assert.doesNotMatch(checkout, /activatePurchasedPro/);
  assert.match(proLaunch, /cart\.length === 1/);
  assert.match(proLaunch, /total - tax !== order\.quoted_price_minor/);
  assert.match(proLaunch, /DODO_PAYMENT_MISMATCH/);
  assert.match(proLaunch, /\["refunded","refund_pending","payment_conflict"\]/);
  assert.match(webhook, /verifiedDodoWebhook/);
  assert.match(webhook, /ON CONFLICT\(webhook_id\) DO NOTHING/);
});

test("launch drafts are deterministic, bounded, and reject arbitrary image sources", () => {
  assert.deepEqual(generatedSocial(facts), generatedSocial(facts));
  const base = defaultLaunchKitDraft(facts);
  const normalized = normalizeLaunchKitDraft({
    image: { name: "x".repeat(80), headline: "h".repeat(130), logoSource: "https://tracker.example/a.png", focalX: 999 },
    social: { short: "s".repeat(400), destination: "javascript:alert(1)" },
  }, facts, base);
  assert.equal(normalized.image.name.length, 60);
  assert.equal(normalized.image.headline.length, 100);
  assert.equal(normalized.image.logoSource, "");
  assert.equal(normalized.image.focalX, 100);
  assert.equal(normalized.social.short.length, 280);
  assert.equal(normalized.social.destination, facts.founderTrailUrl);
});

test("Launch Studio exports the pixels it previews at both required sizes", () => {
  assert.match(studio, /width: 1080, height: 1080/);
  assert.match(studio, /width: 1200, height: 630/);
  assert.match(studio, /await document\.fonts\?\.ready/);
  assert.match(studio, /canvas\.current!\.toBlob\(resolve, "image\/png"\)/);
  assert.match(studio, /fitText/);
  assert.match(studio, /The headline is too long/);
  assert.match(studio, /Private launch-kit image uploaded/);
  assert.match(studio, /never auto-posted/i);
});

test("results use one locked half-open seven-day window and immutable completion", () => {
  assert.match(report, /generate_series\(0,6\)/);
  assert.match(report, /created_at>=s\.slice_start AND e\.created_at<s\.slice_end/g);
  assert.match(report, /status === "complete" && window\.snapshot/);
  assert.match(report, /snapshot=\$2::jsonb,finalized_at=now\(\)/);
  assert.match(report, /coverageComplete/);
  assert.match(report, /anchor_kind='activation'/);
});

test("the Pro badge is explicit and is never presented as verification", () => {
  assert.match(badge, />✓<\/span> Pro/);
  assert.match(badge, /Pro startup/);
  assert.doesNotMatch(badge, /Verified/);
});
