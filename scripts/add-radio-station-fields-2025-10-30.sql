-- Add Radio Station Fields to ip_tracks
-- Date: October 30, 2025
-- Purpose: Enable radio station content type with streaming URLs
-- Branch: feature/radio-stations-integration

-- =====================================================
-- STEP 1: Add new columns for radio stations
-- =====================================================

-- Stream URL - Direct audio stream endpoint
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS stream_url TEXT;

-- Metadata API URL - For fetching "Now Playing" info
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS metadata_api_url TEXT;

-- =====================================================
-- STEP 2: Update content_type constraint to include radio types
-- =====================================================

-- First, check current constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ip_tracks'::regclass
  AND conname LIKE '%content_type%';

-- Drop existing content_type check constraint (if it exists)
ALTER TABLE ip_tracks
DROP CONSTRAINT IF EXISTS ip_tracks_content_type_check;

-- Add new constraint including radio_station and station_pack
ALTER TABLE ip_tracks
ADD CONSTRAINT ip_tracks_content_type_check
CHECK (
  content_type IN (
    'full_song',
    'loop',
    'loop_pack',
    'ep',
    'mix',
    'radio_station',
    'station_pack'
  )
);

-- =====================================================
-- STEP 3: Verification
-- =====================================================

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name IN ('stream_url', 'metadata_api_url')
ORDER BY column_name;
-- Expected: Both columns present, type = text, nullable = YES

-- Verify constraint updated
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'ip_tracks'::regclass
  AND conname = 'ip_tracks_content_type_check';
-- Expected: Shows radio_station and station_pack in list

-- =====================================================
-- NOTES
-- =====================================================

-- ✅ stream_url: Direct stream endpoint (e.g., https://stream.example.com/house)
-- ✅ metadata_api_url: Optional API for now playing info
-- ✅ content_type now supports: radio_station, station_pack
--
-- Radio Station Example:
--   content_type: 'radio_station'
--   stream_url: 'https://stream.example.com/house'
--   metadata_api_url: 'https://api.example.com/nowplaying'
--
-- Station Pack Example:
--   content_type: 'station_pack'
--   total_loops: 5  (reused as total_stations)
--   Individual stations linked via pack_id
-- =====================================================
