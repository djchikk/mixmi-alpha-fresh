-- Enable sticker visibility by default for new profiles
-- This ensures new users can see the sticker feature immediately

-- Update the column defaults to ensure sticker is visible by default
ALTER TABLE user_profiles
  ALTER COLUMN sticker_id SET DEFAULT 'daisy-blue',
  ALTER COLUMN sticker_visible SET DEFAULT true;

-- Also update any existing profiles that have sticker_visible set to false
-- to true, so all users can see their sticker
UPDATE user_profiles
SET sticker_visible = true
WHERE sticker_visible = false OR sticker_visible IS NULL;

-- Set sticker_id for any profiles that don't have one yet
UPDATE user_profiles
SET sticker_id = 'daisy-blue'
WHERE sticker_id IS NULL OR sticker_id = '';
