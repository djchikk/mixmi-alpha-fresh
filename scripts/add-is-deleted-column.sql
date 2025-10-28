-- Add is_deleted column to ip_tracks table for soft delete functionality
-- This enables hiding tracks from public view without permanent deletion

-- Add the column (defaults to false for all existing tracks)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false NOT NULL;

-- Add an index for efficient filtering of visible/hidden tracks
CREATE INDEX IF NOT EXISTS idx_ip_tracks_is_deleted
ON ip_tracks(is_deleted);

-- Add a comment explaining the column
COMMENT ON COLUMN ip_tracks.is_deleted IS 'Soft delete flag: true = hidden from store/globe, false = visible';

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
AND column_name = 'is_deleted';
