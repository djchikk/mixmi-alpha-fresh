-- Add ISRC field back to ip_tracks table
-- ISRC (International Standard Recording Code) is a standard identifier for sound recordings

ALTER TABLE public.ip_tracks
ADD COLUMN IF NOT EXISTS isrc text NULL;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ip_tracks_isrc
ON public.ip_tracks USING btree (isrc)
WHERE isrc IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.ip_tracks.isrc IS 'International Standard Recording Code - unique identifier for sound recordings';

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ip_tracks' AND column_name = 'isrc';
