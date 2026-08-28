ALTER TABLE products ALTER COLUMN description DROP NOT NULL;
ALTER TABLE products ALTER COLUMN founder_name DROP NOT NULL;
ALTER TABLE products ALTER COLUMN bidding_mechanism DROP NOT NULL;

ALTER TABLE products
  ADD COLUMN launch_date date,
  ADD COLUMN submitted_url text,
  ADD COLUMN submission_consent_at timestamptz,
  ADD COLUMN submission_consent_version text,
  ADD COLUMN primary_category_id bigint REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN domain_override_approved boolean NOT NULL DEFAULT false;

UPDATE products
   SET launch_date = (launch_at AT TIME ZONE 'UTC')::date,
       submitted_url = website_url
 WHERE launch_date IS NULL OR submitted_url IS NULL;

ALTER TABLE products ALTER COLUMN launch_date SET NOT NULL;
ALTER TABLE products ALTER COLUMN submitted_url SET NOT NULL;

INSERT INTO categories (slug, name) VALUES
  ('pay-to-rank-directory', 'Pay-to-rank directory'),
  ('ad-auction-billboard', 'Ad auction or digital billboard'),
  ('marketplace-sponsorship', 'Marketplace or sponsorship'),
  ('game-experiment', 'Game or experiment'),
  ('other', 'Other')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

UPDATE products p
   SET primary_category_id = (
    SELECT replacement.id
      FROM product_categories pc
      JOIN categories legacy ON legacy.id = pc.category_id
      JOIN categories replacement ON replacement.slug = CASE
        WHEN legacy.slug = 'pay-to-rank' THEN 'pay-to-rank-directory'
        WHEN legacy.slug IN ('ad-auction','link-marketplace') THEN 'ad-auction-billboard'
        WHEN legacy.slug IN ('attention-marketplace','sponsorship-board') THEN 'marketplace-sponsorship'
        WHEN legacy.slug = 'bidding-game' THEN 'game-experiment'
        ELSE 'other' END
     WHERE pc.product_id = p.id
     ORDER BY pc.position
     LIMIT 1
  )
 WHERE p.primary_category_id IS NULL;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_normalized_domain_key;
CREATE INDEX products_normalized_domain_lookup_idx ON products (normalized_domain, status);
CREATE UNIQUE INDEX products_published_domain_unique_idx
  ON products (normalized_domain)
  WHERE status = 'published' AND NOT domain_override_approved;
CREATE INDEX products_launch_date_idx ON products (launch_date DESC, id) WHERE status = 'published';

CREATE TABLE product_submission_metadata (
  product_id          uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  original_url        text NOT NULL,
  final_url           text NOT NULL,
  fetch_status        text NOT NULL CHECK (fetch_status IN ('success','partial','failed','manual')),
  extracted_name      text CHECK (extracted_name IS NULL OR char_length(extracted_name) <= 80),
  extracted_tagline   text CHECK (extracted_tagline IS NULL OR char_length(extracted_tagline) <= 180),
  extracted_logo_url  text,
  extracted_image_url text,
  fetched_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_public_evidence (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  metric_type           text NOT NULL CHECK (metric_type IN ('revenue','visitors','outbound_clicks','bids','other')),
  evidence_url          text NOT NULL,
  note                  text CHECK (note IS NULL OR char_length(note) <= 500),
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  accepted_value        bigint CHECK (accepted_value IS NULL OR accepted_value >= 0),
  accepted_currency     text CHECK (accepted_currency IS NULL OR accepted_currency ~ '^[A-Z]{3}$'),
  reviewer_note         text CHECK (reviewer_note IS NULL OR char_length(reviewer_note) <= 1000),
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at           timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CHECK ((metric_type = 'revenue' AND (accepted_value IS NULL OR accepted_currency IS NOT NULL))
      OR (metric_type <> 'revenue' AND accepted_currency IS NULL))
);
CREATE INDEX product_public_evidence_review_idx ON product_public_evidence (status, submitted_at);
CREATE INDEX product_public_evidence_product_idx ON product_public_evidence (product_id, submitted_at DESC);

ALTER TABLE product_moderation_events
  ADD COLUMN internal_reason text CHECK (internal_reason IS NULL OR char_length(internal_reason) <= 1000);
