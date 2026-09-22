import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { approvalAccessMatches, approvalAccessToken, approvalManagementUrl } from "../approval-access";
import { canonicalProductUrl, launchPostText, productLaunchUrl, validXHandle, xLaunchIntent } from "../product-share";

const approvalRoute = readFileSync(new URL("../../app/api/admin/products/[slug]/status/route.ts", import.meta.url), "utf8");
const retryRoute = readFileSync(new URL("../../app/api/admin/products/[slug]/approval-email/route.ts", import.meta.url), "utf8");
const backlogRoute = readFileSync(new URL("../../app/api/admin/approval-emails/route.ts", import.meta.url), "utf8");
const ownerRoute = readFileSync(new URL("../../app/api/owner/products/[slug]/route.ts", import.meta.url), "utf8");
const emailService = readFileSync(new URL("../approval-email.ts", import.meta.url), "utf8");
const productData = readFileSync(new URL("../product-data.ts", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../migrations/006_approval_notifications.up.sql", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
const ownerAccess = readFileSync(new URL("../../components/OwnerAccess.tsx", import.meta.url), "utf8");

test("X launch intent contains encoded copy and canonical attributed product URL", () => {
  const intent = new URL(xLaunchIntent({ siteUrl: "https://bidindex.dev", slug: "one & two", productName: "Bid & Win", description: "A useful launch." }));
  assert.equal(intent.origin + intent.pathname, "https://x.com/intent/tweet");
  assert.match(intent.searchParams.get("text") ?? "", /^I’m building Bid & Win and sharing its progress on FounderTrail\./);
  const shared = new URL(intent.searchParams.get("url")!);
  assert.equal(shared.pathname, "/product/one%20%26%20two");
  assert.deepEqual(Object.fromEntries(shared.searchParams), {
    v: "1", ref: "one & two", utm_source: "x", utm_medium: "social", utm_campaign: "founder_launch", utm_content: "one & two",
  });
});

test("long descriptions are shortened at a word boundary without truncating the name", () => {
  const name = "A Product Name That Must Remain Complete";
  const text = launchPostText(name, "traction ".repeat(100));
  assert.match(text, new RegExp(name));
  assert.ok(Array.from(text).length + 24 <= 280);
  assert.doesNotMatch(text, /tract…/);
});

test("X launch copy preserves the complete product name", () => {
  const text = launchPostText(
    "YourHour - Pay less, Get more. #1 product gets featured on the homepage.",
    "Pay $1 more to take #1. Every buyer stays permanently on the leaderboard, ranked by total paid.",
  );
  assert.match(text, /^I’m building YourHour - Pay less, Get more\. #1 product gets featured on the homepage\. and sharing its progress on FounderTrail\./);
  assert.match(text, /\n\nSee what it does and follow along:$/);
  assert.ok(Array.from(text).length + 24 <= 280);
});

test("X attribution is added only for a valid configured handle", () => {
  assert.equal(validXHandle("@BidIndexHQ"), "BidIndexHQ");
  assert.equal(validXHandle("not a handle"), null);
  const valid = new URL(xLaunchIntent({siteUrl:"https://bidindex.dev",slug:"atlas",productName:"Atlas",bidIndexHandle:"@BidIndexHQ"}));
  const invalid = new URL(xLaunchIntent({siteUrl:"https://bidindex.dev",slug:"atlas",productName:"Atlas",bidIndexHandle:"bad handle"}));
  assert.equal(valid.searchParams.get("via"), "BidIndexHQ");
  assert.equal(invalid.searchParams.has("via"), false);
});

test("signed approval access is deterministic and invalidated by owner token rotation", () => {
  const approvedAt = new Date("2026-08-28T12:30:00.000Z");
  const input = { productId: "5f182552-dab0-4e6c-9bd6-d6a01ed9d913", approvedAt, tokenVersion: 2 };
  const token = approvalAccessToken(input, "test-secret");
  assert.equal(token, approvalAccessToken(input, "test-secret"));
  assert.equal(approvalAccessMatches(token, input, "test-secret"), true);
  assert.equal(approvalAccessMatches(token, { ...input, tokenVersion: 3 }, "test-secret"), false);
  const managementUrl = approvalManagementUrl("https://bidindex.dev", "example", token);
  assert.match(managementUrl, /^https:\/\/bidindex\.dev\/manage\/example#approval=/);
  assert.doesNotMatch(new URL(managementUrl).search, /approval/);
});

test("approval commits publication before attempting email and is idempotent", () => {
  assert.ok(approvalRoute.indexOf("await withTransaction") < approvalRoute.indexOf("await sendApprovalEmail"));
  assert.match(approvalRoute, /product\.status === "published"[\s\S]*newlyPublished: false/);
  assert.match(approvalRoute, /approved_at=CASE WHEN \$2='published'/);
  assert.match(approvalRoute, /published_at=CASE WHEN \$2='published'/);
  assert.doesNotMatch(approvalRoute, /product_votes|product_metric|visitor|revenue/);
});

test("approval email is provider-idempotent, retryable, and stores sanitized state", () => {
  assert.match(emailService, /product-approved:\$\{product\.id\}:\$\{product\.approved_at\.toISOString\(\)\}/);
  assert.match(emailService, /idempotencyKey/);
  assert.match(emailService, /approval_email_sent_at/);
  assert.match(emailService, /approval_email_provider_id/);
  assert.match(emailService, /approval_email_last_failure/);
  assert.match(emailService, /html: content\.html/);
  assert.match(emailService, /text: content\.text/);
  assert.match(emailService, /Share on X/);
  assert.match(emailService, /Manage product/);
  assert.match(emailService, /Shokhrukh Karimov/);
  assert.doesNotMatch(emailService, /Shahzod/);
  assert.match(retryRoute, /validAdminRequest/);
  assert.match(retryRoute, /sendApprovalEmail/);
  assert.match(retryRoute, /allowSkipped: true/);
  assert.match(backlogRoute, /approval_email_sent_at IS NULL/);
  assert.match(backlogRoute, /approval_email_status IN \('not_sent','failed','skipped'\)/);
  assert.match(backlogRoute, /NOT is_demo/);
  assert.match(backlogRoute, /allowSkipped: true/);
});

test("pending stays private while approval makes existing public queries eligible", () => {
  assert.match(productData, /p\.status = 'published'/);
  assert.match(productData, /p\.launch_date = \(now\(\) AT TIME ZONE 'UTC'\)::date/);
  assert.match(productData, /newest: `p\.published_at DESC/);
  assert.match(migration, /approved_at timestamptz/);
  assert.match(migration, /approval_email_status = 'skipped'/);
});

test("owner status response is private and database backed", () => {
  assert.match(ownerRoute, /authenticateOwner/);
  assert.match(ownerRoute, /SELECT p\.status,p\.approved_at,p\.name,p\.tagline/);
  assert.match(ownerRoute,/reviewReason:product\.status==="rejected"/);
  assert.match(ownerRoute, /cache-control": "no-store/);
  assert.doesNotMatch(ownerRoute, /contact_email|contactEmail|token_hash|approvalToken/);
});

test("private management fragments are removed before analytics initialize", () => {
  assert.ok(rootLayout.indexOf("owner-fragment-scrubber") < rootLayout.indexOf("<VemetricScript"));
  assert.match(rootLayout, /strategy="beforeInteractive"/);
  assert.match(rootLayout, /sessionStorage\.setItem\('bidindex-owner-fragment'/);
  assert.match(rootLayout, /history\.replaceState/);
  assert.match(ownerAccess, /sessionStorage\.removeItem\("bidindex-owner-fragment"\)/);
  assert.doesNotMatch(ownerRoute, /approvalToken|managementToken/);
});

test("attributed URL does not alter the canonical product path", () => {
  const url = new URL(productLaunchUrl("https://bidindex.dev/", "safe-product"));
  assert.equal(url.origin, "https://bidindex.dev");
  assert.equal(url.pathname, "/product/safe-product");
  assert.equal(canonicalProductUrl("https://bidindex.dev/", "safe-product"), "https://bidindex.dev/product/safe-product");
});
