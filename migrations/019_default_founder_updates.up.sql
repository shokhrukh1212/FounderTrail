-- The submission form used to leave "Send me FounderTrail updates" unticked, and an
-- unticked box was stored as a marketing unsubscribe. Founders who never chose to stop
-- receiving updates were therefore excluded from every growth campaign.
--
-- A real unsubscribe (the email link or the owner settings checkbox) always records an
-- 'unsubscribe' suppression alongside the timestamp. Only the submission default stamps
-- the timestamp alone, so those rows are the ones restored here. Bounce, complaint,
-- provider and manual suppressions are untouched and still exclude the address.
CREATE TABLE founder_email_preference_repairs (
  preference_id             uuid PRIMARY KEY REFERENCES founder_email_preferences(id) ON DELETE CASCADE,
  previous_unsubscribed_at  timestamptz NOT NULL,
  repaired_at               timestamptz NOT NULL DEFAULT now()
);

INSERT INTO founder_email_preference_repairs (preference_id,previous_unsubscribed_at)
SELECT pref.id,pref.marketing_unsubscribed_at
  FROM founder_email_preferences pref
 WHERE pref.marketing_unsubscribed_at IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM founder_email_suppressions s
                    WHERE s.normalized_email=pref.normalized_email AND s.reason='unsubscribe');

UPDATE founder_email_preferences pref
   SET marketing_unsubscribed_at=NULL,updated_at=now()
  FROM founder_email_preference_repairs r
 WHERE r.preference_id=pref.id;
