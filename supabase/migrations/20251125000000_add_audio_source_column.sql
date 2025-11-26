-- Add audio_source column to ip_tracks table
-- This enables future modular audio IP tracking for video clips

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS audio_source TEXT DEFAULT 'included' CHECK (audio_source IN ('included', 'silent', 'separate'));

COMMENT ON COLUMN ip_tracks.audio_source IS 'Audio source tracking for video clips: included = audio inherits video IP (default), silent = no audio, separate = separate audio IP (future feature)';
