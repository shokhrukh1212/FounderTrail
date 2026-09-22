-- Sponsorship moves from one fixed slot to three concurrent slots and two durations.
--
-- Before: exactly one booking could overlap any instant, priced at USD 9.00 for exactly
-- 168 hours. After: three slots (0-2), each still non-overlapping with itself, and a
-- duration carried on the row so 7-day and 30-day placements can coexist.
--
-- Additive and backfilled. No historical booking, payment identifier, refund or event is
-- deleted or rewritten; the old rows simply land in slot 0 with their real duration.

ALTER TABLE sponsor_bookings
  ADD COLUMN IF NOT EXISTS slot_index smallint,
  ADD COLUMN IF NOT EXISTS duration_days smallint,
  ADD COLUMN IF NOT EXISTS complimentary_reason text;

-- Every pre-existing booking was the single global slot, and its real length is already
-- recorded in start_at/end_at, so derive rather than assume.
UPDATE sponsor_bookings SET slot_index = 0 WHERE slot_index IS NULL;
UPDATE sponsor_bookings
   SET duration_days = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (end_at - start_at)) / 86400)::int)
 WHERE duration_days IS NULL;

ALTER TABLE sponsor_bookings
  ALTER COLUMN slot_index SET NOT NULL,
  ALTER COLUMN duration_days SET NOT NULL;

ALTER TABLE sponsor_bookings
  ADD CONSTRAINT sponsor_bookings_slot_index_check CHECK (slot_index BETWEEN 0 AND 2),
  ADD CONSTRAINT sponsor_bookings_duration_days_check CHECK (duration_days > 0 AND duration_days <= 365),
  ADD CONSTRAINT sponsor_bookings_complimentary_reason_check
    CHECK (complimentary_reason IS NULL OR char_length(complimentary_reason) <= 500);

-- The duration must agree with the interval actually sold. This is the integrity rule;
-- which durations are purchasable (7 and 30) is a product decision enforced in
-- lib/config.ts and the webhook, so an audited complimentary campaign of another length
-- stays possible.
ALTER TABLE sponsor_bookings DROP CONSTRAINT sponsor_bookings_check;
ALTER TABLE sponsor_bookings
  ADD CONSTRAINT sponsor_bookings_duration_matches_interval
    CHECK (end_at = start_at + make_interval(days => duration_days));

-- USD 9.00 is no longer the only price. Historical 900-minor rows stay valid, and 0 is
-- allowed so a complimentary campaign does not have to fake a payment.
ALTER TABLE sponsor_bookings DROP CONSTRAINT sponsor_bookings_price_minor_check;
ALTER TABLE sponsor_bookings
  ADD CONSTRAINT sponsor_bookings_price_minor_check CHECK (price_minor >= 0);

ALTER TABLE sponsor_bookings DROP CONSTRAINT sponsor_bookings_payment_status_check;
ALTER TABLE sponsor_bookings
  ADD CONSTRAINT sponsor_bookings_payment_status_check
    CHECK (payment_status IN ('pending','processing','paid','failed','cancelled','refund_pending','refunded','conflict','complimentary'));

-- Capacity is the database's job: three slots, each free of self-overlap, which makes a
-- fourth concurrent campaign impossible rather than merely discouraged. btree_gist (added
-- in 011) is what allows the equality operator on slot_index inside a GiST exclusion.
ALTER TABLE sponsor_bookings DROP CONSTRAINT sponsor_bookings_no_overlap;
ALTER TABLE sponsor_bookings ADD CONSTRAINT sponsor_bookings_slot_no_overlap
  EXCLUDE USING gist (slot_index WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
  WHERE (booking_status IN ('held','scheduled','active','refund_pending'));

CREATE INDEX IF NOT EXISTS sponsor_bookings_active_idx
  ON sponsor_bookings (start_at, end_at)
  WHERE payment_status IN ('paid','complimentary') AND booking_status IN ('scheduled','active');

-- New placements: the homepage Featured sponsors block, the rows interleaved into
-- Discover, and the single card on a startup page. The four original values are kept so
-- historical events stay readable.
ALTER TABLE sponsor_events DROP CONSTRAINT sponsor_events_placement_check;
ALTER TABLE sponsor_events ADD CONSTRAINT sponsor_events_placement_check
  CHECK (placement IN (
    'this_week_desktop','this_week_mobile','discover_desktop','discover_mobile',
    'home_featured','discover_inline','product_detail'
  ));
