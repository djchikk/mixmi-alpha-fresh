-- Add audio enhancement columns to ip_tracks
-- These columns support the FFmpeg-based audio enhancement feature

-- URL to enhanced audio file in Supabase Storage
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS enhanced_audio_url TEXT;

-- Type of enhancement applied (auto, voice, clean, warm, studio, punchy)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS enhancement_type TEXT;

-- Timestamp when enhancement was applied
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS enhancement_applied_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN ip_tracks.enhanced_audio_url IS 'URL to FFmpeg-enhanced audio version in Supabase Storage';
COMMENT ON COLUMN ip_tracks.enhancement_type IS 'Type of enhancement: auto, voice, clean, warm, studio, punchy';
COMMENT ON COLUMN ip_tracks.enhancement_applied_at IS 'ISO timestamp when audio enhancement was applied';
