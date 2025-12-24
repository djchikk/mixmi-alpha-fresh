-- Migration: Separate Remix and Download Pricing
-- Separates remix usage fees (1 STX per loop) from download pricing (custom)
-- This allows cleaner pricing logic and separate transactions

-- ============================================================================
-- PART 1: Add New Pricing Fields
-- ============================================================================

-- Add separate pricing fields
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS remix_price_stx DECIMAL(10,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS download_price_stx DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS allow_downloads BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN ip_tracks.remix_price_stx IS 'Price to use this loop in a remix (default 1 STX per loop). Set to 0 for free remixing.';
COMMENT ON COLUMN ip_tracks.download_price_stx IS 'Price to download the audio file. NULL means downloads not available.';
COMMENT ON COLUMN ip_tracks.allow_downloads IS 'Whether this track can be downloaded (separate from remix rights)';

-- ============================================================================
-- PART 2: Migrate Existing Data
-- ============================================================================

-- For existing loops with platform_remix license: set remix price to existing price_stx
UPDATE ip_tracks
SET
  remix_price_stx = COALESCE(price_stx, 1.0),
  download_price_stx = NULL,
  allow_downloads = false
WHERE content_type = 'loop'
  AND (license_type = 'remix_only' OR allow_remixing = true)
  AND (allow_downloads IS NULL OR allow_downloads = false);

-- For existing loops with platform_download license: set both prices
-- Assume remix = 1 STX and download = (total - 1 STX)
UPDATE ip_tracks
SET
  remix_price_stx = 1.0,
  download_price_stx = GREATEST(COALESCE(price_stx, 2.5) - 1.0, 0.5),
  allow_downloads = true
WHERE content_type = 'loop'
  AND allow_downloads = true;

-- For full songs and EPs: no remix, only download
UPDATE ip_tracks
SET
  remix_price_stx = 0,
  download_price_stx = COALESCE(price_stx, 2.5),
  allow_downloads = true
WHERE content_type IN ('full_song', 'ep');

-- For loop packs: set default remix price (1 STX per loop when used)
-- Note: Loop packs don't have a single remix_price_stx - each individual loop gets 1 STX when used
UPDATE ip_tracks
SET
  remix_price_stx = 1.0,
  download_price_stx = CASE WHEN allow_downloads = true THEN price_stx ELSE NULL END,
  allow_downloads = COALESCE(allow_downloads, false)
WHERE content_type = 'loop_pack';

-- ============================================================================
-- PART 3: Data Integrity Constraints
-- ============================================================================

-- Ensure prices are non-negative
ALTER TABLE ip_tracks
ADD CONSTRAINT check_remix_price CHECK (remix_price_stx >= 0),
ADD CONSTRAINT check_download_price CHECK (download_price_stx IS NULL OR download_price_stx >= 0);

-- Ensure allow_downloads is consistent with download_price_stx
-- (If allow_downloads is false, download_price_stx should be NULL)
ALTER TABLE ip_tracks
ADD CONSTRAINT check_download_consistency
  CHECK (
    (allow_downloads = false AND download_price_stx IS NULL) OR
    (allow_downloads = true)
  );

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- ✅ Added remix_price_stx (default 1 STX for loops, can be 0 for free)
-- ✅ Added download_price_stx (NULL if downloads not available)
-- ✅ Added allow_downloads boolean flag
-- ✅ Migrated existing data from price_stx to new fields
-- ✅ Added data integrity constraints
-- ✅ Preserved backward compatibility (price_stx still exists for display)

-- New pricing model:
-- • Loops: remix_price_stx (1 STX default) + optional download_price_stx
-- • Full Songs/EPs: download_price_stx only (no remix)
-- • Gen 1+ Remixes: remix_price_stx = 1 STX, download_price_stx = NULL (in-platform only)
