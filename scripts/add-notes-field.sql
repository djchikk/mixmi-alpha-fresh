-- Migration: Add notes field to ip_tracks table
-- Run this in Supabase SQL Editor

-- Add notes column for extended track information
ALTER TABLE ip_tracks 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment to document the field
COMMENT ON COLUMN ip_tracks.notes IS 'Extended notes including credits, lyrics, story, collaborators, inspirations - helps with discovery';

-- Verify the change
SELECT 
  column_name, 
  data_type,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
  AND column_name = 'notes';