-- Insert Real Test Radio Station with Working Stream
-- Date: October 30, 2025
-- Purpose: Test actual radio playback
-- Uses: SomaFM Groove Salad (public Creative Commons stream)

INSERT INTO ip_tracks (
  -- Basic Info
  title,
  artist,
  description,
  content_type,

  -- Radio-specific (REAL working stream!)
  stream_url,
  metadata_api_url,

  -- Location (San Francisco - where SomaFM is based)
  location_lat,
  location_lng,
  primary_location,

  -- Attribution (replace with your wallet)
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
  'SomaFM Groove Salad',
  'SomaFM',
  'A nicely chilled plate of ambient/downtempo beats and grooves. Free, commercial-free internet radio from San Francisco.',
  'radio_station',

  -- Radio-specific (REAL stream URL - works!)
  'https://ice1.somafm.com/groovesalad-128-mp3',
  NULL,  -- SomaFM has APIs but let's keep it simple

  -- Location (San Francisco)
  37.7749,
  -122.4194,
  'San Francisco, CA',

  -- Attribution (REPLACE THIS with your actual wallet!)
  'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JCY',
  100,
  'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JCY',
  100,
  'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JCY',

  -- Media (SomaFM logo)
  'https://somafm.com/img3/groovesalad-400.jpg',

  -- Tags
  ARRAY['ambient', 'downtempo', 'chill', 'radio', 'live', 'somafm'],

  -- Metadata
  NOW(),
  NOW()
)
RETURNING id, title, stream_url, location_lat, location_lng;

-- Verify it worked
SELECT
  id,
  title,
  content_type,
  stream_url,
  location_lat,
  location_lng,
  primary_location
FROM ip_tracks
WHERE title = 'SomaFM Groove Salad'
LIMIT 1;
