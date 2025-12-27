-- USDC Pricing Migration
-- Run this in Supabase SQL Editor
-- Created: 2024-12-26
--
-- Adds USDC pricing columns to ip_tracks
-- STX columns kept for backwards compatibility but USDC becomes primary
--
-- Pricing Model:
-- - Recording fee (mixer use): $0.10 USDC (platform takes $0.01)
-- - Download: Loop $2.00, Song $1.00, Video $2.00 (customizable)
-- - Contact fee: $1.00 USDC fixed (100% to creator)
-- - Streaming (future): Day pass $1.00, per stream ~$0.08

-- ============================================
-- 1. ADD USDC PRICE COLUMNS TO IP_TRACKS
-- ============================================

-- Recording fee when content is used in mixer (default $0.10)
-- Equivalent to remix_price_stx
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS remix_price_usdc DECIMAL(10, 2);

-- Download price for offline use (default varies: $2 loop, $1 song, $2 video)
-- Equivalent to download_price_stx
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS download_price_usdc DECIMAL(10, 2);

-- Contact fee - FIXED at $1.00 USDC (same for collab or commercial)
-- 100% goes to creator - no platform cut
-- Only charged when open_to_collaboration OR open_to_commercial is true
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS contact_fee_usdc DECIMAL(10, 2) DEFAULT 1.00;

-- Streaming price per play (future feature)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS stream_price_usdc DECIMAL(10, 4) DEFAULT 0.08;

-- Day pass price for streaming (future feature)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS day_pass_usdc DECIMAL(10, 2) DEFAULT 1.00;

-- ============================================
-- 2. ADD CURRENCY PREFERENCE COLUMN
-- ============================================

-- Track which currency is the "source of truth" for this track
-- New tracks will default to 'usdc', existing tracks stay on 'stx'
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT 'usdc'
  CHECK (price_currency IN ('usdc', 'stx'));

-- ============================================
-- 3. PLATFORM FEE CONFIGURATION
-- ============================================

-- Platform fee percentage for recording fees (stored as decimal, e.g., 0.10 = 10%)
-- Default: platform takes $0.01 from $0.10 recording fee = 10%
-- Note: Contact fees have NO platform cut - 100% to creator
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS platform_fee_pct DECIMAL(5, 4) DEFAULT 0.10;

-- ============================================
-- 4. INDEXES FOR PRICE QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ip_tracks_remix_price_usdc ON ip_tracks(remix_price_usdc)
  WHERE remix_price_usdc IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ip_tracks_download_price_usdc ON ip_tracks(download_price_usdc)
  WHERE download_price_usdc IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ip_tracks_price_currency ON ip_tracks(price_currency);

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN ip_tracks.remix_price_usdc IS 'Recording fee when used in mixer - $0.10 default';
COMMENT ON COLUMN ip_tracks.download_price_usdc IS 'Download price for offline use - $2 loop, $1 song, $2 video default';
COMMENT ON COLUMN ip_tracks.contact_fee_usdc IS 'Fixed contact fee for collab/commercial inquiries - $1.00, 100% to creator';
COMMENT ON COLUMN ip_tracks.stream_price_usdc IS 'Per-stream price (future) - ~$0.08 default';
COMMENT ON COLUMN ip_tracks.day_pass_usdc IS 'Day pass streaming price (future) - $1.00 default';
COMMENT ON COLUMN ip_tracks.price_currency IS 'Primary currency for this track (usdc or stx)';
COMMENT ON COLUMN ip_tracks.platform_fee_pct IS 'Platform fee percentage on recording fees (0.10 = 10%). Contact fees are 100% to creator.';

-- ============================================
-- 6. SET DEFAULTS FOR NEW TRACKS
-- ============================================

-- Function to set default USDC prices based on content type
CREATE OR REPLACE FUNCTION set_default_usdc_prices()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set defaults for new tracks using USDC
  IF NEW.price_currency = 'usdc' THEN
    -- Recording fee defaults to $0.10 for mixer-compatible content
    IF NEW.remix_price_usdc IS NULL AND NEW.content_type IN ('loop', 'full_song', 'video_clip') THEN
      NEW.remix_price_usdc := 0.10;
    END IF;

    -- Download price defaults based on content type
    IF NEW.download_price_usdc IS NULL AND NEW.allow_downloads = true THEN
      CASE NEW.content_type
        WHEN 'loop' THEN NEW.download_price_usdc := 2.00;
        WHEN 'full_song' THEN NEW.download_price_usdc := 1.00;
        WHEN 'video_clip' THEN NEW.download_price_usdc := 2.00;
        ELSE NEW.download_price_usdc := 1.00;
      END CASE;
    END IF;

    -- Contact fee is always $1.00 when contact is enabled
    IF (NEW.open_to_collaboration = true OR NEW.open_to_commercial = true) THEN
      NEW.contact_fee_usdc := 1.00;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger for new tracks
DROP TRIGGER IF EXISTS set_usdc_defaults ON ip_tracks;
CREATE TRIGGER set_usdc_defaults
  BEFORE INSERT ON ip_tracks
  FOR EACH ROW
  EXECUTE FUNCTION set_default_usdc_prices();

-- ============================================
-- 7. VIEW FOR EASY PRICE QUERIES
-- ============================================

-- Drop existing view first (column names changed)
DROP VIEW IF EXISTS track_prices;

CREATE VIEW track_prices AS
SELECT
  id,
  title,
  artist,
  content_type,
  allow_downloads,
  open_to_collaboration,
  open_to_commercial,
  -- USDC prices (primary going forward)
  remix_price_usdc,
  download_price_usdc,
  contact_fee_usdc,
  stream_price_usdc,
  day_pass_usdc,
  -- Legacy STX prices
  remix_price_stx,
  download_price_stx,
  -- Currency preference
  price_currency,
  platform_fee_pct,
  -- Computed: creator's recording fee after platform cut
  CASE
    WHEN price_currency = 'usdc' THEN remix_price_usdc * (1 - COALESCE(platform_fee_pct, 0.10))
    ELSE remix_price_stx * (1 - COALESCE(platform_fee_pct, 0.10))
  END AS creator_recording_fee,
  -- Computed: is contact enabled
  (open_to_collaboration = true OR open_to_commercial = true) AS contact_enabled,
  -- Computed: is this content available in mixer
  (content_type IN ('loop', 'full_song', 'video_clip', 'loop_pack', 'ep')) AS mixer_compatible
FROM ip_tracks
WHERE is_deleted IS NOT TRUE AND deleted_at IS NULL;

-- ============================================
-- 8. HELPER FUNCTION: Calculate pack price
-- ============================================

-- Calculate total price for a pack (loop_pack or ep)
CREATE OR REPLACE FUNCTION calculate_pack_price(
  p_pack_id UUID,
  p_price_type TEXT DEFAULT 'download' -- 'download' or 'remix'
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  v_pack ip_tracks%ROWTYPE;
  v_child_count INTEGER;
  v_total DECIMAL(10, 2);
BEGIN
  SELECT * INTO v_pack FROM ip_tracks WHERE id = p_pack_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Count children
  SELECT COUNT(*) INTO v_child_count
  FROM ip_tracks
  WHERE parent_id = p_pack_id AND is_deleted IS NOT TRUE;

  IF v_child_count = 0 THEN
    v_child_count := 1;
  END IF;

  -- Calculate based on price type and currency
  IF v_pack.price_currency = 'usdc' THEN
    IF p_price_type = 'download' THEN
      -- Download: per-item price * count
      v_total := COALESCE(v_pack.download_price_usdc,
        CASE v_pack.content_type
          WHEN 'loop_pack' THEN 2.00
          WHEN 'ep' THEN 1.00
          ELSE 1.00
        END) * v_child_count;
    ELSE
      -- Remix/Recording: $0.10 * count
      v_total := 0.10 * v_child_count;
    END IF;
  ELSE
    -- STX pricing (legacy)
    IF p_price_type = 'download' THEN
      v_total := COALESCE(v_pack.download_price_stx, 1) * v_child_count;
    ELSE
      v_total := COALESCE(v_pack.remix_price_stx, 1) * v_child_count;
    END IF;
  END IF;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. PLATFORM CONSTANTS (Reference)
-- ============================================
-- These are documented here but enforced in application code:
--
-- RECORDING_FEE_USDC = 0.10      -- Per loop/section used in mixer
-- PLATFORM_CUT_PCT = 0.10        -- Platform takes 10% of recording fees
-- CONTACT_FEE_USDC = 1.00        -- Fixed fee for contact (100% to creator)
-- STREAM_FEE_USDC = 0.08         -- Per stream (future)
-- DAY_PASS_USDC = 1.00           -- Day pass for streaming (future)
--
-- Download defaults (customizable by creator):
-- LOOP_DOWNLOAD_USDC = 2.00
-- SONG_DOWNLOAD_USDC = 1.00
-- VIDEO_DOWNLOAD_USDC = 2.00

