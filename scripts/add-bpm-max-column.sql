-- Add bpm_max column for multi-tempo packs and EPs
-- This allows displaying BPM ranges like "103-110" on globe cards

-- Add the column (nullable, since most tracks won't have a range)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS bpm_max INTEGER;

-- Add comment explaining the field
COMMENT ON COLUMN ip_tracks.bpm_max IS 'Maximum BPM for packs/EPs with varying tempos. When present with bpm, display as "bpm-bpm_max". NULL for single-tempo content.';
