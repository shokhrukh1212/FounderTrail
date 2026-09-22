CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE app_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','admin')),
  digest_opted_in boolean NOT NULL DEFAULT false,
  digest_unsubscribed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_sessions (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);

CREATE TABLE auth_accounts (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, account_id)
);
CREATE INDEX auth_accounts_user_idx ON auth_accounts(user_id);

CREATE TABLE auth_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_verifications_identifier_idx ON auth_verifications(identifier);

CREATE TABLE product_owners (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  ownership_role text NOT NULL DEFAULT 'owner' CHECK (ownership_role IN ('owner','manager')),
  verified_at timestamptz NOT NULL,
  verification_method text NOT NULL CHECK (verification_method IN ('domain_meta','domain_file','dns','verified_email','manual_admin','new_submission','legacy_owner_token')),
  approved_by text REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(product_id, user_id)
);
CREATE UNIQUE INDEX product_one_owner_idx ON product_owners(product_id) WHERE ownership_role='owner';
CREATE INDEX product_owners_user_idx ON product_owners(user_id, created_at DESC);

CREATE TABLE product_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  requester_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','claimed','rejected','disputed','cancelled')),
  evidence_method text NOT NULL CHECK (evidence_method IN ('domain_meta','domain_file','dns','verified_email','manual_admin','legacy_owner_token')),
  challenge_token_hash text CHECK (challenge_token_hash IS NULL OR challenge_token_hash ~ '^[a-f0-9]{64}$'),
  challenge_expires_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by text REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  reviewer_reason text CHECK (reviewer_reason IS NULL OR char_length(reviewer_reason) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_claim_pending_idx ON product_claims(product_id) WHERE state='pending';
CREATE INDEX product_claim_requester_idx ON product_claims(requester_id, created_at DESC);

ALTER TABLE products
  ADD COLUMN created_by_user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  ADD COLUMN use_case text CHECK (use_case IS NULL OR char_length(use_case) <= 500),
  ADD COLUMN intended_audience text CHECK (intended_audience IS NULL OR char_length(intended_audience) <= 500),
  ADD COLUMN pricing_model text CHECK (pricing_model IS NULL OR pricing_model IN ('free','freemium','paid','open_source','contact','unknown')),
  ADD COLUMN starting_price_minor bigint CHECK (starting_price_minor IS NULL OR starting_price_minor >= 0),
  ADD COLUMN pricing_currency text CHECK (pricing_currency IS NULL OR pricing_currency ~ '^[A-Z]{3}$');

INSERT INTO categories(slug,name) VALUES
  ('ai-tools','AI tools'),('analytics','Analytics'),('developer-tools','Developer tools'),
  ('design','Design'),('finance','Finance'),('marketing','Marketing'),
  ('productivity','Productivity'),('sales','Sales'),('other-startup','Other')
ON CONFLICT DO NOTHING;

CREATE TABLE launch_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  starts_at timestamptz NOT NULL UNIQUE,
  ends_at timestamptz NOT NULL UNIQUE,
  state text NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled','active','completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at),
  CHECK (ends_at = starts_at + interval '7 days'),
  CHECK (extract(isodow FROM starts_at AT TIME ZONE 'UTC') = 1),
  CHECK ((starts_at AT TIME ZONE 'UTC')::time = time '00:00')
);

CREATE TABLE product_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  launch_week_id uuid NOT NULL REFERENCES launch_weeks(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled','active','completed','cancelled')),
  approved_at timestamptz NOT NULL,
  final_rank integer CHECK (final_rank IS NULL OR final_rank > 0),
  final_vote_count integer CHECK (final_vote_count IS NULL OR final_vote_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id),
  UNIQUE(product_id, launch_week_id)
);
CREATE INDEX product_launch_week_idx ON product_launches(launch_week_id, approved_at, product_id);

CREATE TABLE launch_votes (
  launch_id uuid NOT NULL REFERENCES product_launches(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(launch_id, user_id)
);

CREATE TABLE product_follows (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(product_id, user_id)
);
CREATE INDEX product_follows_user_idx ON product_follows(user_id, created_at DESC);

CREATE TABLE product_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES product_comments(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  edited_at timestamptz,
  hidden_at timestamptz,
  hidden_by text REFERENCES app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX product_comments_product_idx ON product_comments(product_id, created_at);

CREATE TABLE content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  comment_id uuid REFERENCES product_comments(id) ON DELETE RESTRICT,
  update_id uuid REFERENCES product_updates(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','resolved','dismissed')),
  reviewed_by text REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((comment_id IS NOT NULL)::int + (update_id IS NOT NULL)::int = 1)
);
CREATE INDEX content_reports_state_idx ON content_reports(state, created_at);
CREATE UNIQUE INDEX content_reports_comment_reporter_idx ON content_reports(reporter_id,comment_id) WHERE comment_id IS NOT NULL AND state='open';
CREATE UNIQUE INDEX content_reports_update_reporter_idx ON content_reports(reporter_id,update_id) WHERE update_id IS NOT NULL AND state='open';

ALTER TABLE product_updates DROP CONSTRAINT IF EXISTS product_updates_type_check;
ALTER TABLE product_updates ADD CONSTRAINT product_updates_type_check CHECK (type IN ('feature','improvement','milestone','launch','announcement'));
ALTER TABLE product_updates ALTER COLUMN published_at DROP NOT NULL;
ALTER TABLE product_updates
  ADD COLUMN status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN archived_at timestamptz;

CREATE TABLE notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('weekly_digest','claim_invitation','transactional','sponsor_refund','sponsor_reconcile','metric_sync','launch_archive')),
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','processing','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_jobs_due_idx ON notification_jobs(available_at, created_at) WHERE state IN ('pending','failed');

CREATE TABLE metric_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider='stripe'),
  provider_account_id text,
  scope_mode text NOT NULL DEFAULT 'selected_products' CHECK (scope_mode IN ('selected_products','account_wide')),
  provider_product_ids text[] NOT NULL DEFAULT '{}',
  encrypted_secret bytea NOT NULL,
  encryption_iv bytea NOT NULL,
  encryption_tag bytea NOT NULL,
  publish_revenue boolean NOT NULL DEFAULT false,
  publish_mrr boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','stale','error','disconnected')),
  last_synced_at timestamptz,
  last_error text,
  disconnected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, provider)
);

CREATE TABLE metric_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES metric_connections(id) ON DELETE CASCADE,
  metric_type text NOT NULL CHECK (metric_type IN ('revenue_30d','mrr')),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  value_minor bigint NOT NULL CHECK (value_minor >= 0),
  period_start timestamptz,
  period_end timestamptz NOT NULL,
  methodology_version text NOT NULL DEFAULT 'stripe-v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connection_id, metric_type, currency, period_end)
);
CREATE INDEX metric_snapshots_latest_idx ON metric_snapshots(connection_id, metric_type, currency, period_end DESC);

CREATE TABLE metric_connection_scopes (
  connection_id uuid NOT NULL REFERENCES metric_connections(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider='stripe'),
  provider_account_id text NOT NULL,
  provider_product_id text NOT NULL,
  PRIMARY KEY(connection_id, provider_product_id),
  UNIQUE(provider, provider_account_id, provider_product_id)
);

CREATE OR REPLACE FUNCTION foundertrail_guard_metric_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.provider_product_id='*' AND EXISTS(
    SELECT 1 FROM metric_connection_scopes s WHERE s.provider=NEW.provider AND s.provider_account_id=NEW.provider_account_id
  ) THEN RAISE EXCEPTION 'provider account is already scoped to another product' USING ERRCODE='23505'; END IF;
  IF NEW.provider_product_id<>'*' AND EXISTS(
    SELECT 1 FROM metric_connection_scopes s WHERE s.provider=NEW.provider AND s.provider_account_id=NEW.provider_account_id AND s.provider_product_id='*'
  ) THEN RAISE EXCEPTION 'provider account is already used account-wide' USING ERRCODE='23505'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER metric_scope_guard BEFORE INSERT OR UPDATE ON metric_connection_scopes
  FOR EACH ROW EXECUTE FUNCTION foundertrail_guard_metric_scope();

CREATE TABLE sponsor_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  purchaser_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  hold_expires_at timestamptz,
  booking_status text NOT NULL DEFAULT 'held' CHECK (booking_status IN ('held','scheduled','active','completed','expired_hold','cancelled','refund_pending','refunded','payment_conflict','failed')),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','processing','paid','failed','cancelled','refund_pending','refunded','conflict')),
  price_minor integer NOT NULL CHECK (price_minor=900),
  currency text NOT NULL CHECK (currency='USD'),
  creative_name text NOT NULL,
  creative_tagline text NOT NULL,
  destination_url text NOT NULL,
  dodo_checkout_session_id text UNIQUE,
  dodo_payment_id text UNIQUE,
  dodo_refund_id text UNIQUE,
  provider_environment text NOT NULL CHECK (provider_environment IN ('test_mode','live_mode')),
  paid_total_minor integer CHECK (paid_total_minor IS NULL OR paid_total_minor >= 0),
  paid_tax_minor integer CHECK (paid_tax_minor IS NULL OR paid_tax_minor >= 0),
  paid_at timestamptz,
  refund_requested_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at = start_at + interval '168 hours')
);
ALTER TABLE sponsor_bookings ADD CONSTRAINT sponsor_bookings_no_overlap
  EXCLUDE USING gist (tstzrange(start_at,end_at,'[)') WITH &&)
  WHERE (booking_status IN ('held','scheduled','active','refund_pending'));
CREATE INDEX sponsor_bookings_product_idx ON sponsor_bookings(product_id, created_at DESC);

CREATE TABLE payment_webhook_receipts (
  webhook_id text PRIMARY KEY,
  provider text NOT NULL CHECK (provider='dodo'),
  environment text NOT NULL CHECK (environment IN ('test_mode','live_mode')),
  event_type text NOT NULL,
  provider_created_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  processing_status text NOT NULL DEFAULT 'received' CHECK (processing_status IN ('received','processed','ignored','failed')),
  attempts integer NOT NULL DEFAULT 0,
  processed_at timestamptz,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_webhook_pending_idx ON payment_webhook_receipts(received_at) WHERE processing_status IN ('received','failed');

CREATE TABLE sponsor_events (
  id bigserial PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES sponsor_bookings(id) ON DELETE CASCADE,
  page_view_id uuid NOT NULL,
  visitor_hash text NOT NULL CHECK (visitor_hash ~ '^[a-f0-9]{64}$'),
  event_type text NOT NULL CHECK (event_type IN ('impression','outbound_click')),
  placement text NOT NULL CHECK (placement IN ('this_week_desktop','this_week_mobile','discover_desktop','discover_mobile')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id, page_view_id, event_type)
);
CREATE INDEX sponsor_events_booking_idx ON sponsor_events(booking_id, created_at DESC);

CREATE TABLE foundertrail_audit_events (
  id bigserial PRIMARY KEY,
  actor_user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('user','admin','system','provider')),
  action text NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  claim_id uuid REFERENCES product_claims(id) ON DELETE SET NULL,
  booking_id uuid REFERENCES sponsor_bookings(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX foundertrail_audit_product_idx ON foundertrail_audit_events(product_id, created_at DESC);
