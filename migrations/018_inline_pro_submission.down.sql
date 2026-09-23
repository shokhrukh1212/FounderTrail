ALTER TABLE pro_launch_orders DROP COLUMN checkout_requested_at;
ALTER TABLE pro_launch_orders DROP COLUMN rejection_refund_required;
ALTER TABLE pro_launch_orders DROP COLUMN purchased_before_approval;
ALTER TABLE pro_launch_orders DROP COLUMN entry_point;
DROP INDEX products_submission_key_idx;
ALTER TABLE products DROP COLUMN submission_pro_selected;
ALTER TABLE products DROP COLUMN submission_key;
