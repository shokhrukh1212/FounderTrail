import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { sponsorSavings, sponsorTier, sponsorTiers } from "../config";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../migrations/015_sponsor_inventory_tiers.up.sql");
const migrationDown = read("../../migrations/015_sponsor_inventory_tiers.down.sql");
const sponsorship = read("../sponsorship.ts");
const data = read("../foundertrail-data.ts");
const slot = read("../../components/SponsorSlot.tsx");
const homepage = read("../../app/page.tsx");
const advertise = read("../../app/advertise/page.tsx");
const header = read("../../components/SiteHeader.tsx");
const bookings = read("../../app/api/sponsor/bookings/route.ts");
const startupRow = read("../../components/StartupRow.tsx");

test("the advertised saving is one a buyer could actually make", () => {
  // The brief asks for "Save $20 (25%)" against four 7-day purchases, not a pro-rata
  // 30/7 split, which would overstate it.
  const savings = sponsorSavings();
  assert.deepEqual(savings, { savedMinor: 2000, percent: 25, periods: 4 });
  assert.equal(sponsorTier(7)?.priceMinor, 2000);
  assert.equal(sponsorTier(30)?.priceMinor, 6000);
  assert.equal(sponsorTier(14), null);
  assert.deepEqual(sponsorTiers().map((tier) => tier.days), [7, 30]);
});

test("capacity is enforced by the database, not by application counting", () => {
  assert.match(migration, /EXCLUDE USING gist \(slot_index WITH =, tstzrange\(start_at, end_at, '\[\)'\) WITH &&\)/);
  assert.match(migration, /CHECK \(slot_index BETWEEN 0 AND 2\)/);
  assert.match(migration, /DROP CONSTRAINT sponsor_bookings_no_overlap/);
  // The interval must agree with the duration that was sold.
  assert.match(migration, /CHECK \(end_at = start_at \+ make_interval\(days => duration_days\)\)/);
});

test("migration 015 preserves every historical booking", () => {
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/i);
  // Old USD 9.00 rows must stay valid after the price check is relaxed.
  assert.match(migration, /CHECK \(price_minor >= 0\)/);
  // Backfill derives the real length instead of assuming one.
  assert.match(migration, /ROUND\(EXTRACT\(EPOCH FROM \(end_at - start_at\)\) \/ 86400\)/);
  assert.match(migration, /SET slot_index = 0 WHERE slot_index IS NULL/);
  // The four original placement values survive so historical events stay readable.
  for (const legacy of ["this_week_desktop", "this_week_mobile", "discover_desktop", "discover_mobile"]) {
    assert.ok(migration.includes(legacy), `${legacy} must be retained`);
  }
  assert.ok(migrationDown.length > 0, "a down migration must exist");
});

test("a payment can only activate the placement it actually paid for", () => {
  assert.match(sponsorship, /sponsorTier\(booking\.duration_days\)/);
  assert.match(sponsorship, /total_amount - tax !== booking\.price_minor/);
  assert.match(sponsorship, /event\.data\.subscription_id/); // one-time purchases only
  assert.match(sponsorship, /pg_advisory_xact_lock/); // transaction-scoped: PgBouncer-safe
  assert.doesNotMatch(sponsorship, /pg_advisory_lock\(/);
});

test("sponsored rows never take an organic rank number", () => {
  // `position` is derived from the organic index alone, and sponsors are pushed into the
  // rendered output rather than into the products array.
  assert.match(homepage, /position=\{weekly \|\| sort === "most_upvoted" \? \(page - 1\) \* 24 \+ index \+ 1 : undefined\}/);
  assert.match(homepage, /const SPONSORED_AFTER = \[3, 8, 13\]/);
  assert.match(homepage, /rows\.push\(<SponsorRow/);
  assert.doesNotMatch(homepage, /products\.splice|\[\.\.\.products, .*sponsor/i);
  // The inline row renders an empty rank cell rather than a number.
  assert.match(slot, /<div className="sponsor-row-rank" aria-hidden="true" \/>/);
});

test("sponsorship is queried separately from organic ranking", () => {
  const organic = data.slice(data.indexOf("getFounderTrailDiscovery"), data.indexOf("getActiveSponsors"));
  assert.doesNotMatch(organic, /sponsor_bookings/);
  assert.match(data, /never joins into, filters or reorders the product result set/);
  // Rotation is even and server-computed, so exposure does not always favour one booking.
  assert.match(data, /event_type='impression' AND e\.created_at>=date_trunc\('day',now\(\)\)/);
  assert.match(data, /b\.product_id<>\$2::uuid/); // never on the startup being viewed
});

test("paid links are sponsored, free listings are ugc, and no link is sold as followed", () => {
  assert.match(slot, /const PAID_REL = "sponsored noopener noreferrer"/);
  assert.equal(slot.split('rel={PAID_REL}').length - 1, 2); // card and row
  assert.doesNotMatch(slot, /rel="noopener noreferrer"/);
  assert.match(startupRow, /rel="ugc noopener noreferrer"/);
  for (const source of [advertise, homepage, slot]) {
    assert.doesNotMatch(source, /dofollow/i);
  }
  assert.match(advertise, /does not sell followed links/);
});

test("the Advertise page is public, honest about metrics, and gates checkout", () => {
  assert.match(header, /href="\/advertise">Advertise/);
  // DR is never in the global header and is never called a Google signal.
  assert.doesNotMatch(header, /Domain Rating|DR\s*\d/);
  assert.match(advertise, /ahrefsProof\(\)/);
  assert.match(advertise, /not a Google ranking signal/);
  assert.match(advertise, /traffic signals, not customers/i);
  // No promise of sales, rankings or a click count.
  assert.match(advertise, /we do not promise sales, rankings, backlinks or any number of clicks/i);
  assert.match(advertise, /!isDodoConfigured\(\)/);
});

test("a booking picks a free slot and refuses to oversell", () => {
  assert.match(bookings, /allocateSponsorSlot\(client, startAt, endAt\)/);
  assert.match(bookings, /if \(slot === null\) throw new Error\("SOLD_OUT"\)/);
  // A race that beats the advisory lock still fails on the exclusion constraint.
  assert.match(bookings, /code\.message === "SOLD_OUT" \|\| code\.code === "23P01"/);
  assert.match(bookings, /product_cart: \[\{ product_id: tier\.productId, quantity: 1 \}\]/);
});

test("a complimentary campaign runs end to end, not just in the database", () => {
  // price_minor=0 with payment_status='complimentary' is only useful if every path that
  // gates on a payment also recognises it: activation, impressions, clicks and status.
  const jobs = read("../foundertrail-jobs.ts");
  const impressions = read("../../app/api/sponsors/[bookingId]/events/route.ts");
  const outbound = read("../../app/sponsor/[bookingId]/go/route.ts");
  for (const [name, source] of [["cron", jobs], ["impressions", impressions], ["clicks", outbound]] as const) {
    assert.match(source, /IN \('paid','complimentary'\)/, `${name} must recognise a complimentary campaign`);
  }
  assert.match(data, /b\.payment_status IN \('paid','complimentary'\)/);
  // It still must not be counted as income.
  const adminPage = read("../../app/admin/foundertrail/page.tsx");
  assert.doesNotMatch(adminPage.slice(adminPage.indexOf("gross_minor") - 400, adminPage.indexOf("gross_minor") + 400), /complimentary/);
});

test("the admin calendar reports capacity, not a yes/no", () => {
  const adminPage = read("../../app/admin/foundertrail/page.tsx");
  const adminUi = read("../../components/AdminFounderTrailOperations.tsx");
  assert.match(adminPage, /count\(DISTINCT b\.slot_index\)::int/);
  assert.match(adminUi, /\{item\.used\} \/ \{item\.capacity\} used/);
  assert.match(adminUi, /inventory availability, not sales/);
  assert.match(adminPage, /Last Dodo webhook/);
});
