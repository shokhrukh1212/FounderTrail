CREATE TABLE IF NOT EXISTS products (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                       text NOT NULL UNIQUE,
  website_url                text NOT NULL,
  normalized_domain          text NOT NULL UNIQUE,
  name                       text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  tagline                    text NOT NULL CHECK (char_length(tagline) BETWEEN 1 AND 180),
  description                text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 5000),
  founder_name               text NOT NULL CHECK (char_length(founder_name) BETWEEN 1 AND 120),
  contact_email              text NOT NULL CHECK (char_length(contact_email) BETWEEN 3 AND 320),
  founder_social_handle      text CHECK (founder_social_handle IS NULL OR char_length(founder_social_handle) <= 120),
  bidding_mechanism          text NOT NULL CHECK (char_length(bidding_mechanism) BETWEEN 1 AND 2000),
  minimum_bid_minor          bigint CHECK (minimum_bid_minor IS NULL OR minimum_bid_minor >= 0),
  current_bid_minor          bigint CHECK (current_bid_minor IS NULL OR current_bid_minor >= 0),
  bid_currency               text CHECK (bid_currency IS NULL OR bid_currency ~ '^[A-Z]{3}$'),
  public_analytics_url       text,
  data_disclosure            text CHECK (data_disclosure IS NULL OR char_length(data_disclosure) <= 1000),
  status                     text NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('draft','pending','published','rejected','archived')),
  is_demo                    boolean NOT NULL DEFAULT false,
  launch_at                  timestamptz NOT NULL,
  submitted_at               timestamptz NOT NULL DEFAULT now(),
  published_at               timestamptz,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  legacy_campaign_id         bigint UNIQUE REFERENCES campaigns(id) ON DELETE SET NULL,
  CHECK ((minimum_bid_minor IS NULL AND current_bid_minor IS NULL AND bid_currency IS NULL)
      OR (bid_currency IS NOT NULL AND (minimum_bid_minor IS NOT NULL OR current_bid_minor IS NOT NULL))),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS products_status_published_idx
  ON products (status, published_at DESC, id);
CREATE INDEX IF NOT EXISTS products_launch_idx
  ON products (launch_at DESC, id) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS products_demo_idx ON products (is_demo);

CREATE TABLE IF NOT EXISTS categories (
  id          bigserial PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_categories (
  product_id   uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category_id  bigint NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  position     smallint NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 2),
  PRIMARY KEY (product_id, category_id),
  UNIQUE (product_id, position)
);
CREATE INDEX IF NOT EXISTS product_categories_category_idx ON product_categories (category_id, product_id);

CREATE TABLE IF NOT EXISTS product_media (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('logo','screenshot','update')),
  storage_key   text NOT NULL UNIQUE,
  public_url    text NOT NULL,
  mime_type     text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  byte_size     integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 5242880),
  width         integer CHECK (width IS NULL OR width BETWEEN 1 AND 6000),
  height        integer CHECK (height IS NULL OR height BETWEEN 1 AND 6000),
  alt_text      text CHECK (alt_text IS NULL OR char_length(alt_text) <= 240),
  position      smallint NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 3),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_media_one_logo_idx
  ON product_media (product_id) WHERE kind = 'logo';
CREATE UNIQUE INDEX IF NOT EXISTS product_media_screenshot_position_idx
  ON product_media (product_id, position) WHERE kind = 'screenshot';
CREATE INDEX IF NOT EXISTS product_media_product_idx ON product_media (product_id, kind, position);

CREATE TABLE IF NOT EXISTS product_owner_credentials (
  product_id      uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  token_hash      text NOT NULL CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  token_version   integer NOT NULL DEFAULT 1 CHECK (token_version > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  rotated_at      timestamptz
);

CREATE TABLE IF NOT EXISTS product_votes (
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  voter_hash        text NOT NULL CHECK (voter_hash ~ '^[a-f0-9]{64}$'),
  network_hash      text NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  active            boolean NOT NULL DEFAULT true,
  is_demo           boolean NOT NULL DEFAULT false,
  first_upvoted_at  timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, voter_hash)
);
CREATE INDEX IF NOT EXISTS product_votes_trending_idx
  ON product_votes (product_id, first_upvoted_at DESC) WHERE active;
CREATE INDEX IF NOT EXISTS product_votes_network_idx
  ON product_votes (network_hash, updated_at DESC);

CREATE TABLE IF NOT EXISTS product_updates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type          text NOT NULL CHECK (type IN ('feature','milestone','launch','announcement')),
  title         text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 140),
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1500),
  link_url      text,
  image_media_id uuid REFERENCES product_media(id) ON DELETE SET NULL,
  is_demo       boolean NOT NULL DEFAULT false,
  published_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_updates_recent_idx
  ON product_updates (published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS product_updates_product_idx
  ON product_updates (product_id, published_at DESC);

CREATE TABLE IF NOT EXISTS product_outbound_click_events (
  id            bigserial PRIMARY KEY,
  product_id    uuid REFERENCES products(id) ON DELETE SET NULL,
  visitor_hash  text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  network_hash  text NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  outcome       text NOT NULL CHECK (outcome IN ('counted','duplicate','bot','owner','rate_limited','not_found','error')),
  source        text NOT NULL DEFAULT 'product' CHECK (source IN ('product','badge')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_outbound_click_unique_counted_idx
  ON product_outbound_click_events (product_id, visitor_hash) WHERE outcome = 'counted';
CREATE INDEX IF NOT EXISTS product_outbound_click_product_time_idx
  ON product_outbound_click_events (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS product_outbound_click_network_time_idx
  ON product_outbound_click_events (network_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS product_metric_aggregates (
  product_id       uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  metric_type      text NOT NULL CHECK (metric_type IN ('visitors','revenue','outbound_clicks','bids','purchases','current_bid','highest_bid')),
  source           text NOT NULL CHECK (source IN ('verified_live','verified_by_bidindex','publicly_sourced','founder_reported')),
  currency         text NOT NULL DEFAULT '' CHECK (currency = '' OR currency ~ '^[A-Z]{3}$'),
  value            bigint NOT NULL CHECK (value >= 0),
  source_url       text,
  last_event_at    timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, metric_type, source, currency),
  CHECK ((metric_type IN ('revenue','current_bid','highest_bid') AND currency <> '')
      OR (metric_type NOT IN ('revenue','current_bid','highest_bid') AND currency = '')),
  CHECK (source <> 'publicly_sourced' OR source_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS product_metric_rank_idx
  ON product_metric_aggregates (metric_type, currency, source, value DESC, product_id);

CREATE TABLE IF NOT EXISTS api_rate_limit_events (
  id          bigserial PRIMARY KEY,
  action      text NOT NULL,
  key_hash    text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_rate_limit_lookup_idx
  ON api_rate_limit_events (action, key_hash, created_at DESC);

INSERT INTO categories (slug, name) VALUES
  ('pay-to-rank', 'Pay-to-rank directories'),
  ('attention-marketplace', 'Attention marketplaces'),
  ('ad-auction', 'Ad auctions'),
  ('link-marketplace', 'Link marketplaces'),
  ('sponsorship-board', 'Sponsorship boards'),
  ('bidding-game', 'Bidding games')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;
