-- FounderTrail Pro Launch is an additive, per-startup entitlement. Existing products,
-- ownership, community activity, analytics and legacy payment records are untouched.

CREATE TABLE pro_launch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  purchaser_id text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  order_type text NOT NULL DEFAULT 'pro_launch' CHECK (order_type='pro_launch'),
  provider_environment text NOT NULL CHECK (provider_environment IN ('test_mode','live_mode')),
  quoted_price_minor integer NOT NULL CHECK (quoted_price_minor IN (500,900)),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency='USD'),
  intro_slot smallint CHECK (intro_slot BETWEEN 1 AND 20),
  reservation_expires_at timestamptz,
  status text NOT NULL DEFAULT 'held' CHECK (status IN (
    'held','checkout_created','processing','paid','failed','cancelled',
    'payment_conflict','refund_pending','partially_refunded','refunded','disputed'
  )),
  dodo_checkout_session_id text UNIQUE,
  checkout_url text,
  dodo_payment_id text UNIQUE,
  paid_total_minor integer CHECK (paid_total_minor IS NULL OR paid_total_minor >= 0),
  paid_tax_minor integer CHECK (paid_tax_minor IS NULL OR paid_tax_minor >= 0),
  refunded_total_minor integer NOT NULL DEFAULT 0 CHECK (refunded_total_minor >= 0),
  dispute_state text CHECK (dispute_state IS NULL OR dispute_state IN (
    'opened','challenged','won','cancelled','accepted','lost','expired'
  )),
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pro_launch_intro_slot_idx
  ON pro_launch_orders(provider_environment,intro_slot) WHERE intro_slot IS NOT NULL;
CREATE UNIQUE INDEX pro_launch_one_open_order_idx
  ON pro_launch_orders(product_id) WHERE status IN ('held','checkout_created','processing','paid','refund_pending','partially_refunded','disputed');
CREATE INDEX pro_launch_orders_product_idx ON pro_launch_orders(product_id,created_at DESC);
CREATE INDEX pro_launch_orders_payment_idx ON pro_launch_orders(dodo_payment_id) WHERE dodo_payment_id IS NOT NULL;

CREATE TABLE pro_entitlements (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('purchase','admin_grant')),
  source_order_id uuid UNIQUE REFERENCES pro_launch_orders(id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('active','suspended','revoked')),
  activated_at timestamptz NOT NULL,
  suspended_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source='purchase' AND source_order_id IS NOT NULL) OR (source='admin_grant' AND source_order_id IS NULL))
);

CREATE TABLE pro_entitlement_events (
  id bigserial PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES pro_launch_orders(id) ON DELETE SET NULL,
  actor_user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('user','admin','system','provider')),
  action text NOT NULL CHECK (action IN ('activated','granted','suspended','restored','revoked')),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pro_entitlement_events_product_idx ON pro_entitlement_events(product_id,created_at DESC);

CREATE TABLE pro_result_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES products(id) ON DELETE RESTRICT,
  entitlement_order_id uuid REFERENCES pro_launch_orders(id) ON DELETE SET NULL,
  anchor_kind text NOT NULL CHECK (anchor_kind IN ('activation','future_launch')),
  launch_id uuid REFERENCES product_launches(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  coverage_starts_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','complete')),
  snapshot jsonb,
  finalized_at timestamptz,
  last_calculated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at=starts_at+interval '7 days'),
  CHECK ((status='complete')=(snapshot IS NOT NULL AND finalized_at IS NOT NULL))
);
CREATE INDEX pro_result_windows_due_idx ON pro_result_windows(ends_at) WHERE status<>'complete';

CREATE TABLE pro_launch_kit_drafts (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  image_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  social_draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text REFERENCES app_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pro_launch_kit_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  uploaded_by text NOT NULL REFERENCES app_users(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('logo','screenshot')),
  storage_key text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  byte_size integer NOT NULL CHECK (byte_size > 0),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pro_launch_kit_assets_product_idx ON pro_launch_kit_assets(product_id,created_at DESC);

CREATE TABLE product_community_activity_events (
  id bigserial PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  launch_id uuid REFERENCES product_launches(id) ON DELETE CASCADE,
  actor_user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('upvote','follow')),
  change smallint NOT NULL CHECK (change IN (-1,1)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_community_activity_product_idx ON product_community_activity_events(product_id,created_at);

CREATE TABLE pro_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES pro_launch_orders(id) ON DELETE RESTRICT,
  dodo_refund_id text NOT NULL UNIQUE,
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency='USD'),
  status text NOT NULL CHECK (status IN ('pending','succeeded','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pro_refunds_order_idx ON pro_refunds(order_id,created_at);

CREATE TABLE pro_export_events (
  id bigserial PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  template text NOT NULL CHECK (template IN ('spotlight','minimal')),
  format text NOT NULL CHECK (format IN ('landscape','square')),
  outcome text NOT NULL CHECK (outcome IN ('succeeded','failed')),
  error_code text CHECK (error_code IS NULL OR char_length(error_code) <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_jobs DROP CONSTRAINT IF EXISTS notification_jobs_job_type_check;
ALTER TABLE notification_jobs ADD CONSTRAINT notification_jobs_job_type_check CHECK (job_type IN (
  'weekly_digest','claim_invitation','transactional','sponsor_refund','sponsor_reconcile',
  'metric_sync','launch_archive','pro_refund','pro_reconcile','pro_report_ready'
));

-- All Pro reports are prospective. This single row records the earliest timestamp at
-- which the new transition-event instrumentation can truthfully provide daily coverage.
CREATE TABLE pro_reporting_coverage (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  starts_at timestamptz NOT NULL
);
INSERT INTO pro_reporting_coverage(singleton,starts_at) VALUES(true,now()) ON CONFLICT(singleton) DO NOTHING;
