-- Delete duplicate "House Vibes 24/7" entries
-- Keep only the oldest one based on created_at

-- First, let's see what we have
SELECT id, title, created_at, stream_url
FROM ip_tracks
WHERE title = 'House Vibes 24/7'
ORDER BY created_at ASC;

-- Delete all but the first one (using a CTE)
WITH ranked_tracks AS (
  SELECT
    id,
    title,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY title ORDER BY created_at ASC) as row_num
  FROM ip_tracks
  WHERE title = 'House Vibes 24/7'
)
DELETE FROM ip_tracks
WHERE id IN (
  SELECT id
  FROM ranked_tracks
  WHERE row_num > 1
);

-- Verify only one remains
SELECT id, title, created_at, stream_url
FROM ip_tracks
WHERE title = 'House Vibes 24/7';
