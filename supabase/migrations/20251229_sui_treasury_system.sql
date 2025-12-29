-- Migration: SUI Treasury System
-- Adds SUI address support for dual-chain payments (STX + SUI)
-- Enhances earnings tracking for the hybrid payment model
-- Created: 2025-12-29
--
-- NOTE: The existing _wallet columns store either:
--   - STX wallet address (SP1234...)
--   - Pending collaborator name (pending:Kwame)
-- We're adding _sui_address columns for SUI payments while keeping STX support.

-- ============================================================================
-- PART 1: Add SUI Address Fields to ip_tracks
-- ============================================================================
-- Each split can now have both STX (_wallet) and SUI (_sui_address) addresses
-- Payment logic will check: SUI address first, then look up from wallet, then pending:name

-- Composition split SUI addresses (1-7)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS composition_split_1_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_2_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_3_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_4_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_5_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_6_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_7_sui_address TEXT;

-- Production split SUI addresses (1-7)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS production_split_1_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_2_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_3_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_4_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_5_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_6_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_7_sui_address TEXT;

COMMENT ON COLUMN ip_tracks.composition_split_1_sui_address IS 'SUI address for this collaborator (used for SUI/USDC payments)';

-- ============================================================================
-- PART 2: Add Treasury Balance to Accounts
-- ============================================================================
-- Track how much USDC is held in the user's SUI address for unnamed collaborators

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS treasury_balance_usdc DECIMAL(18,6) DEFAULT 0;

COMMENT ON COLUMN accounts.treasury_balance_usdc IS 'USDC held for unnamed collaborators (subset of total SUI wallet balance)';

-- ============================================================================
-- PART 3: Enhance Earnings Table
-- ============================================================================
-- Add status field to track whether payment went directly or to treasury

ALTER TABLE earnings
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid'
  CHECK (status IN ('paid', 'held_in_treasury', 'claimed', 'withdrawn'));

ALTER TABLE earnings
ADD COLUMN IF NOT EXISTS held_by_account_id UUID REFERENCES accounts(id);

COMMENT ON COLUMN earnings.status IS 'Payment status: paid (on-chain to recipient), held_in_treasury (in uploader wallet), claimed (transferred from treasury), withdrawn (cashed out)';
COMMENT ON COLUMN earnings.held_by_account_id IS 'If status is held_in_treasury, which account holds the funds';

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_earnings_status ON earnings(status);
CREATE INDEX IF NOT EXISTS idx_earnings_held_by ON earnings(held_by_account_id);

-- ============================================================================
-- PART 4: Enhance TBD Wallets for Track-Specific Attribution
-- ============================================================================
-- Link TBD wallets to specific tracks and split types

ALTER TABLE tbd_wallets
ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES ip_tracks(id),
ADD COLUMN IF NOT EXISTS split_type TEXT CHECK (split_type IN ('composition', 'production')),
ADD COLUMN IF NOT EXISTS split_percentage INTEGER CHECK (split_percentage >= 0 AND split_percentage <= 100);

COMMENT ON COLUMN tbd_wallets.track_id IS 'If set, this TBD wallet is for earnings from a specific track';
COMMENT ON COLUMN tbd_wallets.split_type IS 'Whether this is composition or production split';
COMMENT ON COLUMN tbd_wallets.split_percentage IS 'The percentage allocated to this collaborator';

CREATE INDEX IF NOT EXISTS idx_tbd_wallets_track ON tbd_wallets(track_id);

-- ============================================================================
-- PART 5: Purchases Table for Cart Transactions
-- ============================================================================
-- Track all purchases with SUI transaction details

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Buyer info
  buyer_address TEXT NOT NULL,
  buyer_persona_id UUID REFERENCES personas(id),

  -- What was bought
  track_id UUID NOT NULL REFERENCES ip_tracks(id),

  -- Pricing
  price_usdc DECIMAL(18,6) NOT NULL,

  -- Transaction details
  tx_hash TEXT,
  network TEXT DEFAULT 'sui' CHECK (network IN ('sui', 'stacks')),

  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON purchases(buyer_address);
CREATE INDEX IF NOT EXISTS idx_purchases_track ON purchases(track_id);
CREATE INDEX IF NOT EXISTS idx_purchases_tx ON purchases(tx_hash);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);

COMMENT ON TABLE purchases IS 'Records all track purchases including cart checkouts';

-- ============================================================================
-- PART 6: View for Earnings Dashboard
-- ============================================================================
-- Convenient view for the Earnings tab UI

CREATE OR REPLACE VIEW v_earnings_detail AS
SELECT
  e.id,
  e.amount_usdc,
  e.source_type,
  e.status,
  e.created_at,
  e.tx_hash,

  -- Recipient info
  CASE
    WHEN e.persona_id IS NOT NULL THEN 'persona'
    WHEN e.tbd_wallet_id IS NOT NULL THEN 'tbd_wallet'
  END as recipient_type,

  -- Persona details (if applicable)
  p.username as persona_username,
  p.display_name as persona_display_name,

  -- TBD wallet details (if applicable)
  t.label as tbd_label,
  t.track_id as tbd_track_id,
  t.claimed_at as tbd_claimed_at,

  -- Track details
  tr.id as track_id,
  tr.title as track_title,
  tr.primary_uploader_wallet,

  -- Held by (if in treasury)
  ha.id as held_by_account_id,
  hp.username as held_by_username

FROM earnings e
LEFT JOIN personas p ON e.persona_id = p.id
LEFT JOIN tbd_wallets t ON e.tbd_wallet_id = t.id
LEFT JOIN ip_tracks tr ON e.source_id = tr.id
LEFT JOIN accounts ha ON e.held_by_account_id = ha.id
LEFT JOIN personas hp ON hp.account_id = ha.id AND hp.is_default = true

ORDER BY e.created_at DESC;

COMMENT ON VIEW v_earnings_detail IS 'Detailed earnings view for the dashboard Earnings tab';

-- ============================================================================
-- PART 7: View for Account Treasury Summary
-- ============================================================================
-- Shows total held for unnamed collaborators per account

CREATE OR REPLACE VIEW v_treasury_summary AS
SELECT
  a.id as account_id,
  a.sui_address,
  a.treasury_balance_usdc,
  COUNT(DISTINCT t.id) FILTER (WHERE t.claimed_at IS NULL) as pending_collaborators,
  COALESCE(SUM(t.balance_usdc) FILTER (WHERE t.claimed_at IS NULL), 0) as total_pending_usdc
FROM accounts a
LEFT JOIN tbd_wallets t ON t.owner_account_id = a.id
GROUP BY a.id, a.sui_address, a.treasury_balance_usdc;

COMMENT ON VIEW v_treasury_summary IS 'Summary of funds held in treasury for unnamed collaborators';

-- ============================================================================
-- PART 8: Grants
-- ============================================================================

GRANT SELECT ON v_earnings_detail TO authenticated;
GRANT SELECT ON v_treasury_summary TO authenticated;
GRANT SELECT ON purchases TO authenticated;
GRANT ALL ON purchases TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✅ Added SUI address columns to ip_tracks (composition_split_*_sui_address, production_split_*_sui_address)
-- ✅ Added treasury_balance_usdc to accounts
-- ✅ Enhanced earnings table with status and held_by_account_id
-- ✅ Enhanced tbd_wallets with track_id, split_type, split_percentage
-- ✅ Created purchases table for transaction history
-- ✅ Created v_earnings_detail view for Earnings tab
-- ✅ Created v_treasury_summary view for treasury overview
--
-- Payment logic is handled in application code (lib/sui/payment-splitter.ts)
-- which checks: SUI address → STX wallet lookup → pending:name → treasury
