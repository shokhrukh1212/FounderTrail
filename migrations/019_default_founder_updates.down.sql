-- Reverses 019. Only rows that are still subscribed get their old timestamp back, so a
-- founder who unsubscribed for real after the repair keeps that newer choice.
UPDATE founder_email_preferences pref
   SET marketing_unsubscribed_at=r.previous_unsubscribed_at,updated_at=now()
  FROM founder_email_preference_repairs r
 WHERE r.preference_id=pref.id AND pref.marketing_unsubscribed_at IS NULL;

DROP TABLE founder_email_preference_repairs;
