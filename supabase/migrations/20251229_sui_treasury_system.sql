-- Migration: SUI Treasury System
-- Adds support for collaborator names without wallet addresses
-- Enhances earnings tracking for the hybrid payment model
-- Created: 2025-12-29

-- ============================================================================
-- PART 1: Add Collaborator Name Fields to ip_tracks
-- ============================================================================
-- Allow users to enter just names for collaborators without accounts
-- The wallet field can be null while name holds the attribution

-- Composition split names (1-7)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS composition_split_1_name TEXT,
ADD COLUMN IF NOT EXISTS composition_split_2_name TEXT,
ADD COLUMN IF NOT EXISTS composition_split_3_name TEXT,
ADD COLUMN IF NOT EXISTS composition_split_4_name TEXT,
ADD COLUMN IF NOT EXISTS composition_split_5_name TEXT,
ADD COLUMN IF NOT EXISTS composition_split_6_name TEXT,
ADD COLUMN IF NOT EXISTS composition_split_7_name TEXT;

-- Production split names (1-7)
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS production_split_1_name TEXT,
ADD COLUMN IF NOT EXISTS production_split_2_name TEXT,
ADD COLUMN IF NOT EXISTS production_split_3_name TEXT,
ADD COLUMN IF NOT EXISTS production_split_4_name TEXT,
ADD COLUMN IF NOT EXISTS production_split_5_name TEXT,
ADD COLUMN IF NOT EXISTS production_split_6_name TEXT,
ADD COLUMN IF NOT EXISTS production_split_7_name TEXT;

COMMENT ON COLUMN ip_tracks.composition_split_1_name IS 'Display name for collaborator (used when no wallet address available)';

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
  a.treasury_balance_usdc,
  COUNT(DISTINCT t.id) as pending_collaborators,
  COALESCE(SUM(t.balance_usdc), 0) as total_pending_usdc,
  json_agg(json_build_object(
    'id', t.id,
    'label', t.label,
    'balance', t.balance_usdc,
    'track_title', tr.title
  )) FILTER (WHERE t.id IS NOT NULL AND t.claimed_at IS NULL) as pending_collaborator_details
FROM accounts a
LEFT JOIN tbd_wallets t ON t.owner_account_id = a.id AND t.claimed_at IS NULL
LEFT JOIN ip_tracks tr ON t.track_id = tr.id
GROUP BY a.id, a.treasury_balance_usdc;

COMMENT ON VIEW v_treasury_summary IS 'Summary of funds held in treasury for unnamed collaborators';

-- ============================================================================
-- PART 8: Function to Process Track Purchase
-- ============================================================================
-- Called after a purchase to record earnings for all split recipients

CREATE OR REPLACE FUNCTION process_track_purchase(
  p_track_id UUID,
  p_buyer_address TEXT,
  p_amount_usdc DECIMAL(18,6),
  p_tx_hash TEXT,
  p_uploader_account_id UUID
)
RETURNS TABLE (
  recipient_type TEXT,
  recipient_id UUID,
  recipient_name TEXT,
  amount DECIMAL(18,6),
  status TEXT
) AS $$
DECLARE
  v_track ip_tracks%ROWTYPE;
  v_comp_pool DECIMAL(18,6);
  v_prod_pool DECIMAL(18,6);
  v_split RECORD;
  v_amount DECIMAL(18,6);
  v_persona_id UUID;
  v_tbd_wallet_id UUID;
  v_status TEXT;
BEGIN
  -- Get track details
  SELECT * INTO v_track FROM ip_tracks WHERE id = p_track_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Track not found: %', p_track_id;
  END IF;

  -- Calculate pools (50/50 split)
  v_comp_pool := p_amount_usdc / 2;
  v_prod_pool := p_amount_usdc / 2;

  -- Process composition splits
  FOR v_split IN
    SELECT
      unnest(ARRAY[1,2,3,4,5,6,7]) as slot,
      unnest(ARRAY[
        v_track.composition_split_1_wallet,
        v_track.composition_split_2_wallet,
        v_track.composition_split_3_wallet,
        v_track.composition_split_4_wallet,
        v_track.composition_split_5_wallet,
        v_track.composition_split_6_wallet,
        v_track.composition_split_7_wallet
      ]) as wallet,
      unnest(ARRAY[
        v_track.composition_split_1_name,
        v_track.composition_split_2_name,
        v_track.composition_split_3_name,
        v_track.composition_split_4_name,
        v_track.composition_split_5_name,
        v_track.composition_split_6_name,
        v_track.composition_split_7_name
      ]) as name,
      unnest(ARRAY[
        v_track.composition_split_1_percentage,
        v_track.composition_split_2_percentage,
        v_track.composition_split_3_percentage,
        v_track.composition_split_4_percentage,
        v_track.composition_split_5_percentage,
        v_track.composition_split_6_percentage,
        v_track.composition_split_7_percentage
      ]) as pct
  LOOP
    IF v_split.pct IS NOT NULL AND v_split.pct > 0 THEN
      v_amount := (v_comp_pool * v_split.pct) / 100;

      IF v_split.wallet IS NOT NULL THEN
        -- Has wallet - try to find persona with SUI address
        SELECT p.id INTO v_persona_id
        FROM personas p
        JOIN accounts a ON p.account_id = a.id
        WHERE p.wallet_address = v_split.wallet
          AND a.sui_address IS NOT NULL
        LIMIT 1;

        IF v_persona_id IS NOT NULL THEN
          -- Pay directly
          PERFORM credit_persona_earnings(v_persona_id, v_amount, 'track_sale', p_track_id, p_buyer_address, p_tx_hash);
          v_status := 'paid';

          recipient_type := 'persona';
          recipient_id := v_persona_id;
          recipient_name := v_split.name;
          amount := v_amount;
          status := v_status;
          RETURN NEXT;
        ELSE
          -- No SUI address, hold in treasury
          v_status := 'held_in_treasury';

          -- Create or update TBD wallet
          SELECT id INTO v_tbd_wallet_id FROM tbd_wallets
          WHERE owner_account_id = p_uploader_account_id
            AND label = COALESCE(v_split.name, v_split.wallet)
            AND track_id = p_track_id;

          IF v_tbd_wallet_id IS NULL THEN
            INSERT INTO tbd_wallets (owner_account_id, label, track_id, split_type, split_percentage, balance_usdc)
            VALUES (p_uploader_account_id, COALESCE(v_split.name, v_split.wallet), p_track_id, 'composition', v_split.pct, v_amount)
            RETURNING id INTO v_tbd_wallet_id;
          ELSE
            UPDATE tbd_wallets SET balance_usdc = balance_usdc + v_amount WHERE id = v_tbd_wallet_id;
          END IF;

          -- Record earning
          INSERT INTO earnings (tbd_wallet_id, amount_usdc, source_type, source_id, buyer_address, tx_hash, status, held_by_account_id)
          VALUES (v_tbd_wallet_id, v_amount, 'track_sale', p_track_id, p_buyer_address, p_tx_hash, 'held_in_treasury', p_uploader_account_id);

          -- Update treasury balance
          UPDATE accounts SET treasury_balance_usdc = treasury_balance_usdc + v_amount WHERE id = p_uploader_account_id;

          recipient_type := 'tbd_wallet';
          recipient_id := v_tbd_wallet_id;
          recipient_name := COALESCE(v_split.name, v_split.wallet);
          amount := v_amount;
          status := v_status;
          RETURN NEXT;
        END IF;
      ELSIF v_split.name IS NOT NULL THEN
        -- Name only - hold in treasury
        v_status := 'held_in_treasury';

        SELECT id INTO v_tbd_wallet_id FROM tbd_wallets
        WHERE owner_account_id = p_uploader_account_id
          AND label = v_split.name
          AND track_id = p_track_id;

        IF v_tbd_wallet_id IS NULL THEN
          INSERT INTO tbd_wallets (owner_account_id, label, track_id, split_type, split_percentage, balance_usdc)
          VALUES (p_uploader_account_id, v_split.name, p_track_id, 'composition', v_split.pct, v_amount)
          RETURNING id INTO v_tbd_wallet_id;
        ELSE
          UPDATE tbd_wallets SET balance_usdc = balance_usdc + v_amount WHERE id = v_tbd_wallet_id;
        END IF;

        INSERT INTO earnings (tbd_wallet_id, amount_usdc, source_type, source_id, buyer_address, tx_hash, status, held_by_account_id)
        VALUES (v_tbd_wallet_id, v_amount, 'track_sale', p_track_id, p_buyer_address, p_tx_hash, 'held_in_treasury', p_uploader_account_id);

        UPDATE accounts SET treasury_balance_usdc = treasury_balance_usdc + v_amount WHERE id = p_uploader_account_id;

        recipient_type := 'tbd_wallet';
        recipient_id := v_tbd_wallet_id;
        recipient_name := v_split.name;
        amount := v_amount;
        status := v_status;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  -- Process production splits (same logic)
  FOR v_split IN
    SELECT
      unnest(ARRAY[1,2,3,4,5,6,7]) as slot,
      unnest(ARRAY[
        v_track.production_split_1_wallet,
        v_track.production_split_2_wallet,
        v_track.production_split_3_wallet,
        v_track.production_split_4_wallet,
        v_track.production_split_5_wallet,
        v_track.production_split_6_wallet,
        v_track.production_split_7_wallet
      ]) as wallet,
      unnest(ARRAY[
        v_track.production_split_1_name,
        v_track.production_split_2_name,
        v_track.production_split_3_name,
        v_track.production_split_4_name,
        v_track.production_split_5_name,
        v_track.production_split_6_name,
        v_track.production_split_7_name
      ]) as name,
      unnest(ARRAY[
        v_track.production_split_1_percentage,
        v_track.production_split_2_percentage,
        v_track.production_split_3_percentage,
        v_track.production_split_4_percentage,
        v_track.production_split_5_percentage,
        v_track.production_split_6_percentage,
        v_track.production_split_7_percentage
      ]) as pct
  LOOP
    IF v_split.pct IS NOT NULL AND v_split.pct > 0 THEN
      v_amount := (v_prod_pool * v_split.pct) / 100;

      IF v_split.wallet IS NOT NULL THEN
        SELECT p.id INTO v_persona_id
        FROM personas p
        JOIN accounts a ON p.account_id = a.id
        WHERE p.wallet_address = v_split.wallet
          AND a.sui_address IS NOT NULL
        LIMIT 1;

        IF v_persona_id IS NOT NULL THEN
          PERFORM credit_persona_earnings(v_persona_id, v_amount, 'track_sale', p_track_id, p_buyer_address, p_tx_hash);
          v_status := 'paid';

          recipient_type := 'persona';
          recipient_id := v_persona_id;
          recipient_name := v_split.name;
          amount := v_amount;
          status := v_status;
          RETURN NEXT;
        ELSE
          v_status := 'held_in_treasury';

          SELECT id INTO v_tbd_wallet_id FROM tbd_wallets
          WHERE owner_account_id = p_uploader_account_id
            AND label = COALESCE(v_split.name, v_split.wallet)
            AND track_id = p_track_id;

          IF v_tbd_wallet_id IS NULL THEN
            INSERT INTO tbd_wallets (owner_account_id, label, track_id, split_type, split_percentage, balance_usdc)
            VALUES (p_uploader_account_id, COALESCE(v_split.name, v_split.wallet), p_track_id, 'production', v_split.pct, v_amount)
            RETURNING id INTO v_tbd_wallet_id;
          ELSE
            UPDATE tbd_wallets SET balance_usdc = balance_usdc + v_amount WHERE id = v_tbd_wallet_id;
          END IF;

          INSERT INTO earnings (tbd_wallet_id, amount_usdc, source_type, source_id, buyer_address, tx_hash, status, held_by_account_id)
          VALUES (v_tbd_wallet_id, v_amount, 'track_sale', p_track_id, p_buyer_address, p_tx_hash, 'held_in_treasury', p_uploader_account_id);

          UPDATE accounts SET treasury_balance_usdc = treasury_balance_usdc + v_amount WHERE id = p_uploader_account_id;

          recipient_type := 'tbd_wallet';
          recipient_id := v_tbd_wallet_id;
          recipient_name := COALESCE(v_split.name, v_split.wallet);
          amount := v_amount;
          status := v_status;
          RETURN NEXT;
        END IF;
      ELSIF v_split.name IS NOT NULL THEN
        v_status := 'held_in_treasury';

        SELECT id INTO v_tbd_wallet_id FROM tbd_wallets
        WHERE owner_account_id = p_uploader_account_id
          AND label = v_split.name
          AND track_id = p_track_id;

        IF v_tbd_wallet_id IS NULL THEN
          INSERT INTO tbd_wallets (owner_account_id, label, track_id, split_type, split_percentage, balance_usdc)
          VALUES (p_uploader_account_id, v_split.name, p_track_id, 'production', v_split.pct, v_amount)
          RETURNING id INTO v_tbd_wallet_id;
        ELSE
          UPDATE tbd_wallets SET balance_usdc = balance_usdc + v_amount WHERE id = v_tbd_wallet_id;
        END IF;

        INSERT INTO earnings (tbd_wallet_id, amount_usdc, source_type, source_id, buyer_address, tx_hash, status, held_by_account_id)
        VALUES (v_tbd_wallet_id, v_amount, 'track_sale', p_track_id, p_buyer_address, p_tx_hash, 'held_in_treasury', p_uploader_account_id);

        UPDATE accounts SET treasury_balance_usdc = treasury_balance_usdc + v_amount WHERE id = p_uploader_account_id;

        recipient_type := 'tbd_wallet';
        recipient_id := v_tbd_wallet_id;
        recipient_name := v_split.name;
        amount := v_amount;
        status := v_status;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION process_track_purchase IS 'Records earnings for all split recipients after a purchase. Returns list of who received what.';

-- ============================================================================
-- PART 9: Grants
-- ============================================================================

GRANT SELECT ON v_earnings_detail TO authenticated;
GRANT SELECT ON v_treasury_summary TO authenticated;
GRANT SELECT ON purchases TO authenticated;
GRANT ALL ON purchases TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary:
-- ✅ Added collaborator name fields to ip_tracks (composition_split_*_name, production_split_*_name)
-- ✅ Added treasury_balance_usdc to accounts
-- ✅ Enhanced earnings table with status and held_by_account_id
-- ✅ Enhanced tbd_wallets with track_id, split_type, split_percentage
-- ✅ Created purchases table for transaction history
-- ✅ Created v_earnings_detail view for Earnings tab
-- ✅ Created v_treasury_summary view for treasury overview
-- ✅ Created process_track_purchase function for recording earnings
