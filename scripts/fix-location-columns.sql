-- Migration: Fix location columns to accept decimal coordinates
-- Run this in Supabase SQL Editor

-- First, backup any existing location data (if any)
-- This creates a temporary backup of existing values
CREATE TEMP TABLE location_backup AS 
SELECT id, location_lat, location_lng 
FROM ip_tracks 
WHERE location_lat IS NOT NULL OR location_lng IS NOT NULL;

-- Drop the old integer columns
ALTER TABLE ip_tracks 
DROP COLUMN IF EXISTS location_lat,
DROP COLUMN IF EXISTS location_lng;

-- Add new columns with proper decimal type for coordinates
-- Using DECIMAL(10,7) which allows for:
-- - 3 digits before decimal (up to ±180 for longitude, ±90 for latitude)
-- - 7 digits after decimal (precision to ~1.1 cm)
ALTER TABLE ip_tracks 
ADD COLUMN location_lat DECIMAL(10,7),
ADD COLUMN location_lng DECIMAL(10,7);

-- Restore any backed up data (converting from integer to decimal)
UPDATE ip_tracks t
SET 
  location_lat = b.location_lat::DECIMAL(10,7),
  location_lng = b.location_lng::DECIMAL(10,7)
FROM location_backup b
WHERE t.id = b.id;

-- Add comments to document the columns
COMMENT ON COLUMN ip_tracks.location_lat IS 'Latitude coordinate in decimal degrees (e.g., 51.5074 for London)';
COMMENT ON COLUMN ip_tracks.location_lng IS 'Longitude coordinate in decimal degrees (e.g., -0.1278 for London)';

-- Verify the changes
SELECT 
  column_name, 
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name IN ('location_lat', 'location_lng')
ORDER BY column_name;

-- Test that decimal values work
-- This should succeed now
-- INSERT INTO ip_tracks (location_lat, location_lng) VALUES (51.5074, -0.1278);