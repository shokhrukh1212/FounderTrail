-- Content and product UI follow-up.
--
-- Additive to everything that already exists: product ids, slugs, ownership, votes,
-- follows, comments, click history and analytics are not touched. The one requested
-- destructive step is the category reset, which archives every existing assignment
-- first and is guarded by a recorded run so it can never fire twice.

-- 1. The FounderTrail taxonomy. Old category rows are left in place because historical
--    assignments in product_category_archive reference their slugs; the application
--    offers only the slugs listed here.
INSERT INTO categories(slug,name) VALUES
  ('ai-assistants','AI & Assistants'),
  ('developer-tools','Developer Tools'),
  ('no-code-automation','No-Code & Automation'),
  ('productivity','Productivity'),
  ('design-creative','Design & Creative'),
  ('writing-content','Writing & Content'),
  ('video-audio','Video & Audio'),
  ('marketing-seo','Marketing & SEO'),
  ('sales-crm','Sales & CRM'),
  ('customer-support','Customer Support'),
  ('analytics-data','Analytics & Data'),
  ('finance-accounting','Finance & Accounting'),
  ('ecommerce-retail','E-commerce & Retail'),
  ('hr-recruiting','HR & Recruiting'),
  ('business-operations','Business Operations'),
  ('cybersecurity-privacy','Cybersecurity & Privacy'),
  ('education-learning','Education & Learning'),
  ('health-wellness','Health & Wellness'),
  ('social-community','Social & Community'),
  ('games-entertainment','Games & Entertainment'),
  ('travel-lifestyle','Travel & Lifestyle'),
  ('marketplaces-directories','Marketplaces & Directories'),
  ('hardware-iot','Hardware & IoT'),
  ('other','Other')
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name;

-- 2. An optional short brand name, separate from the original submitted name. It is only
--    ever written by a founder or an admin, so an unreviewed legacy name keeps showing
--    exactly what was submitted.
ALTER TABLE products
  ADD COLUMN short_name text CHECK (short_name IS NULL OR char_length(btrim(short_name)) BETWEEN 1 AND 60),
  ADD COLUMN short_name_source text CHECK (short_name_source IS NULL OR short_name_source IN ('founder','admin')),
  ADD COLUMN short_name_updated_at timestamptz,
  ADD COLUMN short_name_updated_by text REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN pricing_basis text CHECK (pricing_basis IS NULL OR pricing_basis IN ('one_time','monthly','yearly','usage_based')),
  ADD COLUMN pricing_unit text CHECK (pricing_unit IS NULL OR char_length(pricing_unit) <= 60),
  ADD COLUMN pricing_per_seat boolean NOT NULL DEFAULT false,
  ADD COLUMN pricing_source text CHECK (pricing_source IS NULL OR pricing_source IN ('founder','admin')),
  ADD COLUMN pricing_confirmed_at timestamptz,
  ADD COLUMN pricing_confirmed_by text REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN is_open_source boolean NOT NULL DEFAULT false;

-- 3. Pricing belongs to the founder. Everything previously inferred from a public page is
--    archived for private review and removed from the public surface; open source is kept
--    separately because it is a characteristic, not a price.
CREATE TABLE product_pricing_legacy (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  pricing_model text,
  starting_price_minor bigint,
  pricing_currency text,
  pricing_provenance text,
  pricing_evidence_url text,
  pricing_checked_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO product_pricing_legacy
  (product_id,pricing_model,starting_price_minor,pricing_currency,pricing_provenance,pricing_evidence_url,pricing_checked_at)
SELECT id,pricing_model,starting_price_minor,pricing_currency,pricing_provenance,pricing_evidence_url,pricing_checked_at
  FROM products
 WHERE pricing_model IS NOT NULL OR starting_price_minor IS NOT NULL
ON CONFLICT(product_id) DO NOTHING;

UPDATE products SET is_open_source=true WHERE pricing_model='open_source';

-- Founder and admin entries keep their model and are marked as supplied by a person. An
-- archived amount is not re-published: it was stored without a billing basis, so it
-- cannot be shown as "USD 1/month" or "USD 1 one-time" without inventing the missing half.
UPDATE products
   SET pricing_model=CASE WHEN pricing_model IN ('free','freemium','paid','contact') THEN pricing_model ELSE NULL END,
       pricing_source=CASE WHEN pricing_model IN ('free','freemium','paid','contact') THEN 'founder' ELSE NULL END,
       pricing_confirmed_at=CASE WHEN pricing_model IN ('free','freemium','paid','contact') THEN COALESCE(pricing_checked_at,now()) ELSE NULL END,
       starting_price_minor=NULL,
       pricing_currency=NULL
 WHERE pricing_provenance IN ('founder','admin');

-- Anything else was machine-inferred. It stops being public immediately.
UPDATE products
   SET pricing_model=NULL,starting_price_minor=NULL,pricing_currency=NULL,
       pricing_source=NULL,pricing_confirmed_at=NULL
 WHERE pricing_provenance IS NULL OR pricing_provenance NOT IN ('founder','admin');

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_pricing_model_check;
ALTER TABLE products ADD CONSTRAINT products_pricing_model_check
  CHECK (pricing_model IS NULL OR pricing_model IN ('free','freemium','paid','contact'));
ALTER TABLE products ADD CONSTRAINT products_pricing_amount_check CHECK (
  starting_price_minor IS NULL OR (
    pricing_model IN ('freemium','paid')
    AND pricing_currency IS NOT NULL
    AND pricing_basis IS NOT NULL
    AND (pricing_basis <> 'usage_based' OR pricing_unit IS NOT NULL)));
ALTER TABLE products ADD CONSTRAINT products_pricing_detail_check CHECK (
  starting_price_minor IS NOT NULL OR (pricing_basis IS NULL AND pricing_unit IS NULL AND pricing_per_seat=false));

-- 4. Categories: archive, then reset to Other exactly once.
CREATE TABLE product_category_archive (
  id bigserial PRIMARY KEY,
  version text NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  previous_primary_slug text,
  previous_category_slugs text[] NOT NULL DEFAULT '{}',
  previous_provenance text,
  previous_review_required boolean NOT NULL DEFAULT false,
  archived_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version,product_id)
);
CREATE INDEX product_category_archive_version_idx ON product_category_archive(version,product_id);

CREATE TABLE category_migration_runs (
  version text PRIMARY KEY,
  target_product_count integer NOT NULL,
  before_counts jsonb NOT NULL,
  after_counts jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE
  run_version constant text := 'foundertrail-category-v2-reset';
  other_id bigint;
  before_counts jsonb;
  after_counts jsonb;
  affected integer;
BEGIN
  IF EXISTS (SELECT 1 FROM category_migration_runs WHERE version=run_version) THEN
    RAISE NOTICE 'Category reset % already completed; current assignments left untouched.', run_version;
    RETURN;
  END IF;

  SELECT id INTO STRICT other_id FROM categories WHERE slug='other';

  SELECT COALESCE(jsonb_object_agg(slug,total),'{}'::jsonb) INTO before_counts
    FROM (SELECT COALESCE(c.slug,'unassigned') AS slug,count(*)::int AS total
            FROM products p LEFT JOIN categories c ON c.id=p.primary_category_id
           GROUP BY 1) summary;

  -- The fixed target set: every product that exists right now, with its assignments.
  INSERT INTO product_category_archive
    (version,product_id,previous_primary_slug,previous_category_slugs,previous_provenance,previous_review_required)
  SELECT run_version,p.id,c.slug,
         COALESCE((SELECT array_agg(pcc.slug ORDER BY pc.position)
                     FROM product_categories pc JOIN categories pcc ON pcc.id=pc.category_id
                    WHERE pc.product_id=p.id),'{}'::text[]),
         p.category_provenance,p.category_review_required
    FROM products p LEFT JOIN categories c ON c.id=p.primary_category_id;
  GET DIAGNOSTICS affected = ROW_COUNT;

  DELETE FROM product_categories pc
   USING product_category_archive a
   WHERE a.version=run_version AND a.product_id=pc.product_id;

  INSERT INTO product_categories(product_id,category_id,position)
  SELECT a.product_id,other_id,0 FROM product_category_archive a WHERE a.version=run_version;

  UPDATE products p
     SET primary_category_id=other_id,
         category_provenance=run_version,
         category_review_required=true,
         updated_at=now()
    FROM product_category_archive a
   WHERE a.version=run_version AND a.product_id=p.id;

  SELECT COALESCE(jsonb_object_agg(slug,total),'{}'::jsonb) INTO after_counts
    FROM (SELECT COALESCE(c.slug,'unassigned') AS slug,count(*)::int AS total
            FROM products p LEFT JOIN categories c ON c.id=p.primary_category_id
           GROUP BY 1) summary;

  INSERT INTO category_migration_runs(version,target_product_count,before_counts,after_counts)
  VALUES (run_version,affected,before_counts,after_counts);

  RAISE NOTICE 'Category reset % applied to % products.', run_version, affected;
END $$;

-- 5. Visible comment counts are read for a whole page of products at a time.
CREATE INDEX IF NOT EXISTS product_comments_visible_idx
  ON product_comments(product_id) WHERE hidden_at IS NULL;
