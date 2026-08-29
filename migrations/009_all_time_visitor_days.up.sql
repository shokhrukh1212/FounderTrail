-- All-time visitors counts a person once per day they come back: the same browser
-- visiting today and tomorrow is two all-time visitors. `visitors` stays one row per
-- browser (it backs cookie identity and last-seen), so the per-day rows live here.
CREATE TABLE visitor_days (
  visitor_id  uuid NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  visit_date  date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, visit_date)
);
CREATE INDEX visitor_days_date_idx ON visitor_days (visit_date);

-- Backfill so the counter does not restart at zero. Only the first- and last-seen days
-- survived in `visitors`, so every eligible visitor contributes those one or two days;
-- days between them were never recorded and cannot be reconstructed.
INSERT INTO visitor_days (visitor_id, visit_date, created_at)
SELECT id, (first_seen_at AT TIME ZONE 'UTC')::date, first_seen_at FROM visitors WHERE eligible
ON CONFLICT DO NOTHING;
INSERT INTO visitor_days (visitor_id, visit_date, created_at)
SELECT id, (last_seen_at AT TIME ZONE 'UTC')::date, last_seen_at FROM visitors WHERE eligible
ON CONFLICT DO NOTHING;
