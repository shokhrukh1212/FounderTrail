-- Additive: preserve original timestamps, launch IDs and every historical vote.
ALTER TABLE products ADD COLUMN launch_choice text NOT NULL DEFAULT 'now' CHECK (launch_choice IN ('now','scheduled','none')),
  ADD COLUMN requested_launch_at timestamptz,
  ADD COLUMN legacy_contact_email text;
-- Immutable recovery evidence. Application listing edits never update this snapshot.
UPDATE products SET legacy_contact_email=contact_email;
ALTER TABLE product_launches ADD COLUMN starts_at timestamptz;
UPDATE product_launches pl SET starts_at=lw.starts_at FROM launch_weeks lw WHERE lw.id=pl.launch_week_id;
ALTER TABLE product_launches ALTER COLUMN starts_at SET NOT NULL;
CREATE INDEX product_launch_actual_start_idx ON product_launches(starts_at);
CREATE FUNCTION foundertrail_launch_start() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.starts_at IS NULL THEN SELECT starts_at INTO NEW.starts_at FROM launch_weeks WHERE id=NEW.launch_week_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER launch_start_default BEFORE INSERT ON product_launches FOR EACH ROW EXECUTE FUNCTION foundertrail_launch_start();
CREATE TABLE product_identities (
  identity text PRIMARY KEY,
  product_id uuid REFERENCES products(id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE product_activation (
  product_id uuid PRIMARY KEY REFERENCES products(id),
  post_draft text CHECK (length(post_draft)<=2000),
  share_state text NOT NULL DEFAULT 'todo' CHECK (share_state IN ('todo','self_reported','skipped')),
  composer_opened_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE product_access_tokens (
  token_hash text PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id),
  claimant_id text NOT NULL REFERENCES app_users(id),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_users ADD COLUMN google_authority_email text, ADD COLUMN google_authority_at text;
CREATE FUNCTION foundertrail_product_identity(raw text) RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT lower(regexp_replace(substring(raw FROM '(?i)^https?://([^/?#]+)'), '^www\.', '', 'i')) ||
    regexp_replace(split_part(rest,'?',1), '/+$', '') ||
    CASE WHEN strpos(rest,'?')>0 THEN substring(rest FROM strpos(rest,'?')) ELSE '' END
  FROM (SELECT split_part(regexp_replace(raw,'(?i)^https?://[^/?#]+',''), '#', 1) AS rest) normalized
$$;
INSERT INTO product_identities(identity,product_id)
  SELECT foundertrail_product_identity(website_url),CASE WHEN count(*)=1 THEN (array_agg(id))[1] ELSE NULL END
  FROM products WHERE foundertrail_product_identity(website_url) IS NOT NULL GROUP BY 1;
CREATE FUNCTION foundertrail_reserve_identity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE key text; held uuid;
BEGIN
  -- Preserve editable legacy duplicates until an administrator resolves their identity.
  IF TG_OP='UPDATE' AND NEW.website_url=OLD.website_url THEN RETURN NEW; END IF;
  key := foundertrail_product_identity(NEW.website_url);
  IF key IS NULL THEN RAISE EXCEPTION 'Invalid public URL identity' USING ERRCODE='23514'; END IF;
  INSERT INTO product_identities(identity,product_id) VALUES(key,NEW.id) ON CONFLICT DO NOTHING;
  SELECT product_id INTO held FROM product_identities WHERE identity=key FOR UPDATE;
  IF held IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'Product identity already reserved' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER product_identity_guard BEFORE INSERT OR UPDATE OF website_url ON products FOR EACH ROW EXECUTE FUNCTION foundertrail_reserve_identity();
-- Product URLs, including shared-host paths, now enforce identity instead of hostname.
DROP INDEX products_published_domain_unique_idx;
