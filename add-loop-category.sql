-- Add loop_category column to ip_tracks table
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS loop_category TEXT;

-- Update existing loop tracks to have a default category
UPDATE ip_tracks 
SET loop_category = 'instrumentals' 
WHERE content_type = 'loop' AND loop_category IS NULL;

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ip_tracks' AND column_name = 'loop_category';
