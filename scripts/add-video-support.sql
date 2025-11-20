-- =================================================================
-- VIDEO INTEGRATION: Add video_clip support to ip_tracks table
-- =================================================================
-- This migration adds video URL storage and updates content_type enum
-- to support 5-second video clips with optional audio
-- =================================================================

-- Step 1: Add video_url column to ip_tracks table
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN ip_tracks.video_url IS 'URL to MP4 video file in Supabase Storage (for video_clip content type, 5-second max)';

-- Step 2: Update content_type enum to include 'video_clip'
-- Note: In PostgreSQL, we need to add the new value to the existing enum type
-- First, check if the enum value already exists to make this idempotent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'video_clip'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'content_type_enum')
    ) THEN
        -- Add 'video_clip' to the content_type enum
        ALTER TYPE content_type_enum ADD VALUE 'video_clip';
    END IF;
END
$$;

-- Step 3: Create index on video_url for faster queries
CREATE INDEX IF NOT EXISTS idx_ip_tracks_video_url ON ip_tracks(video_url)
WHERE video_url IS NOT NULL;

-- Step 4: Create index on content_type to optimize video clip queries
CREATE INDEX IF NOT EXISTS idx_ip_tracks_content_type_video ON ip_tracks(content_type)
WHERE content_type = 'video_clip';

-- =================================================================
-- VERIFICATION QUERIES
-- =================================================================

-- Verify video_url column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'ip_tracks' AND column_name = 'video_url';

-- Verify content_type enum includes video_clip
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'content_type_enum')
ORDER BY enumsortorder;

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'ip_tracks'
AND (indexname LIKE '%video%' OR indexname LIKE '%content_type%');

-- =================================================================
-- STORAGE BUCKET SETUP (Run separately in Supabase Storage UI or via API)
-- =================================================================
-- Bucket name: video-clips
-- Public access: Yes (for video playback)
-- Allowed MIME types: video/mp4
-- Max file size: 10MB
-- File path format: {uuid}.mp4
--
-- RLS Policy needed:
-- - INSERT: Authenticated users only
-- - SELECT: Public (anyone can view videos)
-- - UPDATE: Owner only
-- - DELETE: Owner only
-- =================================================================
