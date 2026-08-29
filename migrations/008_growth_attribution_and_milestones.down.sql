DROP TABLE IF EXISTS visitor_milestone_events;
DROP TABLE IF EXISTS visitor_milestone_settings;
DROP TABLE IF EXISTS product_vote_events;
DROP TABLE IF EXISTS product_share_events;
DROP TABLE IF EXISTS founder_referral_events;
DROP TABLE IF EXISTS product_listing_view_events;
DROP INDEX IF EXISTS visitors_eligible_idx;
ALTER TABLE visitors DROP CONSTRAINT IF EXISTS visitors_network_hash_check, DROP COLUMN IF EXISTS network_hash, DROP COLUMN IF EXISTS eligible;
