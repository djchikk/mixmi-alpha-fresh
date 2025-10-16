-- Check the source loops that were used in the remix
-- Find the most recent remix first
WITH latest_remix AS (
  SELECT
    id,
    title,
    parent_track_1_id,
    parent_track_2_id,
    source_track_ids
  FROM ip_tracks
  WHERE generation = 1
  ORDER BY created_at DESC
  LIMIT 1
)
SELECT
  t.id,
  t.title,
  t.artist,

  -- Composition splits
  t.composition_split_1_wallet,
  t.composition_split_1_percentage,
  t.composition_split_2_wallet,
  t.composition_split_2_percentage,
  t.composition_split_3_wallet,
  t.composition_split_3_percentage,

  -- Production splits
  t.production_split_1_wallet,
  t.production_split_1_percentage,
  t.production_split_2_wallet,
  t.production_split_2_percentage,
  t.production_split_3_wallet,
  t.production_split_3_percentage
FROM ip_tracks t
WHERE t.id IN (
  SELECT parent_track_1_id FROM latest_remix
  UNION
  SELECT parent_track_2_id FROM latest_remix
);
