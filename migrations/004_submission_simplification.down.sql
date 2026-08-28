ALTER TABLE product_moderation_events DROP COLUMN IF EXISTS internal_reason;
DROP TABLE IF EXISTS product_public_evidence;
DROP TABLE IF EXISTS product_submission_metadata;
DROP INDEX IF EXISTS products_launch_date_idx;
DROP INDEX IF EXISTS products_published_domain_unique_idx;
DROP INDEX IF EXISTS products_normalized_domain_lookup_idx;
ALTER TABLE products ADD CONSTRAINT products_normalized_domain_key UNIQUE (normalized_domain);
ALTER TABLE products
  DROP COLUMN IF EXISTS domain_override_approved,
  DROP COLUMN IF EXISTS primary_category_id,
  DROP COLUMN IF EXISTS submission_consent_version,
  DROP COLUMN IF EXISTS submission_consent_at,
  DROP COLUMN IF EXISTS submitted_url,
  DROP COLUMN IF EXISTS launch_date;
