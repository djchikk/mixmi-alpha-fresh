-- =================================================================
-- Add 'video_clip' to ip_tracks content_type constraint
-- =================================================================
-- This updates the CHECK constraint to allow video_clip content type
-- Includes ALL existing content types found in the database
-- =================================================================

-- Step 1: Drop the existing constraint
ALTER TABLE ip_tracks
DROP CONSTRAINT IF EXISTS ip_tracks_content_type_check;

-- Step 2: Add updated constraint with ALL content types including video_clip
-- Existing types: loop, full_song, loop_pack, ep, radio_station, station_pack
-- New type: video_clip
ALTER TABLE ip_tracks
ADD CONSTRAINT ip_tracks_content_type_check
CHECK (content_type IN (
  'loop',
  'full_song',
  'loop_pack',
  'ep',
  'radio_station',
  'station_pack',
  'video_clip'
));

-- Step 3: Verify the constraint was updated
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'ip_tracks'::regclass
AND conname = 'ip_tracks_content_type_check';

-- =================================================================
-- SUCCESS MESSAGE
-- =================================================================
-- Constraint now includes all 7 content types:
-- - loop, full_song, loop_pack, ep (original)
-- - radio_station, station_pack (for radio integration)
-- - video_clip (NEW!)
-- =================================================================
