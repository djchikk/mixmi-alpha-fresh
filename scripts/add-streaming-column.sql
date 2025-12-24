-- Add allow_streaming column to ip_tracks table
-- This enables the streaming checkbox feature for songs and EPs

ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS allow_streaming BOOLEAN DEFAULT true;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ip_tracks' AND column_name = 'allow_streaming';
