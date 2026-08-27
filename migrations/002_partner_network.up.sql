CREATE TABLE IF NOT EXISTS product_integrations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  public_id             uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  allowed_domain        text NOT NULL,
  secret_hash           text NOT NULL CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  secret_version        integer NOT NULL DEFAULT 1 CHECK (secret_version > 0),
  verification_token    text NOT NULL UNIQUE CHECK (verification_token ~ '^bidindex_[a-f0-9]{32}$'),
  domain_status         text NOT NULL DEFAULT 'unverified' CHECK (domain_status IN ('unverified','verified','failed')),
  domain_verified_at    timestamptz,
  last_event_at         timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_integrations_public_idx ON product_integrations (public_id);

CREATE TABLE IF NOT EXISTS product_badge_referral_events (
  id              bigserial PRIMARY KEY,
  integration_id  uuid NOT NULL REFERENCES product_integrations(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  visitor_hash    text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  network_hash    text NOT NULL CHECK (network_hash ~ '^[a-f0-9]{64}$'),
  outcome         text NOT NULL CHECK (outcome IN ('counted','duplicate','bot')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_badge_referral_unique_idx
  ON product_badge_referral_events (integration_id, visitor_hash) WHERE outcome = 'counted';
CREATE INDEX IF NOT EXISTS product_badge_referral_time_idx ON product_badge_referral_events (product_id, created_at DESC);

CREATE TABLE IF NOT EXISTS product_metric_events (
  id                  bigserial PRIMARY KEY,
  integration_id      uuid NOT NULL REFERENCES product_integrations(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_id            text NOT NULL CHECK (char_length(event_id) BETWEEN 8 AND 120),
  event_type          text NOT NULL CHECK (event_type IN ('pageview','purchase_completed','bid_completed','revenue_recorded')),
  value_minor         bigint CHECK (value_minor IS NULL OR value_minor >= 0),
  currency            text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  visitor_hash        text CHECK (visitor_hash IS NULL OR visitor_hash ~ '^[a-f0-9]{64}$'),
  dedupe_bucket       date,
  occurred_at         timestamptz NOT NULL,
  received_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, event_id),
  CHECK ((event_type = 'pageview' AND value_minor IS NULL AND currency IS NULL AND visitor_hash IS NOT NULL AND dedupe_bucket IS NOT NULL)
      OR (event_type <> 'pageview' AND value_minor IS NOT NULL AND currency IS NOT NULL AND visitor_hash IS NULL AND dedupe_bucket IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS product_metric_pageview_dedupe_idx
  ON product_metric_events (integration_id, visitor_hash, dedupe_bucket) WHERE event_type = 'pageview';
CREATE INDEX IF NOT EXISTS product_metric_events_product_time_idx ON product_metric_events (product_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS product_metric_events_integration_time_idx ON product_metric_events (integration_id, received_at DESC);

CREATE TABLE IF NOT EXISTS domain_verification_attempts (
  id              bigserial PRIMARY KEY,
  integration_id  uuid NOT NULL REFERENCES product_integrations(id) ON DELETE CASCADE,
  outcome         text NOT NULL CHECK (outcome IN ('verified','not_found','invalid_response','network_error','rate_limited')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domain_verification_attempts_recent_idx ON domain_verification_attempts (integration_id, created_at DESC);
