-- Check Radio Station Data
-- Verify stream_url and other fields

SELECT
  id,
  title,
  content_type,
  stream_url,
  audio_url,
  cover_image_url,
  location_lat,
  location_lng
FROM ip_tracks
WHERE content_type = 'radio_station'
ORDER BY created_at DESC
LIMIT 5;
