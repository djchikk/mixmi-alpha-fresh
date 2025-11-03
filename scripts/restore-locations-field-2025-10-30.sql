-- Restore locations field from backup
-- Date: October 30, 2025
-- Reason: locations jsonb is needed for multi-location tracks and arcs on globe

-- Add back the locations column
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS locations jsonb;

-- Restore data from backup
UPDATE ip_tracks t
SET locations = b.locations
FROM ip_tracks_backup_2025_10_30 b
WHERE t.id = b.id
  AND b.locations IS NOT NULL;

-- Verify restoration
SELECT
    COUNT(*) as total_tracks,
    COUNT(locations) as has_locations,
    COUNT(location_lat) as has_lat,
    COUNT(location_lng) as has_lng
FROM ip_tracks;

-- Show sample of restored locations
SELECT
    title,
    artist,
    location_lat,
    location_lng,
    locations
FROM ip_tracks
WHERE locations IS NOT NULL
LIMIT 5;
