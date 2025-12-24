# Enable Default Sticker Visibility

## What This Does
Makes the blue daisy sticker visible by default for all new user profiles, so users can discover this fun feature immediately!

## Status
- ✅ **Existing profiles updated** - All 19 current profiles now have stickers visible
- ⚠️ **Database defaults need updating** - Run the SQL below to ensure new profiles get stickers

## SQL to Apply

Go to your **Supabase Dashboard → SQL Editor** and run this:

```sql
-- Update the initialize_user_profile function to set sticker defaults
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

  -- Insert profile with sticker visible by default
  INSERT INTO user_profiles (
    wallet_address,
    display_name,
    sticker_id,
    sticker_visible
  )
  VALUES (
    p_wallet_address,
    v_artist_name,
    'daisy-blue',
    true
  )
  ON CONFLICT (wallet_address) DO NOTHING;

  -- Insert default sections
  INSERT INTO user_profile_sections (wallet_address, section_type, title, display_order, is_visible)
  VALUES
    (p_wallet_address, 'spotlight', 'Spotlight', 1, true),
    (p_wallet_address, 'media', 'Media', 2, true),
    (p_wallet_address, 'shop', 'Shop', 3, true),
    (p_wallet_address, 'gallery', 'Gallery', 4, true)
  ON CONFLICT (wallet_address, section_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Also set column defaults as a backup
ALTER TABLE user_profiles
  ALTER COLUMN sticker_id SET DEFAULT 'daisy-blue',
  ALTER COLUMN sticker_visible SET DEFAULT true;
```

## Testing

After applying the SQL, you can test with:

```bash
node scripts/apply-sticker-defaults.js
```

This will create a test profile and verify that sticker defaults are working correctly.

## Scripts Created

1. `scripts/enable-default-sticker.js` - Updates existing profiles (already run ✅)
2. `scripts/apply-sticker-defaults.js` - Tests if defaults are working
3. `scripts/update-profile-init-with-sticker.sql` - SQL migration to apply
4. `scripts/enable-default-sticker.sql` - Alternative SQL approach

## Result

New users will now see the blue daisy sticker 🌼 by default on their profiles! They can:
- Toggle it off if they don't want it
- Change to a different sticker
- Upload a custom sticker

But at least they'll know the feature exists! 🎉
