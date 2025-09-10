-- Add remix depth tracking columns to ip_tracks table
-- This allows tracking the generation of remixes (0 = original, 1+ = remix generation)

-- Add remix_depth column (NULL for full songs, 0+ for loops/remixes)
ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS remix_depth INTEGER;

-- Add source_track_ids to track parent tracks
ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS source_track_ids TEXT[] DEFAULT '{}';

-- Update existing tracks:
-- Set remix_depth = 0 for loops (original seeds)
-- Set remix_depth = NULL for full songs (cannot be remixed)
UPDATE ip_tracks 
SET remix_depth = CASE 
    WHEN content_type = 'loop' THEN 0
    WHEN content_type = 'full_song' THEN NULL
    ELSE 0
END
WHERE remix_depth IS NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_ip_tracks_remix_depth ON ip_tracks(remix_depth);
CREATE INDEX IF NOT EXISTS idx_ip_tracks_source_track_ids ON ip_tracks USING GIN(source_track_ids);

-- Add comment for documentation
COMMENT ON COLUMN ip_tracks.remix_depth IS 'Generation depth of remix: 0=original loop, 1+=remix generation, NULL=full song';
COMMENT ON COLUMN ip_tracks.source_track_ids IS 'Array of track IDs this remix was created from';