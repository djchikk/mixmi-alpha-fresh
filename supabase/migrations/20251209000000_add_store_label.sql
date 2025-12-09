-- Add store_label column to user_profiles table
-- Allows users to customize the label for their "Store" button/page
-- Options: Store (default), Space, Shelf, Spot, Stall

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS store_label TEXT DEFAULT 'Store';

-- Add a check constraint to ensure only valid options are used
ALTER TABLE user_profiles
ADD CONSTRAINT store_label_options
CHECK (store_label IN ('Store', 'Space', 'Shelf', 'Spot', 'Stall'));

COMMENT ON COLUMN user_profiles.store_label IS 'Customizable label for the user store button/page. Valid options: Store, Space, Shelf, Spot, Stall';
