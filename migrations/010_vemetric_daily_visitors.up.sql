-- Vemetric is the source of truth for site traffic, but its query API only buckets by
-- day for short ranges: `interval:auto` groups a 3-month range by week and a 1-year
-- range by month, which would silently undercount an all-time sum. So each day is
-- captured while it is still inside a daily-granularity window and frozen here.
-- All-time visitors is the sum of these rows: one person on two days counts twice.
CREATE TABLE vemetric_daily_visitors (
  metric_date date PRIMARY KEY,
  users       integer NOT NULL CHECK (users >= 0),
  pageviews   integer NOT NULL DEFAULT 0 CHECK (pageviews >= 0),
  synced_at   timestamptz NOT NULL DEFAULT now()
);
