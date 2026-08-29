CREATE TABLE founder_email_preferences (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_email           text NOT NULL UNIQUE CHECK (normalized_email = lower(btrim(normalized_email))),
  marketing_opt_in_at        timestamptz,
  marketing_unsubscribed_at  timestamptz,
  preference_token_version   integer NOT NULL DEFAULT 1 CHECK (preference_token_version > 0),
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  CHECK (marketing_unsubscribed_at IS NULL OR marketing_opt_in_at IS NOT NULL)
);

INSERT INTO founder_email_preferences (normalized_email)
SELECT DISTINCT lower(btrim(contact_email)) FROM products
ON CONFLICT (normalized_email) DO NOTHING;

ALTER TABLE products ADD COLUMN email_preference_id uuid;
UPDATE products p
   SET email_preference_id = pref.id
  FROM founder_email_preferences pref
 WHERE pref.normalized_email = lower(btrim(p.contact_email));
ALTER TABLE products ALTER COLUMN email_preference_id SET NOT NULL;
ALTER TABLE products ADD CONSTRAINT products_email_preference_fk
  FOREIGN KEY (email_preference_id) REFERENCES founder_email_preferences(id) ON DELETE RESTRICT;
CREATE INDEX products_email_preference_idx ON products (email_preference_id, status);

CREATE TABLE founder_email_suppressions (
  normalized_email  text NOT NULL CHECK (normalized_email = lower(btrim(normalized_email))),
  reason            text NOT NULL CHECK (reason IN ('unsubscribe','bounce','complaint','provider','manual')),
  source_id         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (normalized_email, reason)
);

ALTER TABLE products ADD COLUMN founding_position smallint;
WITH founding AS (
  SELECT id, row_number() OVER (
    ORDER BY COALESCE(approved_at, published_at, submitted_at), id
  )::smallint AS position
  FROM products
  WHERE status = 'published' AND NOT is_demo
)
UPDATE products p SET founding_position = founding.position
  FROM founding WHERE founding.id = p.id;
ALTER TABLE products ADD CONSTRAINT products_founding_position_check
  CHECK (founding_position IS NULL OR founding_position > 0);
CREATE UNIQUE INDEX products_founding_position_idx
  ON products (founding_position) WHERE founding_position IS NOT NULL;

ALTER TABLE site_config
  ADD COLUMN founding_banner_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN founding_banner_ends_at timestamptz;

CREATE TABLE email_campaigns (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  internal_name         text NOT NULL CHECK (char_length(internal_name) BETWEEN 1 AND 120),
  template_key          text NOT NULL CHECK (template_key IN (
                          'product_approved','founding_product','visitor_milestone',
                          'verification_reminder','badge_installation_reminder',
                          'weekly_founder_results','custom_announcement')),
  message_class         text NOT NULL CHECK (message_class IN ('transactional','marketing')),
  product_specific      boolean NOT NULL DEFAULT false,
  subject               text NOT NULL CHECK (char_length(subject) BETWEEN 1 AND 200),
  preview_text          text NOT NULL DEFAULT '' CHECK (char_length(preview_text) <= 240),
  heading               text NOT NULL CHECK (char_length(heading) BETWEEN 1 AND 240),
  body                  text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 12000),
  include_product_logo  boolean NOT NULL DEFAULT false,
  primary_button_label  text CHECK (primary_button_label IS NULL OR char_length(primary_button_label) BETWEEN 1 AND 80),
  primary_button_url    text,
  secondary_button_label text CHECK (secondary_button_label IS NULL OR char_length(secondary_button_label) BETWEEN 1 AND 80),
  secondary_button_url  text,
  sender_name           text NOT NULL CHECK (char_length(sender_name) BETWEEN 1 AND 120),
  reply_to              text,
  audience              jsonb NOT NULL DEFAULT '{}'::jsonb,
  campaign_context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN (
                          'draft','scheduled','queued','sending','sent','partial','failed','cancelled')),
  scheduled_at          timestamptz,
  confirmed_at          timestamptz,
  started_at            timestamptz,
  sent_at               timestamptz,
  recipient_count       integer NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
  created_by            text NOT NULL,
  updated_by            text NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_campaigns_history_idx ON email_campaigns (created_at DESC);
CREATE INDEX email_campaigns_due_idx ON email_campaigns (scheduled_at, created_at)
  WHERE status IN ('scheduled','queued','sending','partial');

CREATE TABLE email_campaign_recipients (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  preference_id         uuid NOT NULL REFERENCES founder_email_preferences(id) ON DELETE RESTRICT,
  product_id            uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  recipient_key         text NOT NULL,
  batch_number          integer CHECK (batch_number IS NULL OR batch_number > 0),
  status                text NOT NULL DEFAULT 'queued' CHECK (status IN (
                          'queued','sending','sent','delivered','failed','bounced','complained','suppressed')),
  attempts              integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_email_id     text UNIQUE,
  last_failure          text,
  last_attempt_at       timestamptz,
  sent_at               timestamptz,
  delivered_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, recipient_key)
);
CREATE INDEX email_campaign_recipients_progress_idx
  ON email_campaign_recipients (campaign_id, status, batch_number);

CREATE TABLE email_campaign_batches (
  campaign_id       uuid NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  batch_number      integer NOT NULL CHECK (batch_number > 0),
  idempotency_key   text NOT NULL UNIQUE,
  status            text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed')),
  attempts          integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at   timestamptz NOT NULL DEFAULT now(),
  last_failure      text,
  sent_at           timestamptz,
  PRIMARY KEY (campaign_id, batch_number)
);

CREATE TABLE email_campaign_audit_events (
  id            bigserial PRIMARY KEY,
  campaign_id   uuid REFERENCES email_campaigns(id) ON DELETE CASCADE,
  actor         text NOT NULL,
  action        text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_campaign_audit_idx ON email_campaign_audit_events (campaign_id, created_at DESC);

CREATE TABLE resend_webhook_events (
  event_id       text PRIMARY KEY,
  event_type     text NOT NULL,
  provider_email_id text,
  received_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE founder_email_sequence_state (
  product_id          uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  reminder_due_at     timestamptz NOT NULL,
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','suppressed','skipped')),
  attempts            integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  provider_email_id   text,
  last_failure        text,
  sent_at             timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
INSERT INTO founder_email_sequence_state (product_id, reminder_due_at)
SELECT p.id, now() + interval '36 hours'
  FROM products p
 WHERE p.status = 'published'
   AND NOT EXISTS (SELECT 1 FROM product_integrations i WHERE i.product_id=p.id AND i.product_verified_at IS NOT NULL)
ON CONFLICT (product_id) DO NOTHING;

CREATE TABLE admin_notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                text NOT NULL,
  title               text NOT NULL,
  body                text NOT NULL,
  related_campaign_id uuid REFERENCES email_campaigns(id) ON DELETE SET NULL,
  read_at             timestamptz,
  email_status        text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sending','sent','failed','skipped')),
  email_provider_id   text,
  email_last_failure  text,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_notifications_unread_idx ON admin_notifications (created_at DESC) WHERE read_at IS NULL;
