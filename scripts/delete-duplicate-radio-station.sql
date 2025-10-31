-- Delete duplicate "House Vibes 24/7" radio station
-- Keep only the first one

DELETE FROM ip_tracks
WHERE title = 'House Vibes 24/7'
AND content_type = 'radio_station'
AND id NOT IN (
  SELECT id FROM ip_tracks
  WHERE title = 'House Vibes 24/7'
  AND content_type = 'radio_station'
  ORDER BY created_at ASC
  LIMIT 1
);

-- Verify only one remains
SELECT
  id,
  title,
  content_type,
  stream_url,
  created_at
FROM ip_tracks
WHERE title = 'House Vibes 24/7'
AND content_type = 'radio_station';
