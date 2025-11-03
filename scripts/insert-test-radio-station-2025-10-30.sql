-- Insert Test Radio Station
-- Date: October 30, 2025
-- Purpose: Test radio station for Phase 1 development
-- Branch: feature/radio-stations-integration

-- =====================================================
-- STEP 1: Insert a test radio station
-- =====================================================

-- Note: Replace 'YOUR_WALLET_ADDRESS' with an actual wallet from alpha_users
-- Or use a test wallet address

INSERT INTO ip_tracks (
  -- Basic Info
  title,
  artist,
  description,
  content_type,

  -- Radio-specific
  stream_url,
  metadata_api_url,

  -- Location (NYC coordinates)
  location_lat,
  location_lng,
  primary_location,

  -- Attribution (simplified for radio)
  composition_split_1_wallet,
  composition_split_1_percentage,
  production_split_1_wallet,
  production_split_1_percentage,
  primary_uploader_wallet,

  -- Media
  cover_image_url,

  -- Tags
  tags,

  -- Metadata
  created_at,
  updated_at
)
VALUES (
  -- Basic Info
  'House Vibes 24/7',
  'NYC Electronic Music',
  'Non-stop house music from NYC. Deep house, progressive house, tech house - 24 hours a day.',
  'radio_station',

  -- Radio-specific (placeholder URLs for now)
  'https://example.com/stream/house',  -- Replace with real stream URL
  'https://example.com/api/nowplaying',  -- Optional: real API endpoint

  -- Location (NYC: Times Square)
  40.7580,
  -73.9855,
  'New York City, NY',

  -- Attribution (use your wallet or test wallet)
  'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JCY',  -- Replace with real wallet
  100,
  'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JCY',  -- Same wallet for production
  100,
  'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JCY',  -- Primary uploader

  -- Media (placeholder - can add real cover image URL)
  'https://via.placeholder.com/400x400/FB923C/FFFFFF?text=House+Vibes',

  -- Tags
  ARRAY['house', 'electronic', 'nyc', 'radio', 'live'],

  -- Metadata
  NOW(),
  NOW()
)
RETURNING id, title, artist, content_type, stream_url;

-- =====================================================
-- STEP 2: Verify insertion
-- =====================================================

SELECT
  id,
  title,
  artist,
  content_type,
  stream_url,
  location_lat,
  location_lng,
  primary_location,
  created_at
FROM ip_tracks
WHERE content_type = 'radio_station'
ORDER BY created_at DESC
LIMIT 5;

-- =====================================================
-- NOTES
-- =====================================================

-- ✅ Test station created with:
--    - Orange theme (will be styled in UI)
--    - NYC location (appears on globe)
--    - Placeholder stream URL (replace with real URL later)
--    - Basic attribution (curator gets credit)
--
-- To update with real stream URL later:
-- UPDATE ip_tracks
-- SET stream_url = 'https://real-stream-url.com/stream'
-- WHERE id = 'your-station-id';
--
-- =====================================================
