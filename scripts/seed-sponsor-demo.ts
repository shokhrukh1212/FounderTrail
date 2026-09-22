/**
 * Creates an audited complimentary sponsor campaign so the placements can actually be
 * looked at without taking a payment.
 *
 * Refuses to run unless USE_TEST_DATABASE=true, so it can never touch the live database.
 * Pass --remove to withdraw the campaigns it created.
 */
import { databaseHost, getPool } from "../lib/db";
import { config } from "../lib/config";

const REASON = "Demo placement seeded for review (scripts/seed-sponsor-demo.ts)";

if (process.env.USE_TEST_DATABASE !== "true") {
  console.error("Refusing to run: set USE_TEST_DATABASE=true so this only ever touches the rehearsal branch.");
  process.exit(1);
}

async function main(): Promise<void> {
  const pool = getPool();
  const remove = process.argv.includes("--remove");
  console.log(`host=${databaseHost()}`);

  if (remove) {
    const gone = await pool.query(`DELETE FROM sponsor_bookings WHERE complimentary_reason=$1 RETURNING id`, [REASON]);
    console.log(`removed ${gone.rowCount} seeded campaign(s)`);
    await pool.end();
    return;
  }

  const existing = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sponsor_bookings WHERE complimentary_reason=$1`, [REASON]);
  if (existing.rows[0]!.n !== "0") {
    console.log(`${existing.rows[0]!.n} seeded campaign(s) already active. Use --remove first.`);
    await pool.end();
    return;
  }

  // Three different published startups so all three slots are visibly occupied.
  const products = await pool.query<{ id: string; name: string; tagline: string; website_url: string }>(
    `SELECT p.id::text,p.name,p.tagline,p.website_url FROM products p
      WHERE p.status='published' AND NOT p.is_demo AND p.tagline<>'' ORDER BY p.created_at LIMIT 3`);
  const purchaser = await pool.query<{ id: string }>(
    `SELECT id FROM app_users WHERE role='admin' AND deleted_at IS NULL ORDER BY created_at LIMIT 1`);
  const owner = purchaser.rows[0];
  if (!owner || products.rows.length === 0) {
    console.error(`need an admin account and at least one published startup (found ${products.rows.length})`);
    await pool.end();
    process.exit(1);
  }

  // Started an hour ago so the campaigns are already active and therefore visible.
  const startAt = new Date(Date.now() - 60 * 60 * 1000);
  for (const [slot, product] of products.rows.entries()) {
    const days = config.sponsorship.tiers[slot % config.sponsorship.tiers.length]!.days;
    const endAt = new Date(startAt.getTime() + days * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO sponsor_bookings(product_id,purchaser_id,start_at,end_at,slot_index,duration_days,price_minor,currency,
                                    creative_name,creative_tagline,destination_url,provider_environment,
                                    booking_status,payment_status,complimentary_reason,paid_at)
       VALUES($1::uuid,$2,$3,$4,$5,$6,0,'USD',$7,$8,$9,$10,'active','complimentary',$11,now())`,
      [product.id, owner.id, startAt, endAt, slot, days, product.name, product.tagline, product.website_url,
       config.dodoPayments.environment, REASON],
    );
    console.log(`slot ${slot}: ${product.name} (${days} days, complimentary)`);
  }
  await pool.end();
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
