-- Add duration column to ip_tracks table
-- This stores the duration of audio tracks in seconds

ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS duration REAL;

-- Add comment for documentation
COMMENT ON COLUMN ip_tracks.duration IS 'Duration of the audio track in seconds';