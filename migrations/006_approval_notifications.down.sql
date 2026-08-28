DROP INDEX IF EXISTS products_approval_email_retry_idx;
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_approved_at_check,
  DROP CONSTRAINT IF EXISTS products_approval_email_status_check,
  DROP COLUMN IF EXISTS approval_email_last_failure,
  DROP COLUMN IF EXISTS approval_email_provider_id,
  DROP COLUMN IF EXISTS approval_email_sent_at,
  DROP COLUMN IF EXISTS approval_email_last_attempt_at,
  DROP COLUMN IF EXISTS approval_email_status,
  DROP COLUMN IF EXISTS approved_at;

