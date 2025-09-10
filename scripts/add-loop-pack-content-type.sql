-- Add 'loop_pack' as an allowed content_type in ip_tracks table
-- This will allow loop packs to appear as single items on globe/store

-- Drop the existing constraint
ALTER TABLE public.ip_tracks DROP CONSTRAINT IF EXISTS ip_tracks_content_type_check;

-- Add new constraint that includes 'loop_pack'
ALTER TABLE public.ip_tracks ADD CONSTRAINT ip_tracks_content_type_check 
CHECK (content_type = ANY (ARRAY['full_song'::text, 'loop'::text, 'loop_pack'::text]));

-- Verify the constraint (using modern PostgreSQL syntax)
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.ip_tracks'::regclass 
AND conname = 'ip_tracks_content_type_check';

-- Test insert to verify it works
-- (This will be rolled back, just for testing)
BEGIN;
INSERT INTO public.ip_tracks (
    title, artist, content_type, primary_uploader_wallet, uploader_address,
    composition_split_1_wallet, composition_split_1_percentage,
    production_split_1_wallet, production_split_1_percentage
) VALUES (
    'TEST LOOP PACK', 'Test Artist', 'loop_pack', 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
    'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 100,
    'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 100
);
-- This should succeed if the constraint is working
ROLLBACK;

COMMENT ON CONSTRAINT ip_tracks_content_type_check ON public.ip_tracks 
IS 'Allows full_song, loop, and loop_pack content types';