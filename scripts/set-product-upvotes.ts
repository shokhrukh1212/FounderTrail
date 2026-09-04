/**
 * Withdraws a product's surplus upvotes down to a target count.
 *
 * Nothing is deleted: the surplus rows stay in `product_votes` with `active = false`, so
 * `product_vote_events` and the original rows remain available for a later audit. The
 * earliest upvotes are the ones kept.
 *
 *   npm run votes:set -- <slug> <target>          # dry run, prints the plan
 *   npm run votes:set -- <slug> <target> --apply  # writes
 */
import { getPool, query, withTransaction } from "../lib/db";

const [slug, rawTarget, ...flags] = process.argv.slice(2);
const target = Number.parseInt(rawTarget ?? "", 10);
const apply = flags.includes("--apply");

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !Number.isInteger(target) || target < 0) {
  console.error("usage: npm run votes:set -- <slug> <target> [--apply]");
  process.exit(1);
}

async function main() {
  const host = new URL((process.env.DATABASE_URL ?? process.env.POSTGRES_URL)!.replace(/^postgres/, "http")).host;
  console.log(`database: ${host}`);

  const products = await query<{ id: string; name: string; status: string; active_votes: number }>(
    `SELECT p.id::text, p.name, p.status,
            (SELECT count(*)::int FROM product_votes v
              WHERE v.product_id = p.id AND v.active AND (p.is_demo OR NOT v.is_demo)) AS active_votes
       FROM products p WHERE p.slug = $1`,
    [slug],
  );
  const product = products[0];
  if (!product) {
    console.error(`no product with slug "${slug}"`);
    process.exit(1);
  }
  console.log(`product:  ${product.name} (${slug}, ${product.status})`);
  console.log(`upvotes:  ${product.active_votes} -> ${target}`);

  if (product.active_votes <= target) {
    console.log("nothing to withdraw.");
    return;
  }
  if (!apply) {
    console.log(`\ndry run — would withdraw ${product.active_votes - target} upvote(s). Re-run with --apply to write.`);
    return;
  }

  const withdrawn = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE product_votes SET active = false, updated_at = now()
        WHERE product_id = $1::uuid AND active
          AND (product_id, voter_hash) NOT IN (
            SELECT product_id, voter_hash FROM product_votes
             WHERE product_id = $1::uuid AND active
             ORDER BY first_upvoted_at, voter_hash LIMIT $2
          )`,
      [product.id, target],
    );
    return result.rowCount ?? 0;
  });
  console.log(`withdrew ${withdrawn} upvote(s); rows kept for audit with active = false.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => getPool().end());
