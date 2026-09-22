DROP TABLE IF EXISTS migration_reconciliation_runs;

UPDATE email_campaigns
SET template_key = 'custom_announcement'
WHERE template_key = 'claim_invitation';

ALTER TABLE email_campaigns
  DROP CONSTRAINT email_campaigns_template_key_check;

ALTER TABLE email_campaigns
  ADD CONSTRAINT email_campaigns_template_key_check CHECK (template_key IN (
    'product_approved','founding_product','visitor_milestone',
    'verification_reminder','badge_installation_reminder',
    'weekly_founder_results','custom_announcement'
  ));
