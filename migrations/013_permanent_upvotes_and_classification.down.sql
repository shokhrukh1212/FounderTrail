-- Restore only category values that are still owned by this migration. A later
-- founder/admin correction changes provenance, so rollback deliberately leaves it
-- alone instead of overwriting newer work.
WITH originals AS (
  SELECT a.product_id,c.id AS category_id
    FROM product_classification_audits a
    JOIN categories c ON c.slug=a.old_value
    JOIN products p ON p.id=a.product_id
   WHERE a.classification_kind='category'
     AND a.classification_version='foundertrail-category-v1'
     AND p.category_provenance IN ('foundertrail-category-v1','foundertrail-category-v1-review')
)
UPDATE products p
   SET primary_category_id=o.category_id,updated_at=now()
  FROM originals o WHERE p.id=o.product_id;

DELETE FROM product_categories pc
 USING product_classification_audits a,products p
 WHERE pc.product_id=a.product_id AND p.id=a.product_id AND pc.position=0
   AND a.classification_kind='category'
   AND a.classification_version='foundertrail-category-v1'
   AND p.category_provenance IN ('foundertrail-category-v1','foundertrail-category-v1-review');
INSERT INTO product_categories(product_id,category_id,position)
SELECT p.id,p.primary_category_id,0
  FROM products p JOIN product_classification_audits a ON a.product_id=p.id
 WHERE a.classification_kind='category'
   AND a.classification_version='foundertrail-category-v1'
   AND p.category_provenance IN ('foundertrail-category-v1','foundertrail-category-v1-review')
ON CONFLICT(product_id,category_id) DO UPDATE SET position=0;

DROP INDEX IF EXISTS product_classification_review_idx;
DROP TABLE IF EXISTS product_classification_audits;

ALTER TABLE products
  DROP COLUMN IF EXISTS pricing_provenance,
  DROP COLUMN IF EXISTS pricing_checked_at,
  DROP COLUMN IF EXISTS pricing_evidence_url,
  DROP COLUMN IF EXISTS category_provenance,
  DROP COLUMN IF EXISTS category_review_required;

DROP INDEX IF EXISTS product_votes_authenticated_user_idx;
ALTER TABLE product_votes DROP COLUMN IF EXISTS user_id;
