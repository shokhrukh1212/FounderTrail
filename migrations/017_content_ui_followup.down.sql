-- Reverses 017. Archived category assignments are restored first, and only for products
-- that were never re-categorised afterwards, so a manual correction made after the reset
-- is never overwritten on the way back down.
DO $$
DECLARE
  run_version constant text := 'foundertrail-category-v2-reset';
BEGIN
  IF to_regclass('public.product_category_archive') IS NULL THEN RETURN; END IF;

  -- Eligible = still carrying the reset's provenance, so nobody has classified it since.
  CREATE TEMP TABLE restorable_products ON COMMIT DROP AS
    SELECT a.product_id,a.previous_primary_slug,a.previous_category_slugs,
           a.previous_provenance,a.previous_review_required
      FROM product_category_archive a JOIN products p ON p.id=a.product_id
     WHERE a.version=run_version AND p.category_provenance=run_version;

  DELETE FROM product_categories pc
   USING restorable_products r WHERE r.product_id=pc.product_id;

  INSERT INTO product_categories(product_id,category_id,position)
  SELECT r.product_id,c.id,(slug.ordinality-1)::smallint
    FROM restorable_products r
    CROSS JOIN LATERAL unnest(r.previous_category_slugs) WITH ORDINALITY AS slug(value,ordinality)
    JOIN categories c ON c.slug=slug.value
   WHERE slug.ordinality<=3
  ON CONFLICT DO NOTHING;

  UPDATE products p
     SET primary_category_id=(SELECT c.id FROM categories c WHERE c.slug=r.previous_primary_slug),
         category_provenance=r.previous_provenance,
         category_review_required=r.previous_review_required,
         updated_at=now()
    FROM restorable_products r
   WHERE r.product_id=p.id;
END $$;

UPDATE products p
   SET pricing_model=l.pricing_model,
       starting_price_minor=l.starting_price_minor,
       pricing_currency=l.pricing_currency,
       pricing_provenance=l.pricing_provenance,
       pricing_evidence_url=l.pricing_evidence_url,
       pricing_checked_at=l.pricing_checked_at
  FROM product_pricing_legacy l
 WHERE l.product_id=p.id AND p.pricing_source IS NULL;

DROP INDEX IF EXISTS product_comments_visible_idx;
DROP TABLE IF EXISTS category_migration_runs;
DROP TABLE IF EXISTS product_category_archive;
DROP TABLE IF EXISTS product_pricing_legacy;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_pricing_amount_check,
  DROP CONSTRAINT IF EXISTS products_pricing_detail_check,
  DROP CONSTRAINT IF EXISTS products_pricing_model_check;
ALTER TABLE products ADD CONSTRAINT products_pricing_model_check
  CHECK (pricing_model IS NULL OR pricing_model IN ('free','freemium','paid','open_source','contact','unknown'));

ALTER TABLE products
  DROP COLUMN IF EXISTS short_name,
  DROP COLUMN IF EXISTS short_name_source,
  DROP COLUMN IF EXISTS short_name_updated_at,
  DROP COLUMN IF EXISTS short_name_updated_by,
  DROP COLUMN IF EXISTS pricing_basis,
  DROP COLUMN IF EXISTS pricing_unit,
  DROP COLUMN IF EXISTS pricing_per_seat,
  DROP COLUMN IF EXISTS pricing_source,
  DROP COLUMN IF EXISTS pricing_confirmed_at,
  DROP COLUMN IF EXISTS pricing_confirmed_by,
  DROP COLUMN IF EXISTS is_open_source;
