CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE product_votes
  ADD COLUMN user_id text REFERENCES app_users(id) ON DELETE CASCADE;

-- A launch vote is the same support event viewed through a weekly window. Preserve
-- known identities and their original first-vote time without touching anonymous
-- BidIndex history.
INSERT INTO product_votes
  (product_id,voter_hash,network_hash,active,is_demo,first_upvoted_at,updated_at,user_id)
SELECT pl.product_id,
       encode(digest('foundertrail-product-vote-v1:'||lv.user_id,'sha256'),'hex'),
       encode(digest('foundertrail-product-vote-network-v1:'||lv.user_id,'sha256'),'hex'),
       lv.active,false,lv.created_at,lv.updated_at,lv.user_id
  FROM launch_votes lv
  JOIN product_launches pl ON pl.id=lv.launch_id
ON CONFLICT(product_id,voter_hash) DO NOTHING;

CREATE UNIQUE INDEX product_votes_authenticated_user_idx
  ON product_votes(product_id,user_id) WHERE user_id IS NOT NULL;

ALTER TABLE products
  ADD COLUMN category_review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN category_provenance text,
  ADD COLUMN pricing_evidence_url text,
  ADD COLUMN pricing_checked_at timestamptz,
  ADD COLUMN pricing_provenance text;

INSERT INTO categories(slug,name) VALUES
  ('ai-tools','AI tools'),
  ('productivity','Productivity'),
  ('developer-tools','Developer tools'),
  ('marketing-seo','Marketing & SEO'),
  ('sales-crm','Sales & CRM'),
  ('design-creative','Design & creative'),
  ('writing-content','Writing & content'),
  ('analytics-data','Analytics & data'),
  ('finance-accounting','Finance & accounting'),
  ('ecommerce','E-commerce'),
  ('education','Education'),
  ('health-fitness','Health & fitness'),
  ('travel','Travel'),
  ('games','Games'),
  ('directories-discovery','Directories & discovery'),
  ('advertising-sponsorship','Advertising & sponsorship'),
  ('other','Other')
ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name;

CREATE TABLE product_classification_audits (
  id bigserial PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  classification_kind text NOT NULL CHECK (classification_kind IN ('category','pricing')),
  old_value text,
  proposed_value text NOT NULL,
  evidence_url text,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  confidence text NOT NULL CHECK (confidence IN ('high','medium','low')),
  review_state text NOT NULL CHECK (review_state IN ('applied','needs_review','rejected')),
  classification_version text NOT NULL,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id,classification_kind,classification_version)
);
CREATE INDEX product_classification_review_idx
  ON product_classification_audits(review_state,classification_kind,created_at);

-- These five mappings are supported directly by the saved public descriptions and
-- were called out for verification in the owner-approved migration brief.
WITH mapping(slug,new_slug,reason) AS (VALUES
  ('topamine','games','Saved description identifies a word puzzle game.'),
  ('saas-town-a-gamified-3d-directory-for-sa','directories-discovery','Saved description identifies a gamified SaaS directory.'),
  ('letslaunch','directories-discovery','Saved description identifies a startup launch directory.'),
  ('keepbidding','advertising-sponsorship','Saved description identifies a paid ranking and promotion product.'),
  ('million-dollar-tower','advertising-sponsorship','Saved description identifies paid permanent promotional placements.')
), candidates AS (
  SELECT p.id,p.slug,old.slug AS old_slug,m.new_slug,m.reason,new_category.id AS new_category_id
    FROM mapping m
    JOIN products p ON p.slug=m.slug
    LEFT JOIN categories old ON old.id=p.primary_category_id
    JOIN categories new_category ON new_category.slug=m.new_slug
   WHERE old.slug='ad-auction-billboard'
)
INSERT INTO product_classification_audits
  (product_id,classification_kind,old_value,proposed_value,reason,confidence,review_state,classification_version,applied_at)
SELECT id,'category',old_slug,new_slug,reason,'high','applied','foundertrail-category-v1',now()
  FROM candidates
ON CONFLICT(product_id,classification_kind,classification_version) DO NOTHING;

WITH mapping(slug,new_slug) AS (VALUES
  ('topamine','games'),
  ('saas-town-a-gamified-3d-directory-for-sa','directories-discovery'),
  ('letslaunch','directories-discovery'),
  ('keepbidding','advertising-sponsorship'),
  ('million-dollar-tower','advertising-sponsorship')
), candidates AS (
  SELECT p.id,new_category.id AS new_category_id
    FROM mapping m JOIN products p ON p.slug=m.slug
    JOIN categories old ON old.id=p.primary_category_id AND old.slug='ad-auction-billboard'
    JOIN categories new_category ON new_category.slug=m.new_slug
)
UPDATE products p
   SET primary_category_id=c.new_category_id,
       category_review_required=false,
       category_provenance='foundertrail-category-v1',
       updated_at=now()
  FROM candidates c WHERE p.id=c.id;

DELETE FROM product_categories pc
 USING products p
 WHERE pc.product_id=p.id AND pc.position=0
   AND p.category_provenance='foundertrail-category-v1';
INSERT INTO product_categories(product_id,category_id,position)
SELECT p.id,p.primary_category_id,0 FROM products p
 WHERE p.category_provenance='foundertrail-category-v1'
ON CONFLICT(product_id,category_id) DO UPDATE SET position=0;

-- The old bulk default is not trustworthy evidence. Keep those products visible,
-- expose them as Other, and place them in the private review queue.
WITH candidates AS (
  SELECT p.id,old.slug AS old_slug,other.id AS other_id
    FROM products p
    JOIN categories old ON old.id=p.primary_category_id AND old.slug='ad-auction-billboard'
    JOIN categories other ON other.slug='other'
)
INSERT INTO product_classification_audits
  (product_id,classification_kind,old_value,proposed_value,reason,confidence,review_state,classification_version)
SELECT id,'category',old_slug,'other','Legacy bulk category was not supported by product-specific evidence.','low','needs_review','foundertrail-category-v1'
  FROM candidates
ON CONFLICT(product_id,classification_kind,classification_version) DO NOTHING;

WITH candidates AS (
  SELECT p.id,other.id AS other_id
    FROM products p
    JOIN categories old ON old.id=p.primary_category_id AND old.slug='ad-auction-billboard'
    JOIN categories other ON other.slug='other'
)
UPDATE products p
   SET primary_category_id=c.other_id,
       category_review_required=true,
       category_provenance='foundertrail-category-v1-review',
       updated_at=now()
  FROM candidates c WHERE p.id=c.id;

DELETE FROM product_categories pc
 USING products p
 WHERE pc.product_id=p.id AND pc.position=0
   AND p.category_provenance='foundertrail-category-v1-review';
INSERT INTO product_categories(product_id,category_id,position)
SELECT p.id,p.primary_category_id,0 FROM products p
 WHERE p.category_provenance='foundertrail-category-v1-review'
ON CONFLICT(product_id,category_id) DO UPDATE SET position=0;
