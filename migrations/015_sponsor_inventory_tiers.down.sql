-- Reverses 015. Safe only before any multi-slot or non-900 booking exists: restoring the
-- single-slot exclusion and the price=900 check will fail loudly if one does, which is
-- the intended outcome rather than discarding a real sale.

ALTER TABLE sponsor_events DROP CONSTRAINT sponsor_events_placement_check;
ALTER TABLE sponsor_events ADD CONSTRAINT sponsor_events_placement_check
  CHECK (placement IN ('this_week_desktop','this_week_mobile','discover_desktop','discover_mobile'));

DROP INDEX IF EXISTS sponsor_bookings_active_idx;

ALTER TABLE sponsor_bookings DROP CONSTRAINT sponsor_bookings_slot_no_overlap;
ALTER TABLE sponsor_bookings ADD CONSTRAINT sponsor_bookings_no_overlap
  EXCLUDE USING gist (tstzrange(start_at, end_at, '[)') WITH &&)
  WHERE (booking_status IN ('held','scheduled','active','refund_pending'));

ALTER TABLE sponsor_bookings DROP CONSTRAINT sponsor_bookings_payment_status_check;
ALTER TABLE sponsor_bookings
  ADD CONSTRAINT sponsor_bookings_payment_status_check
    CHECK (payment_status IN ('pending','processing','paid','failed','cancelled','refund_pending','refunded','conflict'));

ALTER TABLE sponsor_bookings DROP CONSTRAINT sponsor_bookings_price_minor_check;
ALTER TABLE sponsor_bookings ADD CONSTRAINT sponsor_bookings_price_minor_check CHECK (price_minor = 900);

ALTER TABLE sponsor_bookings DROP CONSTRAINT sponsor_bookings_duration_matches_interval;
ALTER TABLE sponsor_bookings ADD CONSTRAINT sponsor_bookings_check
  CHECK (end_at = start_at + interval '168 hours');

ALTER TABLE sponsor_bookings
  DROP CONSTRAINT sponsor_bookings_slot_index_check,
  DROP CONSTRAINT sponsor_bookings_duration_days_check,
  DROP CONSTRAINT sponsor_bookings_complimentary_reason_check;

ALTER TABLE sponsor_bookings
  DROP COLUMN IF EXISTS slot_index,
  DROP COLUMN IF EXISTS duration_days,
  DROP COLUMN IF EXISTS complimentary_reason;
