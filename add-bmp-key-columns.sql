-- =====================================================
-- Add BPM and Key columns to ip_tracks table
-- =====================================================
-- Created: January 2025
-- Purpose: Add BPM (required for loops) and Key (optional) columns
-- 
-- Safe for production: These columns are nullable and have defaults
-- Existing 59 tracks will not be affected by this change
-- =====================================================

-- Add BPM column (INTEGER, nullable)
-- BPM range typically 60-200 for most music
-- NULL = not specified, 0 = invalid/unknown
ALTER TABLE ip_tracks 
ADD COLUMN bpm INTEGER;

-- Add Key column (TEXT, nullable) 
-- Examples: 'C', 'D#', 'F minor', 'A♭ major', etc.
-- NULL = not specified, empty string = unknown
ALTER TABLE ip_tracks 
ADD COLUMN key TEXT;

-- Add constraints for data integrity
-- BPM should be reasonable music tempo (20-300 BPM)
ALTER TABLE ip_tracks 
ADD CONSTRAINT check_bpm_range 
CHECK (bpm IS NULL OR (bpm >= 20 AND bpm <= 300));

-- Add comments for documentation
COMMENT ON COLUMN ip_tracks.bpm IS 'Beats per minute - required for loops, optional for full songs. Range: 20-300 BPM';
COMMENT ON COLUMN ip_tracks.key IS 'Musical key signature - optional for all track types. Examples: C, D#, F minor, A♭ major';

-- Create index for BPM filtering (useful for DJ/remix features)
CREATE INDEX idx_ip_tracks_bpm ON ip_tracks(bpm) WHERE bpm IS NOT NULL;

-- Create index for Key filtering 
CREATE INDEX idx_ip_tracks_key ON ip_tracks(key) WHERE key IS NOT NULL;

-- =====================================================
-- Verification Queries
-- =====================================================

-- Check table structure after changes
-- SELECT column_name, data_type, is_nullable, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'ip_tracks' 
-- ORDER BY ordinal_position;

-- Count existing tracks (should still be 59)
-- SELECT COUNT(*) as total_tracks FROM ip_tracks;

-- Check new columns are all NULL initially
-- SELECT COUNT(*) as tracks_with_null_bpm FROM ip_tracks WHERE bpm IS NULL;
-- SELECT COUNT(*) as tracks_with_null_key FROM ip_tracks WHERE key IS NULL; 