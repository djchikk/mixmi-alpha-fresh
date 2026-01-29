-- Add thumbnail columns to personas table
-- Run this in Supabase SQL Editor

ALTER TABLE personas ADD COLUMN IF NOT EXISTS avatar_thumb_48_url TEXT;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS avatar_thumb_96_url TEXT;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'personas'
AND column_name LIKE 'avatar_thumb%';
