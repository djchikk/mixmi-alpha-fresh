-- Migration: Add thumbnail URL columns to ip_tracks table
-- Run this in Supabase SQL Editor before deploying the thumbnail feature

-- Add thumbnail URL columns for pre-generated sizes
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS thumb_64_url TEXT,
ADD COLUMN IF NOT EXISTS thumb_160_url TEXT,
ADD COLUMN IF NOT EXISTS thumb_256_url TEXT;

-- Add comment explaining the columns
COMMENT ON COLUMN ip_tracks.thumb_64_url IS 'Pre-generated 64px thumbnail URL (tiny mixer)';
COMMENT ON COLUMN ip_tracks.thumb_160_url IS 'Pre-generated 160px thumbnail URL (cards)';
COMMENT ON COLUMN ip_tracks.thumb_256_url IS 'Pre-generated 256px thumbnail URL (big mixer decks)';

-- Optional: Create index for faster lookups when we have many records
-- CREATE INDEX IF NOT EXISTS idx_ip_tracks_thumb_urls ON ip_tracks (thumb_64_url, thumb_160_url, thumb_256_url) WHERE thumb_64_url IS NOT NULL;

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name LIKE 'thumb%'
ORDER BY column_name;
