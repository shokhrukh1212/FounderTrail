-- Reopen only generic items still backed by this enrichment version. Later
-- founder/admin corrections change provenance and are intentionally untouched.
UPDATE product_classification_audits generic
   SET review_state='needs_review'
  FROM products p
 WHERE generic.product_id=p.id
   AND generic.classification_kind='category'
   AND generic.classification_version='foundertrail-category-v1'
   AND generic.review_state='rejected'
   AND p.category_provenance='foundertrail-public-metadata-v1'
   AND EXISTS (
     SELECT 1 FROM product_classification_audits evidence
      WHERE evidence.product_id=generic.product_id
        AND evidence.classification_kind='category'
        AND evidence.classification_version='foundertrail-public-metadata-v1'
        AND evidence.review_state='applied'
   );
