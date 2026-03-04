-- Backfill pack/EP total prices (price_usdc) from per-item price × child count
-- Run this in Supabase SQL Editor
--
-- Background: Legacy packs only had price_stx set to the per-item value.
-- The Feb 20, 2026 USDC cleanup standardized on price_usdc = total pack price
-- and download_price_usdc = per-item price. This backfill fixes existing packs.

-- Step 1: DRY RUN — See what will be updated
SELECT
  p.id,
  p.title,
  p.content_type,
  p.download_price_usdc,
  p.download_price_stx,
  p.price_usdc AS current_price_usdc,
  p.price_stx AS current_price_stx,
  COUNT(c.id) AS child_count,
  COALESCE(p.download_price_usdc, p.download_price_stx, 1.0) * COUNT(c.id) AS correct_total
FROM ip_tracks p
LEFT JOIN ip_tracks c ON c.pack_id = p.id AND c.pack_position > 0
WHERE p.content_type IN ('loop_pack', 'ep')
  AND p.pack_position = 0
  AND p.deleted_at IS NULL
GROUP BY p.id, p.title, p.content_type, p.download_price_usdc, p.download_price_stx, p.price_usdc, p.price_stx
ORDER BY p.created_at DESC;

-- Step 2: BACKFILL — Update price_usdc and price_stx to correct totals
-- Also ensure download_price_usdc is populated from download_price_stx if missing
UPDATE ip_tracks p
SET
  -- Per-item price: copy from _stx if _usdc is null
  download_price_usdc = COALESCE(p.download_price_usdc, p.download_price_stx),
  -- Total price: per-item × child count
  price_usdc = COALESCE(p.download_price_usdc, p.download_price_stx, 1.0) * child_counts.cnt,
  price_stx = COALESCE(p.download_price_usdc, p.download_price_stx, 1.0) * child_counts.cnt,
  updated_at = NOW()
FROM (
  SELECT pack.id, COUNT(child.id) AS cnt
  FROM ip_tracks pack
  LEFT JOIN ip_tracks child ON child.pack_id = pack.id AND child.pack_position > 0
  WHERE pack.content_type IN ('loop_pack', 'ep')
    AND pack.pack_position = 0
    AND pack.deleted_at IS NULL
  GROUP BY pack.id
) AS child_counts
WHERE p.id = child_counts.id
  AND child_counts.cnt > 0;

-- Step 3: Also backfill download_price_usdc on child tracks that only have _stx
UPDATE ip_tracks
SET download_price_usdc = download_price_stx
WHERE download_price_usdc IS NULL
  AND download_price_stx IS NOT NULL
  AND deleted_at IS NULL;

-- Step 4: Backfill price_usdc on standalone tracks that only have price_stx
UPDATE ip_tracks
SET price_usdc = price_stx
WHERE price_usdc IS NULL
  AND price_stx IS NOT NULL
  AND deleted_at IS NULL;

-- Step 5: VERIFY — Run Step 1 again to confirm totals are correct
