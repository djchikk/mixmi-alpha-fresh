-- Add globe_location column to day_pass_plays for analytics
-- Tracks which globe location (index) the track was played from

ALTER TABLE day_pass_plays
ADD COLUMN IF NOT EXISTS globe_location INTEGER;

COMMENT ON COLUMN day_pass_plays.globe_location IS 'Globe location index where track was placed (for geographic analytics)';
