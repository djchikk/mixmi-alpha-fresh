-- Add video crop columns to ip_tracks table
-- This allows storing crop coordinates for video clips

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS video_crop_x INTEGER,
ADD COLUMN IF NOT EXISTS video_crop_y INTEGER,
ADD COLUMN IF NOT EXISTS video_crop_width INTEGER,
ADD COLUMN IF NOT EXISTS video_crop_height INTEGER,
ADD COLUMN IF NOT EXISTS video_crop_zoom DECIMAL(4,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS video_natural_width INTEGER,
ADD COLUMN IF NOT EXISTS video_natural_height INTEGER;

COMMENT ON COLUMN ip_tracks.video_crop_x IS 'X coordinate of crop area in pixels';
COMMENT ON COLUMN ip_tracks.video_crop_y IS 'Y coordinate of crop area in pixels';
COMMENT ON COLUMN ip_tracks.video_crop_width IS 'Width of crop area in pixels';
COMMENT ON COLUMN ip_tracks.video_crop_height IS 'Height of crop area in pixels';
COMMENT ON COLUMN ip_tracks.video_crop_zoom IS 'Zoom level applied during crop (1.0 = 100%)';
COMMENT ON COLUMN ip_tracks.video_natural_width IS 'Natural width of video in pixels';
COMMENT ON COLUMN ip_tracks.video_natural_height IS 'Natural height of video in pixels';
