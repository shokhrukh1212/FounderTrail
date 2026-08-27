/** Repeatable BidIndex demo data. It never touches real products or legacy payment rows. */
import { createHash } from "node:crypto";
import { getPool, query } from "../lib/db";

type DemoProduct = {
  slug: string;
  name: string;
  url: string;
  tagline: string;
  description: string;
  founder: string;
  mechanism: string;
  categories: string[];
  launchOffsetDays: number;
  votes: number;
};

const DEMO: DemoProduct[] = [
  { slug: "yourhour", name: "YourHour", url: "https://yourhour.lol", tagline: "A permanent product leaderboard ranked by paid bids.", description: "YourHour is a pay-to-rank homepage experiment where products bid for placement and every completed buyer remains listed.", founder: "YourHour team", mechanism: "Products submit a whole-dollar bid. Higher verified payments move a listing up the board.", categories: ["pay-to-rank", "attention-marketplace"], launchOffsetDays: -5, votes: 34 },
  { slug: "bidboard", name: "BidBoard", url: "https://bidboard.example", tagline: "A live auction for the most visible maker link.", description: "A demo marketplace where makers compete for a single featured link and publish transparent auction results.", founder: "Maya Chen", mechanism: "The highest active bid owns the featured slot until the next verified bid completes.", categories: ["ad-auction", "link-marketplace"], launchOffsetDays: 0, votes: 52 },
  { slug: "attention-exchange", name: "Attention Exchange", url: "https://attention-exchange.example", tagline: "Buy a clearly labelled share of a weekly audience.", description: "A demo attention marketplace with fixed weekly inventory and public delivery numbers.", founder: "Noah Williams", mechanism: "Sponsors bid for weekly inventory; winning placements are labelled and capped.", categories: ["attention-marketplace", "sponsorship-board"], launchOffsetDays: -1, votes: 45 },
  { slug: "toplink", name: "TopLink", url: "https://toplink.example", tagline: "One community link, sold transparently every day.", description: "A demo daily link auction with a public bid ledger and a fresh winner each UTC day.", founder: "Ari Patel", mechanism: "Each UTC day starts a new ascending auction. The highest settled bid wins the link.", categories: ["link-marketplace", "ad-auction"], launchOffsetDays: 0, votes: 40 },
  { slug: "sponsor-stack", name: "Sponsor Stack", url: "https://sponsor-stack.example", tagline: "A public queue for small-software sponsorships.", description: "A demo directory that exposes sponsor pricing, placement dates, and delivery status.", founder: "Leila Brooks", mechanism: "Sponsors choose a fixed slot and may bid to move to the next available date.", categories: ["sponsorship-board", "pay-to-rank"], launchOffsetDays: -9, votes: 27 },
  { slug: "pixel-bid", name: "Pixel Bid", url: "https://pixel-bid.example", tagline: "Tiny ad tiles priced by visible demand.", description: "A demo pixel-board experiment with limited inventory and public purchase events.", founder: "Owen Park", mechanism: "Each tile has a minimum price; competing bids replace a tile only after payment settles.", categories: ["ad-auction", "bidding-game"], launchOffsetDays: -2, votes: 31 },
  { slug: "rank-race", name: "Rank Race", url: "https://rank-race.example", tagline: "A playful leaderboard where every move is public.", description: "A demo bidding game for indie products, designed around small transparent increments.", founder: "Sara Kim", mechanism: "Products pay the difference between their current score and a higher whole-number position.", categories: ["bidding-game", "pay-to-rank"], launchOffsetDays: -14, votes: 21 },
  { slug: "open-slot", name: "Open Slot", url: "https://open-slot.example", tagline: "Auction one tasteful sponsorship slot at a time.", description: "A demo sponsorship tool for small publishers that keeps bidding and delivery visible.", founder: "Jon Bell", mechanism: "Eligible sponsors submit sealed bids; the winner is published after the closing time.", categories: ["sponsorship-board", "ad-auction"], launchOffsetDays: 0, votes: 38 },
  { slug: "click-market", name: "Click Market", url: "https://click-market.example", tagline: "A directory that reports the traffic it sends.", description: "A demo directory focused on auditable outbound traffic rather than impression estimates.", founder: "Priya Shah", mechanism: "Products buy labelled placements; position never changes the community vote order.", categories: ["attention-marketplace", "pay-to-rank"], launchOffsetDays: -3, votes: 29 },
  { slug: "bid-a-feature", name: "Bid a Feature", url: "https://bid-a-feature.example", tagline: "Let customers fund the next small product improvement.", description: "A demo experiment where feature proposals receive transparent pledges and progress updates.", founder: "Eli Grant", mechanism: "Customers pledge to proposals. The highest funded eligible item enters the next build cycle.", categories: ["bidding-game", "attention-marketplace"], launchOffsetDays: -6, votes: 18 },
  { slug: "front-row", name: "Front Row", url: "https://front-row.example", tagline: "A rotating launch shelf with public sponsorship terms.", description: "A demo launch shelf combining free discovery with clearly separated sponsored inventory.", founder: "Amara Reed", mechanism: "Organic launches stay vote-ranked; one separate promoted slot uses a fixed weekly price.", categories: ["sponsorship-board", "attention-marketplace"], launchOffsetDays: -1, votes: 25 },
  { slug: "last-bid", name: "Last Bid", url: "https://last-bid.example", tagline: "A countdown auction for experimental internet objects.", description: "A demo bidding game where each valid bid extends the timer and becomes part of the public history.", founder: "Theo Martin", mechanism: "Every verified bid raises the amount by a fixed increment and extends the closing time.", categories: ["bidding-game", "ad-auction"], launchOffsetDays: -20, votes: 16 },
];

function demoHash(value: string): string {
  return createHash("sha256").update(`bidindex-demo:${value}`).digest("hex");
}

async function main() {
  if (process.env.NODE_ENV === "production" || !process.argv.includes("--confirm-demo")) {
    throw new Error("Demo seeding requires a non-production environment and --confirm-demo");
  }

  await query(`DELETE FROM products WHERE is_demo = true`);

  for (const item of DEMO) {
    const launchAt = new Date();
    launchAt.setUTCHours(12, 0, 0, 0);
    launchAt.setUTCDate(launchAt.getUTCDate() + item.launchOffsetDays);
    const rows = await query<{ id: string }>(
      `INSERT INTO products
         (slug, website_url, normalized_domain, name, tagline, description,
          founder_name, contact_email, bidding_mechanism, minimum_bid_minor,
          bid_currency, data_disclosure, status, is_demo, launch_at, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'USD',$11,'published',true,$12,now())
       RETURNING id::text`,
      [item.slug, item.url, new URL(item.url).hostname, item.name, item.tagline, item.description,
       item.founder, `${item.slug}@demo.invalid`, item.mechanism, 100,
       "Demo values are synthetic and exist only for local development.", launchAt],
    );
    const productId = rows[0].id;
    for (const [position, category] of item.categories.entries()) {
      await query(
        `INSERT INTO product_categories (product_id, category_id, position)
         SELECT $1::uuid, id, $3 FROM categories WHERE slug = $2`,
        [productId, category, position],
      );
    }
    for (let vote = 0; vote < item.votes; vote += 1) {
      await query(
        `INSERT INTO product_votes
           (product_id, voter_hash, network_hash, active, is_demo, first_upvoted_at)
         VALUES ($1::uuid,$2,$3,true,true,now() - ($4::text || ' hours')::interval)`,
        [productId, demoHash(`${item.slug}:voter:${vote}`), demoHash(`${item.slug}:network:${Math.floor(vote / 2)}`), vote % 120],
      );
    }
  }

  const ids = await query<{ id: string; slug: string }>(
    `SELECT id::text, slug FROM products WHERE is_demo = true`,
  );
  const bySlug = new Map(ids.map((row) => [row.slug, row.id]));
  const updates = [
    ["bidboard", "launch", "New bidding category launched", "We added a dedicated category for transparent bidding products."],
    ["yourhour", "milestone", "Crossed first $100", "The original experiment crossed its first public revenue milestone."],
    ["attention-exchange", "feature", "Shipped public analytics", "Visitors and delivery totals now have a public source page."],
    ["toplink", "announcement", "Daily UTC rounds are live", "Every round now closes and restarts on a predictable UTC boundary."],
  ] as const;
  for (const [slug, type, title, body] of updates) {
    await query(
      `INSERT INTO product_updates (product_id, type, title, body, is_demo)
       VALUES ($1::uuid,$2,$3,$4,true)`,
      [bySlug.get(slug), type, title, body],
    );
  }

  const metrics = [
    ["bidboard", "revenue", "verified_live", "USD", 124800, null],
    ["bidboard", "visitors", "verified_live", "", 18400, null],
    ["bidboard", "outbound_clicks", "verified_by_bidindex", "", 3204, null],
    ["yourhour", "revenue", "publicly_sourced", "USD", 12700, "https://yourhour.lol"],
    ["yourhour", "outbound_clicks", "verified_by_bidindex", "", 618, null],
    ["attention-exchange", "revenue", "founder_reported", "USD", 84000, null],
    ["attention-exchange", "visitors", "verified_live", "", 9600, null],
    ["toplink", "outbound_clicks", "verified_by_bidindex", "", 2100, null],
    ["sponsor-stack", "revenue", "publicly_sourced", "EUR", 49000, "https://sponsor-stack.example/public"],
    ["pixel-bid", "bids", "verified_live", "", 312, null],
    ["pixel-bid", "highest_bid", "verified_live", "USD", 4800, null],
    ["rank-race", "visitors", "founder_reported", "", 4300, null],
  ] as const;
  for (const [slug, type, source, currency, value, sourceUrl] of metrics) {
    await query(
      `INSERT INTO product_metric_aggregates
         (product_id, metric_type, source, currency, value, source_url, last_event_at)
       VALUES ($1::uuid,$2,$3,$4,$5,$6,now())`,
      [bySlug.get(slug), type, source, currency, value, sourceUrl],
    );
  }

  console.log(`seeded ${DEMO.length} clearly labelled BidIndex demo products`);
  await getPool().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "demo seed failed");
  process.exit(1);
});
