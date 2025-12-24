-- Add custom_sticker column to user_profiles table
-- This stores the base64 image data for custom stickers

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS custom_sticker TEXT;

-- Show the updated schema
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('sticker_id', 'sticker_visible', 'custom_sticker')
ORDER BY ordinal_position;