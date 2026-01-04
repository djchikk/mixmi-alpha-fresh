-- Add "My People" section to all existing user profiles
-- Run this in Supabase SQL Editor

-- 1. Add mypeople section to all existing profiles that don't have it
INSERT INTO user_profile_sections (wallet_address, section_type, title, display_order, is_visible, config)
SELECT
  wallet_address,
  'mypeople',
  'My People',
  2,  -- After spotlight (1), before media (3)
  true,  -- Visible by default (empty sections don't show content anyway)
  '[]'::jsonb
FROM user_profiles
WHERE wallet_address NOT IN (
  SELECT wallet_address FROM user_profile_sections WHERE section_type = 'mypeople'
)
ON CONFLICT (wallet_address, section_type) DO NOTHING;

-- 2. Update the initialize_user_profile function to include mypeople for new users
CREATE OR REPLACE FUNCTION initialize_user_profile(p_wallet_address TEXT)
RETURNS void AS $$
DECLARE
  v_artist_name TEXT;
BEGIN
  -- Try to get the artist name from the user's first track
  SELECT artist INTO v_artist_name
  FROM ip_tracks
  WHERE primary_uploader_wallet = p_wallet_address
  ORDER BY created_at ASC
  LIMIT 1;

  -- If no artist name found, use 'New User' as fallback
  IF v_artist_name IS NULL OR v_artist_name = '' THEN
    v_artist_name := 'New User';
  END IF;

  -- Insert profile if it doesn't exist, using the artist name as display_name
  INSERT INTO user_profiles (wallet_address, display_name)
  VALUES (p_wallet_address, v_artist_name)
  ON CONFLICT (wallet_address) DO NOTHING;

  -- Insert default sections if they don't exist
  INSERT INTO user_profile_sections (wallet_address, section_type, title, display_order, is_visible)
  VALUES
    (p_wallet_address, 'spotlight', 'Spotlight', 1, true),
    (p_wallet_address, 'mypeople', 'My People', 2, true),
    (p_wallet_address, 'media', 'Media', 3, true),
    (p_wallet_address, 'shop', 'Shop', 4, true),
    (p_wallet_address, 'gallery', 'Gallery', 5, true)
  ON CONFLICT (wallet_address, section_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 3. Verify the changes
SELECT section_type, COUNT(*) as count
FROM user_profile_sections
GROUP BY section_type
ORDER BY section_type;
