-- Recording Payment System for Universal Mixer
-- Migration: 20260202_add_recording_payment_system.sql
--
-- Implements "sausage link" pricing: $0.10 per 8-bar block per track
-- Splits: 5% platform, 80% Gen 0 creators, 15% remixer stake (stored, not paid)

-- =============================================================================
-- 1. Add columns to ip_tracks for remix/recording tracking
-- =============================================================================

-- Remixer stake (15% reserved for downstream payments)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS remixer_stake_percentage DECIMAL(5,2) DEFAULT 0;

-- Source track genealogy (JSONB for flexibility with Gen N scenarios)
-- Format: [{id, title, bpm, generation, remixer_stake_percentage, ip_ratios: {composition: [...], production: [...]}}]
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS source_tracks_metadata JSONB DEFAULT '[]';

-- Recording session tracking
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS recording_cost_usdc DECIMAL(10,6);

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS recording_payment_tx TEXT;

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS recording_payment_status TEXT DEFAULT 'pending';

-- Bars recorded (for pricing calculation)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS recorded_bars INTEGER DEFAULT 8;

-- Add comments for documentation
COMMENT ON COLUMN ip_tracks.remixer_stake_percentage IS 'Percentage stake the remixer holds for downstream use (15% for Gen 1)';
COMMENT ON COLUMN ip_tracks.source_tracks_metadata IS 'JSONB array of source track info: [{id, title, bpm, generation, remixer_stake_percentage, ip_ratios}]';
COMMENT ON COLUMN ip_tracks.recording_cost_usdc IS 'Total USDC paid for recording this remix';
COMMENT ON COLUMN ip_tracks.recording_payment_tx IS 'SUI transaction hash for recording payment';
COMMENT ON COLUMN ip_tracks.recording_payment_status IS 'Payment status: pending, confirmed, failed';
COMMENT ON COLUMN ip_tracks.recorded_bars IS 'Number of bars in the recording (for sausage link pricing)';

-- =============================================================================
-- 2. Create recording_payments table
-- =============================================================================

CREATE TABLE IF NOT EXISTS recording_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to draft track (created after payment confirmed)
  draft_track_id UUID REFERENCES ip_tracks(id),

  -- Payer info
  payer_persona_id UUID REFERENCES personas(id),
  payer_sui_address TEXT NOT NULL,

  -- Payment breakdown
  total_usdc DECIMAL(10,6) NOT NULL,
  platform_cut_usdc DECIMAL(10,6) NOT NULL,      -- 5%
  gen0_creators_cut_usdc DECIMAL(10,6) NOT NULL, -- 80%
  remixer_stake_usdc DECIMAL(10,6) NOT NULL,     -- 15% (not paid, recorded)

  -- Number of 8-bar chunks paid for
  chunks INTEGER NOT NULL,
  bars_recorded INTEGER NOT NULL,
  tracks_used INTEGER NOT NULL,
  cost_per_chunk DECIMAL(10,6) NOT NULL DEFAULT 0.10,

  -- Source tracks used (for audit trail)
  source_track_ids UUID[] NOT NULL,

  -- Transaction details
  tx_hash TEXT,
  tx_status TEXT DEFAULT 'pending' CHECK (tx_status IN ('pending', 'confirmed', 'failed')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- Indexes for recording_payments
CREATE INDEX IF NOT EXISTS idx_recording_payments_draft ON recording_payments(draft_track_id);
CREATE INDEX IF NOT EXISTS idx_recording_payments_payer ON recording_payments(payer_persona_id);
CREATE INDEX IF NOT EXISTS idx_recording_payments_status ON recording_payments(tx_status);
CREATE INDEX IF NOT EXISTS idx_recording_payments_created ON recording_payments(created_at DESC);

-- =============================================================================
-- 3. Create recording_payment_recipients table
-- =============================================================================

CREATE TABLE IF NOT EXISTS recording_payment_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to payment
  recording_payment_id UUID REFERENCES recording_payments(id) ON DELETE CASCADE,

  -- Recipient info
  recipient_sui_address TEXT NOT NULL,
  recipient_persona_id UUID REFERENCES personas(id),
  recipient_name TEXT,                            -- Display name or wallet snippet

  -- Payment type
  payment_type TEXT NOT NULL CHECK (payment_type IN ('platform', 'composition', 'production')),

  -- Amount and source
  amount_usdc DECIMAL(10,6) NOT NULL,
  source_track_id UUID REFERENCES ip_tracks(id), -- Which track this payment is from
  percentage_of_source DECIMAL(5,2),             -- e.g., 50% of composition

  -- Status
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for recording_payment_recipients
CREATE INDEX IF NOT EXISTS idx_payment_recipients_payment ON recording_payment_recipients(recording_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_recipients_recipient ON recording_payment_recipients(recipient_sui_address);
CREATE INDEX IF NOT EXISTS idx_payment_recipients_source ON recording_payment_recipients(source_track_id);

-- =============================================================================
-- 4. Enable RLS (Row Level Security)
-- =============================================================================

ALTER TABLE recording_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_payment_recipients ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role access for recording_payments" ON recording_payments
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role access for recording_payment_recipients" ON recording_payment_recipients
  FOR ALL USING (auth.role() = 'service_role');

-- Allow users to view their own payments
CREATE POLICY "Users can view own payments" ON recording_payments
  FOR SELECT USING (payer_sui_address = auth.jwt()->>'sub');

CREATE POLICY "Users can view own payment recipients" ON recording_payment_recipients
  FOR SELECT USING (
    recording_payment_id IN (
      SELECT id FROM recording_payments WHERE payer_sui_address = auth.jwt()->>'sub'
    )
  );

-- =============================================================================
-- 5. Create helper function for calculating payment splits
-- =============================================================================

-- Function to calculate sausage link cost
CREATE OR REPLACE FUNCTION calculate_recording_cost(
  bars INTEGER,
  track_count INTEGER,
  price_per_block DECIMAL DEFAULT 0.10
) RETURNS DECIMAL AS $$
BEGIN
  -- ceil(bars / 8) * price_per_block * track_count
  RETURN CEIL(bars::DECIMAL / 8) * price_per_block * track_count;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment
COMMENT ON FUNCTION calculate_recording_cost IS 'Calculates recording cost using sausage link pricing: ceil(bars/8) × $0.10 × tracks';
