import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeRecurringMonthly } from "../stripe-metric-math";

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),"utf8");
const migration=read("../../migrations/011_foundertrail_core.up.sql");
const migration12=read("../../migrations/012_claim_invitation_campaign.up.sql");
const migrate=read("../../scripts/migrate.ts");
const baseline=read("../../scripts/foundertrail-baseline.ts");
const claims=read("../../app/api/claims/[claimId]/verify/route.ts");
const claimCreate=read("../../app/api/products/[slug]/claims/route.ts");
const legacyClaim=read("../../app/api/products/[slug]/claims/legacy/route.ts");
const ownerAuth=read("../owner-auth.ts");
const sponsorBooking=read("../../app/api/sponsor/bookings/route.ts");
const sponsorship=read("../sponsorship.ts");
const dodoWebhook=read("../../app/api/webhooks/dodo/route.ts");
const sponsorClick=read("../../app/sponsor/[bookingId]/go/route.ts");
const adminRefund=read("../../app/api/admin/sponsors/[bookingId]/refund/route.ts");
const jobs=read("../foundertrail-jobs.ts");
const stripe=read("../stripe-metrics.ts");
const stripeRoute=read("../../app/api/owner/products/[slug]/metrics/stripe/route.ts");
const legacyCheckout=read("../../app/api/checkout/route.ts");
const accountSettings=read("../../app/api/account/settings/route.ts");
const authConfig=read("../auth.ts");
const adminProducts=read("../admin-products.ts");
const ownerRoute=read("../../app/api/owner/products/[slug]/route.ts");
const adminOperations=read("../../app/admin/foundertrail/page.tsx");
const finalMigration=read("../../migrations/013_permanent_upvotes_and_classification.up.sql");
const signIn=read("../../components/SignInForm.tsx");
const header=read("../../components/SiteHeader.tsx");
const adminAuth=read("../admin-auth.ts");
const adminRoleScript=read("../../scripts/set-admin-role.ts");

test("migration is additive to stable products and isolates new state machines",()=>{
  assert.doesNotMatch(migration,/DROP TABLE\s+products/i);
  assert.match(migration,/CREATE TABLE product_owners/);
  assert.match(migration,/CREATE TABLE product_claims/);
  assert.match(migration,/CREATE TABLE product_launches/);
  assert.match(migration,/CREATE TABLE launch_votes/);
  assert.match(migration,/CREATE TABLE sponsor_bookings/);
  assert.match(migration,/EXCLUDE USING gist/);
  assert.match(migration,/booking_status IN \('held','scheduled','active','refund_pending'\)/);
  assert.match(migration,/price_minor integer NOT NULL CHECK \(price_minor=900\)/);
  assert.match(migrate,/schema_migrations/);
  assert.doesNotMatch(migrate,/schema\.sql/);
  assert.match(baseline,/slugHash/);
  assert.match(baseline,/contactHash/);
  assert.doesNotMatch(baseline,/contactEmail:/);
  assert.match(migration12,/CREATE TABLE migration_reconciliation_runs/);
  assert.match(baseline,/recordReconciliation/);
  assert.match(adminOperations,/Baseline reconciliation/);
});

test("account ownership uses one-time claims rather than bearer mutation",()=>{
  assert.match(claims,/timingSafeEqual/);
  assert.match(claims,/fetchPinnedHttpsText/);
  assert.match(claims,/state='pending' FOR UPDATE/);
  assert.match(claims,/challenge_token_hash=NULL/);
  assert.match(claims,/state='disputed'/);
  assert.match(claims,/product\.claim\.domain_disputed/);
  assert.match(claimCreate,/DISPUTE_PENDING/);
  assert.match(legacyClaim,/currentUserFromHeaders/);
  assert.match(legacyClaim,/consumeRateLimit/);
  assert.match(legacyClaim,/product_owners/);
  assert.match(ownerAuth,/currentUserFromHeaders/);
  assert.doesNotMatch(ownerAuth,/token_hash.*request|approvalToken|managementToken/);
});

test("admin operations expose required ownership, launch, activity, and sponsorship controls",()=>{
  assert.match(adminProducts,/ownership_status/);
  assert.match(adminProducts,/launch_status/);
  assert.match(adminProducts,/recent_activity_at/);
  assert.match(adminProducts,/category_name/);
  assert.match(adminOperations,/sponsorIncome/);
  assert.match(adminOperations,/sponsorInventory/);
  assert.match(ownerRoute,/p\.status IN \('draft','rejected'\)/);
  assert.match(ownerRoute,/Owner submitted requested changes/);
});

test("Google is the only public sign-in provider and admin access is role-aware",()=>{
  assert.match(authConfig,/socialProviders/);
  assert.match(authConfig,/google:/);
  assert.doesNotMatch(authConfig,/magicLink|emailAndPassword/);
  assert.match(signIn,/Continue with Google/);
  assert.doesNotMatch(signIn,/password|magic link/i);
  assert.match(adminAuth,/user\?\.role === "admin"/);
  assert.match(adminRoleScript,/email_verified/);
  assert.match(adminRoleScript,/provider_id !== "google"/);
  assert.match(adminRoleScript,/DELETE FROM auth_sessions/);
  assert.doesNotMatch(header,/Search products/);
});

test("permanent upvotes and canonical classification are additive and auditable",()=>{
  assert.match(finalMigration,/ADD COLUMN user_id/);
  assert.match(finalMigration,/product_votes_authenticated_user_idx/);
  assert.match(finalMigration,/CREATE TABLE product_classification_audits/);
  assert.match(finalMigration,/category_review_required/);
  assert.match(finalMigration,/directories-discovery/);
  assert.match(finalMigration,/advertising-sponsorship/);
  assert.doesNotMatch(finalMigration,/DELETE FROM products|TRUNCATE/);
});

test("account deletion revokes private access while retaining anonymized required history",()=>{
  assert.match(accountSettings,/DELETE FROM auth_sessions/);
  assert.match(accountSettings,/DELETE FROM auth_accounts/);
  assert.match(accountSettings,/name='Deleted member'/);
  assert.match(accountSettings,/deleted_at=now\(\)/);
  assert.match(accountSettings,/FROM product_owners WHERE user_id=\$1/);
  assert.doesNotMatch(authConfig,/deleteUser:\s*\{\s*enabled:\s*true/);
});

test("Dodo is the fixed sponsorship provider and browser returns cannot activate inventory",()=>{
  assert.match(sponsorBooking,/checkoutSessions\.create/);
  assert.match(sponsorBooking,/allow_discount_code: false/);
  assert.match(sponsorBooking,/holdMinutes/);
  assert.match(sponsorBooking,/action: "sponsor-booking"/);
  assert.match(sponsorship,/DODO_BUSINESS_MISMATCH/);
  assert.match(sponsorship,/DODO_ENVIRONMENT_MISMATCH/);
  assert.match(sponsorship,/product_cart\?\.length === 1/);
  assert.match(sponsorship,/total_amount - tax !== config\.sponsorship\.priceMinor/);
  assert.match(sponsorship,/payment_conflict/);
  assert.match(dodoWebhook,/verifiedDodoWebhook/);
  assert.match(dodoWebhook,/ON CONFLICT\(webhook_id\) DO NOTHING/);
  assert.match(sponsorClick,/event_type='impression'/);
  assert.match(sponsorClick,/se\.visitor_hash=\$3/);
  assert.match(adminRefund,/INSERT INTO notification_jobs/);
  assert.match(adminRefund,/getDodoClient\(\)\.refunds\.create/);
  assert.ok(adminRefund.indexOf("INSERT INTO notification_jobs") < adminRefund.indexOf("getDodoClient().refunds.create"));
  assert.match(jobs,/job\.payload\.reason/);
  assert.match(jobs,/processing_status='received'.*received_at<now\(\)-interval '5 minutes'/);
  assert.match(jobs,/FOR UPDATE SKIP LOCKED/);
  assert.match(jobs,/worker lease expired/);
  assert.doesNotMatch(sponsorBooking,/Lemon|lemonsqueezy/i);
  assert.match(legacyCheckout,/LEGACY_CHECKOUT_RETIRED/);
  assert.match(legacyCheckout,/status: 410/);
});

test("Stripe interval normalization uses precise minor-unit rational arithmetic",()=>{
  assert.equal(normalizeRecurringMonthly({unitAmountDecimal:"1200",quantity:1,interval:"year",intervalCount:1}),100);
  assert.equal(normalizeRecurringMonthly({unitAmountDecimal:"100",quantity:2,interval:"month",intervalCount:1}),200);
  assert.equal(normalizeRecurringMonthly({unitAmountDecimal:"100",quantity:1,interval:"week",intervalCount:1}),433);
  assert.equal(normalizeRecurringMonthly({unitAmountDecimal:"1200.5",quantity:1,interval:"month",intervalCount:3}),400);
  assert.throws(()=>normalizeRecurringMonthly({unitAmountDecimal:"-1",quantity:1,interval:"month",intervalCount:1}),/INVALID_MONEY/);
});

test("Stripe keys are restricted, scoped, opt-in, currency-separated, and purgeable",()=>{
  assert.match(stripe,/\^rk_\(\?:test\|live\)_/);
  assert.match(stripe,/subscriptions\.list/);
  assert.match(stripe,/charges\.list/);
  assert.match(stripe,/invoices\.list/);
  assert.match(stripe,/products\.list/);
  assert.match(stripe,/prices\.list/);
  assert.match(stripe,/new Map<string, number>\(\)/);
  assert.match(stripe,/item\.price\.currency\.toUpperCase\(\)/);
  assert.match(stripe,/!revenue\.has\(item\.currency\).*revenue\.set\(item\.currency, 0\)/);
  assert.match(stripeRoute,/confirmAccountWide/);
  assert.match(stripeRoute,/metric_connection_scopes/);
  assert.match(stripeRoute,/publish_revenue/);
  assert.match(stripeRoute,/action: "stripe-metrics"/);
  assert.match(stripeRoute,/DELETE FROM metric_connections/);
});
