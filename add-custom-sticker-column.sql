-- Add custom_sticker column to user_profiles table
-- This column stores the URL or base64 data for custom stickers

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS custom_sticker TEXT NULL;

-- Add a comment to explain the column
COMMENT ON COLUMN public.user_profiles.custom_sticker IS 'Stores custom sticker image URL when sticker_id is set to "custom"';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name = 'custom_sticker';