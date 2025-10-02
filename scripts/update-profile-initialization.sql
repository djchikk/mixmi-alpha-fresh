-- Update the initialize_user_profile function to use artist name from ip_tracks
-- This creates a better first-time user experience

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
    (p_wallet_address, 'media', 'Media', 2, true),
    (p_wallet_address, 'shop', 'Shop', 3, true),
    (p_wallet_address, 'gallery', 'Gallery', 4, true)
  ON CONFLICT (wallet_address, section_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;
