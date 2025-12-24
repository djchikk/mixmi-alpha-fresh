-- Add 'ep' to the content_type check constraint for ip_tracks table
-- This allows EP uploads to succeed in the database

-- Drop the existing constraint
ALTER TABLE ip_tracks DROP CONSTRAINT IF EXISTS ip_tracks_content_type_check;

-- Add the new constraint that includes 'ep'
ALTER TABLE ip_tracks ADD CONSTRAINT ip_tracks_content_type_check 
CHECK (content_type IN ('full_song', 'loop', 'loop_pack', 'ep'));

-- Verify the constraint was added
SELECT conname, contype, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'ip_tracks'::regclass 
AND conname = 'ip_tracks_content_type_check';