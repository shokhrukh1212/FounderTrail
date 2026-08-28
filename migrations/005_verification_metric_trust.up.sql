ALTER TABLE product_integrations
  ALTER COLUMN secret_hash DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS domain_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS domain_check_outcome text,
  ADD COLUMN IF NOT EXISTS verification_method text NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS badge_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS badge_installed_at timestamptz,
  ADD COLUMN IF NOT EXISTS badge_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS badge_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_visitor_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS product_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS secret_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS secret_rotated_at timestamptz;

ALTER TABLE product_integrations
  ADD CONSTRAINT product_integrations_domain_outcome_check
    CHECK (domain_check_outcome IS NULL OR domain_check_outcome IN ('verified','not_found','invalid_response','network_error','rate_limited')),
  ADD CONSTRAINT product_integrations_method_check
    CHECK (verification_method IN ('meta','file')),
  ADD CONSTRAINT product_integrations_badge_status_check
    CHECK (badge_status IN ('not_started','waiting','active','failed','needs_attention'));

UPDATE product_integrations
   SET secret_created_at = COALESCE(secret_created_at, created_at)
 WHERE secret_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_integrations_verification_idx
  ON product_integrations (product_verified_at DESC, product_id)
  WHERE product_verified_at IS NOT NULL;

ALTER TABLE product_metric_aggregates
  DROP CONSTRAINT IF EXISTS product_metric_aggregates_source_check,
  DROP CONSTRAINT IF EXISTS product_metric_aggregates_metric_type_check,
  DROP CONSTRAINT IF EXISTS product_metric_aggregates_value_check;

CREATE TEMP TABLE legacy_bidindex_metric_sources ON COMMIT DROP AS
  SELECT * FROM product_metric_aggregates WHERE source IN ('verified_by_bidindex','verified_live');
DELETE FROM product_metric_aggregates WHERE source IN ('verified_by_bidindex','verified_live');
INSERT INTO product_metric_aggregates
  (product_id,metric_type,source,currency,value,source_url,last_event_at,updated_at)
SELECT product_id,metric_type,mapped_source,currency,max(value),max(source_url),max(last_event_at),max(updated_at)
  FROM (
    SELECT legacy.*,
           CASE WHEN source='verified_by_bidindex' OR metric_type='visitors'
                THEN 'measured_by_bidindex' ELSE 'partner_connected' END AS mapped_source
      FROM legacy_bidindex_metric_sources legacy
  ) mapped
 GROUP BY product_id,metric_type,mapped_source,currency;

ALTER TABLE product_metric_aggregates
  ADD COLUMN IF NOT EXISTS measurement_period text NOT NULL DEFAULT 'all_time',
  ADD COLUMN IF NOT EXISTS last_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_status text NOT NULL DEFAULT 'active',
  ADD CONSTRAINT product_metric_aggregates_source_v2_check
    CHECK (source IN ('measured_by_bidindex','processor_verified','partner_connected','publicly_sourced','founder_reported','verified_by_bidindex','verified_live')),
  ADD CONSTRAINT product_metric_aggregates_type_v2_check
    CHECK (metric_type IN ('visitors','revenue','outbound_clicks','bids','purchases','refunds','current_bid','highest_bid','partner_product_clicks')),
  ADD CONSTRAINT product_metric_aggregates_value_v2_check
    CHECK (metric_type = 'revenue' OR value >= 0),
  ADD CONSTRAINT product_metric_aggregates_period_check
    CHECK (measurement_period IN ('all_time','today','last_30_days')),
  ADD CONSTRAINT product_metric_aggregates_status_check
    CHECK (source_status IN ('active','stale','archived'));

UPDATE product_metric_aggregates
   SET last_received_at = COALESCE(last_received_at, last_event_at, updated_at)
 WHERE last_received_at IS NULL;

ALTER TABLE product_public_evidence
  DROP CONSTRAINT IF EXISTS product_public_evidence_status_check;
ALTER TABLE product_public_evidence
  ADD COLUMN IF NOT EXISTS stale_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD CONSTRAINT product_public_evidence_status_v2_check
    CHECK (status IN ('pending','accepted','rejected','stale','archived'));

CREATE TABLE IF NOT EXISTS product_traffic_daily (
  product_id       uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  metric_date      date NOT NULL,
  pageviews        bigint NOT NULL DEFAULT 0 CHECK (pageviews >= 0),
  daily_uniques    bigint NOT NULL DEFAULT 0 CHECK (daily_uniques >= 0),
  badge_impressions bigint NOT NULL DEFAULT 0 CHECK (badge_impressions >= 0),
  badge_clicks     bigint NOT NULL DEFAULT 0 CHECK (badge_clicks >= 0),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, metric_date)
);
CREATE INDEX IF NOT EXISTS product_traffic_daily_rank_idx
  ON product_traffic_daily (metric_date DESC, daily_uniques DESC, product_id);

CREATE TABLE IF NOT EXISTS product_traffic_event_ids (
  integration_id  uuid NOT NULL REFERENCES product_integrations(id) ON DELETE CASCADE,
  event_id         text NOT NULL CHECK (char_length(event_id) BETWEEN 8 AND 120),
  event_type       text NOT NULL CHECK (event_type IN ('pageview','badge_impression')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (integration_id, event_id)
);
CREATE INDEX IF NOT EXISTS product_traffic_event_expiry_idx
  ON product_traffic_event_ids (created_at);

CREATE TABLE IF NOT EXISTS product_daily_visitors (
  integration_id  uuid NOT NULL REFERENCES product_integrations(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  metric_date     date NOT NULL,
  visitor_hash    text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (integration_id, metric_date, visitor_hash)
);
CREATE INDEX IF NOT EXISTS product_daily_visitors_expiry_idx
  ON product_daily_visitors (metric_date);

CREATE TABLE IF NOT EXISTS product_referrer_daily (
  product_id       uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  metric_date      date NOT NULL,
  referring_domain text NOT NULL CHECK (char_length(referring_domain) BETWEEN 1 AND 253),
  pageviews        bigint NOT NULL DEFAULT 0 CHECK (pageviews >= 0),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, metric_date, referring_domain)
);

ALTER TABLE product_metric_events
  DROP CONSTRAINT IF EXISTS product_metric_events_event_type_check,
  DROP CONSTRAINT IF EXISTS product_metric_events_value_minor_check,
  DROP CONSTRAINT IF EXISTS product_metric_events_check;

ALTER TABLE product_metric_events
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'partner_connected',
  ADD COLUMN IF NOT EXISTS processing_status text NOT NULL DEFAULT 'accepted',
  ADD CONSTRAINT product_metric_events_type_v2_check
    CHECK (event_type IN ('pageview','purchase_completed','bid_completed','revenue_recorded','purchase','refund','revenue','bid','product_click')),
  ADD CONSTRAINT product_metric_events_amount_v2_check
    CHECK (value_minor IS NULL OR value_minor >= 0),
  ADD CONSTRAINT product_metric_events_source_check
    CHECK (source IN ('measured_by_bidindex','partner_connected','processor_verified')),
  ADD CONSTRAINT product_metric_events_processing_check
    CHECK (processing_status IN ('accepted','duplicate','rejected')),
  ADD CONSTRAINT product_metric_events_shape_v2_check
    CHECK (
      (event_type = 'pageview' AND value_minor IS NULL AND currency IS NULL AND visitor_hash IS NOT NULL AND dedupe_bucket IS NOT NULL)
      OR
      (event_type IN ('product_click') AND value_minor IS NULL AND currency IS NULL AND visitor_hash IS NULL AND dedupe_bucket IS NULL)
      OR
      (event_type NOT IN ('pageview','product_click') AND value_minor IS NOT NULL AND currency IS NOT NULL AND visitor_hash IS NULL AND dedupe_bucket IS NULL)
    );

UPDATE product_metric_events SET source='measured_by_bidindex' WHERE event_type='pageview';

CREATE INDEX IF NOT EXISTS product_metric_events_source_time_idx
  ON product_metric_events (product_id, source, occurred_at DESC);
