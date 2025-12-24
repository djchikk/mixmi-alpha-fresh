-- =================================================================
-- Add Audio Source Tracking to IP Tracks (for Video Clips)
-- =================================================================
-- Enables future modular audio IP tracking for video content
-- Currently all video clips use 'included' (audio inherits video IP)
-- Future options: 'silent' (no audio) or 'separate' (separate audio IP)
-- =================================================================

-- Add audio_source column with constraint
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS audio_source TEXT DEFAULT 'included' CHECK (audio_source IN ('included', 'silent', 'separate'));

-- Add helpful comment
COMMENT ON COLUMN ip_tracks.audio_source IS 'Audio source tracking for video clips: included = audio inherits video IP (default), silent = no audio, separate = separate audio IP (future feature)';

-- Verify column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
AND column_name = 'audio_source';

-- =================================================================
-- Usage Notes:
-- - For 5-second video clips: Always 'included' (audio inherits video IP)
-- - Audio Policy: Must be 100% human-created (no AI-generated music)
-- - Future expansion: When adding longer video support, can use 'separate'
--   to enable modular audio IP with separate creator attribution
-- =================================================================
