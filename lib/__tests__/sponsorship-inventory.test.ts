import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const migration = read("../../migrations/015_sponsor_inventory_tiers.up.sql");
const homepage = read("../../app/page.tsx");
const header = read("../../components/SiteHeader.tsx");
const advertise = read("../../app/advertise/page.tsx");
const bookings = read("../../app/api/sponsor/bookings/route.ts");
const data = read("../foundertrail-data.ts");
const jobs = read("../foundertrail-jobs.ts");
const config = read("../config.ts");

test("legacy sponsor inventory remains readable and migration 015 stays additive", () => {
  assert.doesNotMatch(migration, /DROP TABLE|DELETE FROM|TRUNCATE/i);
  assert.match(migration, /CHECK \(price_minor >= 0\)/);
  assert.match(migration, /ROUND\(EXTRACT\(EPOCH FROM \(end_at - start_at\)\) \/ 86400\)/);
  for (const legacy of ["this_week_desktop", "this_week_mobile", "discover_desktop", "discover_mobile"]) {
    assert.ok(migration.includes(legacy), `${legacy} must remain readable`);
  }
});

test("new sponsorship sales and every public placement are retired", () => {
  assert.match(bookings, /status: 410/);
  assert.match(advertise, /permanentRedirect\("\/pricing"\)/);
  assert.match(header, /href="\/pricing">Pricing/);
  assert.doesNotMatch(header, /href="\/advertise"/);
  assert.doesNotMatch(homepage, /SponsorRow|SponsorCard|getActiveSponsors|SPONSORED_AFTER/);
  assert.match(config, /sponsorshipsEnabled: false/);
});

test("legacy reconciliation is isolated from the new public product", () => {
  assert.match(config, /legacySponsorshipsEnabled/);
  assert.match(jobs, /retrySponsorRefunds/);
  assert.match(jobs, /reconcileExpiredDodoCheckouts/);
  assert.match(homepage, /FounderTrail/);
  assert.doesNotMatch(homepage, /sponsor_bookings/);
});

test("Pro status is display-only and cannot change organic order", () => {
  const discovery = data.slice(data.indexOf("getFounderTrailDiscovery"), data.indexOf("getActiveSponsors"));
  assert.match(discovery, /pro_entitlements/);
  assert.match(discovery, /AS is_pro/);
  assert.match(discovery, /ORDER BY/);
  const order = discovery.slice(discovery.lastIndexOf("ORDER BY"));
  assert.doesNotMatch(order, /is_pro|pro_entitlements/);
  assert.doesNotMatch(discovery, /JOIN pro_entitlements/);
});
