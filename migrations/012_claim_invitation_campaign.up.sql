ALTER TABLE email_campaigns
  DROP CONSTRAINT email_campaigns_template_key_check;

ALTER TABLE email_campaigns
  ADD CONSTRAINT email_campaigns_template_key_check CHECK (template_key IN (
    'product_approved','claim_invitation','founding_product','visitor_milestone',
    'verification_reminder','badge_installation_reminder',
    'weekly_founder_results','custom_announcement'
  ));

CREATE TABLE migration_reconciliation_runs (
  id bigserial PRIMARY KEY,
  database_fingerprint text NOT NULL CHECK (database_fingerprint ~ '^[a-f0-9]{16}$'),
  baseline_captured_at timestamptz NOT NULL,
  result text NOT NULL CHECK (result IN ('passed','failed')),
  baseline_product_count integer NOT NULL CHECK (baseline_product_count >= 0),
  current_product_count integer NOT NULL CHECK (current_product_count >= 0),
  failure_count integer NOT NULL CHECK (failure_count >= 0),
  artifact_hash text NOT NULL CHECK (artifact_hash ~ '^[a-f0-9]{64}$'),
  schema_migrations jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
