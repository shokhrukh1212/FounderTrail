ALTER TABLE products
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_email_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS approval_email_last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_email_provider_id text,
  ADD COLUMN IF NOT EXISTS approval_email_last_failure text;

UPDATE products
   SET approved_at = published_at,
       approval_email_status = 'skipped'
 WHERE status = 'published'
   AND approved_at IS NULL;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_approval_email_status_check,
  ADD CONSTRAINT products_approval_email_status_check
    CHECK (approval_email_status IN ('not_sent','sending','sent','failed','skipped')),
  DROP CONSTRAINT IF EXISTS products_approved_at_check,
  ADD CONSTRAINT products_approved_at_check
    CHECK (status <> 'published' OR approved_at IS NOT NULL);

CREATE INDEX IF NOT EXISTS products_approval_email_retry_idx
  ON products (approval_email_status, approval_email_last_attempt_at)
  WHERE status = 'published' AND approval_email_status IN ('not_sent','sending','failed');

