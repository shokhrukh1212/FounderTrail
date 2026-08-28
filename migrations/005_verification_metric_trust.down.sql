DROP TABLE IF EXISTS product_referrer_daily;
DROP TABLE IF EXISTS product_daily_visitors;
DROP TABLE IF EXISTS product_traffic_event_ids;
DROP TABLE IF EXISTS product_traffic_daily;

ALTER TABLE product_integrations
  DROP COLUMN IF EXISTS domain_last_checked_at,
  DROP COLUMN IF EXISTS domain_check_outcome,
  DROP COLUMN IF EXISTS verification_method,
  DROP COLUMN IF EXISTS badge_status,
  DROP COLUMN IF EXISTS badge_installed_at,
  DROP COLUMN IF EXISTS badge_last_checked_at,
  DROP COLUMN IF EXISTS badge_last_seen_at,
  DROP COLUMN IF EXISTS last_visitor_event_at,
  DROP COLUMN IF EXISTS product_verified_at,
  DROP COLUMN IF EXISTS secret_created_at,
  DROP COLUMN IF EXISTS secret_rotated_at;

ALTER TABLE product_public_evidence
  DROP COLUMN IF EXISTS stale_at,
  DROP COLUMN IF EXISTS archived_at;

ALTER TABLE product_metric_aggregates
  DROP COLUMN IF EXISTS measurement_period,
  DROP COLUMN IF EXISTS last_received_at,
  DROP COLUMN IF EXISTS source_status;

ALTER TABLE product_metric_events
  DROP COLUMN IF EXISTS source,
  DROP COLUMN IF EXISTS processing_status;
