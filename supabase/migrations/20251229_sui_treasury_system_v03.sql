-- Migration: SUI Treasury System v03
-- Adds SUI address support for dual-chain payments (STX + SUI)
-- Created: 2025-12-29

-- ============================================================================
-- PART 1: Add SUI Address Fields to ip_tracks
-- ============================================================================

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS composition_split_1_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_2_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_3_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_4_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_5_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_6_sui_address TEXT,
ADD COLUMN IF NOT EXISTS composition_split_7_sui_address TEXT;

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS production_split_1_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_2_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_3_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_4_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_5_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_6_sui_address TEXT,
ADD COLUMN IF NOT EXISTS production_split_7_sui_address TEXT;

-- ============================================================================
-- PART 2: Add Treasury Balance to Accounts
-- ============================================================================

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS treasury_balance_usdc DECIMAL(18,6) DEFAULT 0;

-- ============================================================================
-- PART 3: Enhance Earnings Table
-- ============================================================================

ALTER TABLE earnings
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid';

ALTER TABLE earnings
ADD COLUMN IF NOT EXISTS held_by_account_id UUID REFERENCES accounts(id);

CREATE INDEX IF NOT EXISTS idx_earnings_status ON earnings(status);
CREATE INDEX IF NOT EXISTS idx_earnings_held_by ON earnings(held_by_account_id);

-- ============================================================================
-- PART 4: Enhance TBD Wallets
-- ============================================================================

ALTER TABLE tbd_wallets
ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES ip_tracks(id),
ADD COLUMN IF NOT EXISTS split_type TEXT,
ADD COLUMN IF NOT EXISTS split_percentage INTEGER;

CREATE INDEX IF NOT EXISTS idx_tbd_wallets_track ON tbd_wallets(track_id);

-- ============================================================================
-- PART 5: Enhance Existing Purchases Table
-- ============================================================================
-- Add new columns to existing purchases table

ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS buyer_address TEXT,
ADD COLUMN IF NOT EXISTS buyer_persona_id UUID REFERENCES personas(id),
ADD COLUMN IF NOT EXISTS price_usdc DECIMAL(18,6),
ADD COLUMN IF NOT EXISTS tx_hash TEXT,
ADD COLUMN IF NOT EXISTS network TEXT DEFAULT 'stacks',
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill buyer_address from buyer_wallet if it exists
UPDATE purchases SET buyer_address = buyer_wallet WHERE buyer_address IS NULL AND buyer_wallet IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_buyer_address ON purchases(buyer_address);
CREATE INDEX IF NOT EXISTS idx_purchases_tx_hash ON purchases(tx_hash);
CREATE INDEX IF NOT EXISTS idx_purchases_network ON purchases(network);

-- ============================================================================
-- PART 6: Views (will replace if they exist)
-- ============================================================================

CREATE OR REPLACE VIEW v_earnings_detail AS
SELECT
  e.id,
  e.amount_usdc,
  e.source_type,
  e.status,
  e.created_at,
  e.tx_hash,
  CASE
    WHEN e.persona_id IS NOT NULL THEN 'persona'
    WHEN e.tbd_wallet_id IS NOT NULL THEN 'tbd_wallet'
  END as recipient_type,
  p.username as persona_username,
  p.display_name as persona_display_name,
  t.label as tbd_label,
  t.track_id as tbd_track_id,
  t.claimed_at as tbd_claimed_at,
  tr.id as track_id,
  tr.title as track_title,
  tr.primary_uploader_wallet,
  ha.id as held_by_account_id,
  hp.username as held_by_username
FROM earnings e
LEFT JOIN personas p ON e.persona_id = p.id
LEFT JOIN tbd_wallets t ON e.tbd_wallet_id = t.id
LEFT JOIN ip_tracks tr ON e.source_id = tr.id
LEFT JOIN accounts ha ON e.held_by_account_id = ha.id
LEFT JOIN personas hp ON hp.account_id = ha.id AND hp.is_default = true
ORDER BY e.created_at DESC;

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

-- ============================================================================
-- PART 7: Grants
-- ============================================================================

GRANT SELECT ON v_earnings_detail TO authenticated;
GRANT SELECT ON v_treasury_summary TO authenticated;

-- ============================================================================
-- DONE
-- ============================================================================
