-- Additive submission replay protection and the explicit, optional Pro choice.
ALTER TABLE products ADD COLUMN submission_key uuid;
ALTER TABLE products ADD COLUMN submission_pro_selected boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX products_submission_key_idx ON products(created_by_user_id,submission_key) WHERE submission_key IS NOT NULL;
ALTER TABLE pro_launch_orders ADD COLUMN entry_point text NOT NULL DEFAULT 'dashboard' CHECK(entry_point IN ('dashboard','submission'));
ALTER TABLE pro_launch_orders ADD COLUMN purchased_before_approval boolean NOT NULL DEFAULT false;
ALTER TABLE pro_launch_orders ADD COLUMN rejection_refund_required boolean NOT NULL DEFAULT false;
ALTER TABLE pro_launch_orders ADD COLUMN checkout_requested_at timestamptz;
