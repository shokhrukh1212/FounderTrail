ALTER TABLE visitors
  ADD COLUMN eligible boolean NOT NULL DEFAULT true,
  ADD COLUMN network_hash text;
ALTER TABLE visitors ADD CONSTRAINT visitors_network_hash_check
  CHECK (network_hash IS NULL OR network_hash ~ '^[a-f0-9]{64}$');
CREATE INDEX visitors_eligible_idx ON visitors (first_seen_at) WHERE eligible;

CREATE TABLE product_listing_view_events (
  id            bigserial PRIMARY KEY,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  visitor_hash  text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  network_hash  text NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  metric_date   date NOT NULL,
  outcome       text NOT NULL CHECK (outcome IN ('counted','duplicate','bot','owner','rate_limited')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_listing_view_counted_idx
  ON product_listing_view_events (product_id, visitor_hash, metric_date) WHERE outcome='counted';
CREATE INDEX product_listing_view_product_idx ON product_listing_view_events (product_id, created_at DESC);

CREATE TABLE founder_referral_events (
  id                bigserial PRIMARY KEY,
  source_product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  visitor_hash      text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  network_hash      text NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  landing_path      text NOT NULL CHECK (char_length(landing_path) BETWEEN 1 AND 500),
  outcome           text NOT NULL CHECK (outcome IN ('counted','duplicate','bot','owner','rate_limited','invalid')),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX founder_referral_counted_idx
  ON founder_referral_events (source_product_id, visitor_hash) WHERE outcome='counted';
CREATE INDEX founder_referral_product_idx ON founder_referral_events (source_product_id, created_at DESC);

CREATE TABLE product_share_events (
  id            bigserial PRIMARY KEY,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_name    text NOT NULL CHECK (event_name='share_intent_opened'),
  visitor_hash  text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  network_hash  text NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  source        text NOT NULL CHECK (source IN ('owner','product','email','admin','unknown')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_share_events_product_idx ON product_share_events (product_id, created_at DESC);

CREATE TABLE product_vote_events (
  id            bigserial PRIMARY KEY,
  product_id    uuid REFERENCES products(id) ON DELETE SET NULL,
  visitor_hash  text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  network_hash  text NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  outcome       text NOT NULL CHECK (outcome IN ('counted','removed','duplicate','bot','owner','rate_limited','not_found')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_vote_events_rate_idx ON product_vote_events (network_hash, created_at DESC);

CREATE TABLE visitor_milestone_settings (
  threshold          integer PRIMARY KEY CHECK (threshold > 0),
  enabled            boolean NOT NULL DEFAULT true,
  automatic_sending  boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
INSERT INTO visitor_milestone_settings (threshold) VALUES (100),(250),(500),(1000),(2000)
ON CONFLICT (threshold) DO NOTHING;

CREATE TABLE visitor_milestone_events (
  threshold               integer PRIMARY KEY REFERENCES visitor_milestone_settings(threshold) ON DELETE RESTRICT,
  reached_at              timestamptz NOT NULL DEFAULT now(),
  measured_visitor_total  integer NOT NULL CHECK (measured_visitor_total >= threshold),
  campaign_id             uuid UNIQUE REFERENCES email_campaigns(id) ON DELETE SET NULL,
  campaign_status         text NOT NULL DEFAULT 'draft',
  sent_at                 timestamptz
);
