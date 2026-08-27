CREATE TABLE IF NOT EXISTS product_moderation_events (
  id          bigserial PRIMARY KEY,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_status text NOT NULL,
  to_status   text NOT NULL CHECK (to_status IN ('pending','published','rejected','archived')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_moderation_events_product_idx ON product_moderation_events (product_id, created_at DESC);
