import "server-only";
import type { PoolClient } from "pg";
import { FOUNDERTRAIL_CATEGORY_SLUGS, MAX_PRODUCT_CATEGORIES, normalizeCategorySelection } from "./categories";

export class InvalidCategorySelection extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCategorySelection";
  }
}

/**
 * Write a product's 1-3 categories. Position 0 is the primary one and is mirrored into
 * products.primary_category_id, which is what ordering, the admin table and legacy
 * queries still read. Every writer — submission, founder editing, moderation, admin
 * editing — goes through here so the two representations cannot drift apart.
 */
export async function applyProductCategories(
  client: PoolClient,
  productId: string,
  slugs: readonly string[],
  provenance: "founder" | "admin",
): Promise<string[]> {
  const selection = normalizeCategorySelection([...slugs]);
  if (!selection.ok) throw new InvalidCategorySelection(selection.error);
  const rows = await client.query<{ id: string; slug: string }>(
    `SELECT id::text,slug FROM categories WHERE slug=ANY($1::text[])`,
    [selection.slugs],
  );
  const byslug = new Map(rows.rows.map((row) => [row.slug, row.id]));
  const ordered = selection.slugs.map((slug) => {
    const id = byslug.get(slug);
    if (!id) throw new InvalidCategorySelection("Choose categories from the FounderTrail list.");
    return { slug, id };
  });
  await client.query(`DELETE FROM product_categories WHERE product_id=$1::uuid`, [productId]);
  for (const [position, category] of ordered.entries()) {
    if (position >= MAX_PRODUCT_CATEGORIES) break;
    await client.query(
      `INSERT INTO product_categories(product_id,category_id,position) VALUES($1::uuid,$2::bigint,$3)`,
      [productId, category.id, position],
    );
  }
  await client.query(
    `UPDATE products SET primary_category_id=$2::bigint,category_provenance=$3,category_review_required=false,updated_at=now() WHERE id=$1::uuid`,
    [productId, ordered[0].id, provenance],
  );
  return ordered.map((category) => category.slug);
}

/** The taxonomy as stored, so a form can be built without a second source of truth. */
export const TAXONOMY_SLUGS: readonly string[] = FOUNDERTRAIL_CATEGORY_SLUGS;
