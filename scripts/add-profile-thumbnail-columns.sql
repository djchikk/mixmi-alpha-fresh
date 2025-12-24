-- Add thumbnail columns to user_profiles table
-- Profile thumbnails are used for small displays in Header, Creator Store, and Dashboard

-- Add thumbnail URL columns
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_thumb_48_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_thumb_96_url TEXT;

-- Comment on columns
COMMENT ON COLUMN user_profiles.avatar_thumb_48_url IS 'Pre-generated 48px thumbnail for header displays';
COMMENT ON COLUMN user_profiles.avatar_thumb_96_url IS 'Pre-generated 96px thumbnail for store/dashboard displays';

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name LIKE 'avatar_thumb%';
