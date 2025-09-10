-- Add location fields to ip_tracks table
-- Run this in your Supabase SQL Editor

ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS location_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS primary_location TEXT;

-- Create an index on location fields for better query performance
CREATE INDEX IF NOT EXISTS idx_ip_tracks_location 
ON ip_tracks(location_lat, location_lng) 
WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL;

-- Add comment to explain the fields
COMMENT ON COLUMN ip_tracks.location_lat IS 'Latitude coordinate for track location';
COMMENT ON COLUMN ip_tracks.location_lng IS 'Longitude coordinate for track location';  
COMMENT ON COLUMN ip_tracks.primary_location IS 'Primary location name (e.g., city or country)';