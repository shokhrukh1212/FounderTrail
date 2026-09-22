/**
 * Recovery for the one-time category reset in migration 017.
 *
 * It restores each product's archived category assignments, but only for products that
 * still carry the reset's provenance — that is, products nobody has classified since.
 * A manual correction made in admin, a founder's own choice, or a newly submitted product
 * is never overwritten. Products are never deleted and no other metadata is touched.
 *
 *   npm run categories:restore            # dry run: prints exactly what would change
 *   npm run categories:restore -- --apply # applies it, inside one transaction
 */
import { databaseHost, getPool } from "../lib/db";

const VERSION = "foundertrail-category-v2-reset";
const apply = process.argv.includes("--apply");

type Candidate = {
  product_id: string;
  slug: string;
  previous_primary_slug: string | null;
  previous_category_slugs: string[];
  previous_provenance: string | null;
  previous_review_required: boolean;
  current_slugs: string[] | null;
};

async function main() {
  console.log(`restore-product-categories on ${databaseHost()} (${apply ? "apply" : "dry run"})`);
  const pool = getPool();
  try {
    const archived = await pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM product_category_archive WHERE version=$1`, [VERSION],
    );
    if (!archived.rows[0]?.total) {
      console.log(`No archive rows for ${VERSION}. Nothing to restore.`);
      return;
    }
    const candidates = await pool.query<Candidate>(
      `SELECT a.product_id::text,p.slug,a.previous_primary_slug,a.previous_category_slugs,
              a.previous_provenance,a.previous_review_required,
              (SELECT array_agg(c.slug ORDER BY pc.position) FROM product_categories pc
                 JOIN categories c ON c.id=pc.category_id WHERE pc.product_id=p.id) AS current_slugs
         FROM product_category_archive a JOIN products p ON p.id=a.product_id
        WHERE a.version=$1 AND p.category_provenance=$1
        ORDER BY p.slug`, [VERSION],
    );
    const restorable = candidates.rows.length;
    const skipped = archived.rows[0].total - restorable;
    console.log(JSON.stringify({
      version: VERSION,
      archived: archived.rows[0].total,
      restorable,
      skippedBecauseEditedSince: skipped,
      products: candidates.rows.map((row) => ({
        slug: row.slug,
        from: row.current_slugs ?? [],
        to: row.previous_category_slugs,
      })),
    }, null, 2));

    if (!apply) {
      console.log("Dry run only. Re-run with --apply to restore these assignments.");
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of candidates.rows) {
        await client.query(`DELETE FROM product_categories WHERE product_id=$1::uuid`, [row.product_id]);
        for (const [position, slug] of row.previous_category_slugs.slice(0, 3).entries()) {
          await client.query(
            `INSERT INTO product_categories(product_id,category_id,position)
             SELECT $1::uuid,c.id,$3 FROM categories c WHERE c.slug=$2
             ON CONFLICT DO NOTHING`, [row.product_id, slug, position],
          );
        }
        await client.query(
          `UPDATE products
              SET primary_category_id=(SELECT c.id FROM categories c WHERE c.slug=$2),
                  category_provenance=$3,category_review_required=$4,updated_at=now()
            WHERE id=$1::uuid`,
          [row.product_id, row.previous_primary_slug, row.previous_provenance, row.previous_review_required],
        );
      }
      await client.query("COMMIT");
      console.log(`Restored ${restorable} products. ${skipped} were left alone because they were classified after the reset.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Category restore failed.");
  process.exit(1);
});
