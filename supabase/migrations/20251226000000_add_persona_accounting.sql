-- Persona Accounting System Migration
-- Run this in Supabase SQL Editor
-- Created: 2024-12-26

-- ============================================
-- 1. ACCOUNTS TABLE (Unified Identity)
-- ============================================
-- This becomes the master identity table, supporting multiple auth methods

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Auth identifiers (one or more may be set)
  wallet_address TEXT UNIQUE,              -- Stacks wallet (if connected)
  sui_address TEXT UNIQUE,                 -- SUI address from zkLogin

  -- Account type and status
  account_type TEXT DEFAULT 'human' CHECK (account_type IN ('human', 'agent')),
  api_key UUID UNIQUE,                     -- For agent accounts

  -- Agent-specific config
  agent_config JSONB,                      -- { "owner_account_id": "...", "spending_limit": 100 }

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounts_wallet ON accounts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_accounts_sui ON accounts(sui_address);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_api_key ON accounts(api_key);

-- ============================================
-- 2. PERSONAS TABLE (Creative Identities)
-- ============================================
-- Each account can have up to 3 personas

CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identity
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,

  -- Accounting
  balance_usdc DECIMAL(18,6) DEFAULT 0,

  -- Payout settings
  payout_address TEXT,                     -- External wallet for withdrawals (any chain)
  payout_chain TEXT DEFAULT 'sui',         -- 'sui', 'stacks', 'eth', etc.

  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_personas_account ON personas(account_id);
CREATE INDEX IF NOT EXISTS idx_personas_username ON personas(username);
CREATE INDEX IF NOT EXISTS idx_personas_default ON personas(account_id, is_default);

-- Constraint: Max 3 personas per account
CREATE OR REPLACE FUNCTION check_persona_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM personas WHERE account_id = NEW.account_id) >= 3 THEN
    RAISE EXCEPTION 'Maximum of 3 personas per account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_persona_limit
  BEFORE INSERT ON personas
  FOR EACH ROW
  EXECUTE FUNCTION check_persona_limit();

-- ============================================
-- 3. TBD WALLETS TABLE (Unclaimed Collaborator Shares)
-- ============================================
-- Each account can have up to 5 TBD wallets for collaborators

CREATE TABLE IF NOT EXISTS tbd_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,

  -- Identification
  label VARCHAR(100) NOT NULL,             -- "Sarah" or "Producer Mike"
  contact_email VARCHAR(255),              -- Optional, for notifications
  contact_note TEXT,                       -- "Met at SXSW 2024"

  -- Accounting
  balance_usdc DECIMAL(18,6) DEFAULT 0,

  -- Claim mechanism
  claim_code UUID DEFAULT gen_random_uuid(),
  claimed_by_account_id UUID REFERENCES accounts(id),
  claimed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tbd_owner ON tbd_wallets(owner_account_id);
CREATE INDEX IF NOT EXISTS idx_tbd_claim_code ON tbd_wallets(claim_code);
CREATE INDEX IF NOT EXISTS idx_tbd_claimed_by ON tbd_wallets(claimed_by_account_id);

-- Constraint: Max 5 TBD wallets per account
CREATE OR REPLACE FUNCTION check_tbd_wallet_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM tbd_wallets WHERE owner_account_id = NEW.owner_account_id AND claimed_at IS NULL) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 unclaimed TBD wallets per account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_tbd_wallet_limit
  BEFORE INSERT ON tbd_wallets
  FOR EACH ROW
  EXECUTE FUNCTION check_tbd_wallet_limit();

-- ============================================
-- 4. EARNINGS LEDGER (Immutable Audit Trail)
-- ============================================

CREATE TABLE IF NOT EXISTS earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who earned (one of these)
  persona_id UUID REFERENCES personas(id),
  tbd_wallet_id UUID REFERENCES tbd_wallets(id),

  -- Amount
  amount_usdc DECIMAL(18,6) NOT NULL,

  -- Source
  source_type VARCHAR(50) NOT NULL,        -- 'track_sale', 'tip', 'royalty_split', 'remix_royalty'
  source_id UUID,                          -- track_id, etc.
  source_details JSONB,                    -- Additional context

  -- Buyer/payer info
  buyer_address TEXT,
  buyer_persona_id UUID REFERENCES personas(id),

  -- On-chain reference
  tx_hash TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure exactly one recipient
  CONSTRAINT earnings_single_recipient CHECK (
    (persona_id IS NOT NULL AND tbd_wallet_id IS NULL) OR
    (persona_id IS NULL AND tbd_wallet_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_earnings_persona ON earnings(persona_id);
CREATE INDEX IF NOT EXISTS idx_earnings_tbd ON earnings(tbd_wallet_id);
CREATE INDEX IF NOT EXISTS idx_earnings_source ON earnings(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_earnings_created ON earnings(created_at);

-- ============================================
-- 5. WITHDRAWALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id),

  -- Amount
  amount_usdc DECIMAL(18,6) NOT NULL,

  -- Destination
  to_address TEXT NOT NULL,
  to_chain TEXT DEFAULT 'sui',

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  failure_reason TEXT,

  -- On-chain reference
  tx_hash TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_withdrawals_persona ON withdrawals(persona_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- ============================================
-- 6. LINK EXISTING TABLES
-- ============================================

-- Add persona_id to ip_tracks (tracks belong to personas now)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES personas(id);
CREATE INDEX IF NOT EXISTS idx_tracks_persona ON ip_tracks(persona_id);

-- Add account_id to user_profiles (link profiles to unified accounts)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id);
CREATE INDEX IF NOT EXISTS idx_profiles_account ON user_profiles(account_id);

-- ============================================
-- 7. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE tbd_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

-- Public read for personas (they're public profiles)
CREATE POLICY "Personas are publicly viewable"
  ON personas FOR SELECT
  USING (is_active = true);

-- Service role can manage everything
CREATE POLICY "Service can manage accounts" ON accounts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service can manage personas" ON personas FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service can manage tbd_wallets" ON tbd_wallets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service can manage earnings" ON earnings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service can manage withdrawals" ON withdrawals FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- 8. HELPER FUNCTIONS
-- ============================================

-- Function to credit earnings to a persona
CREATE OR REPLACE FUNCTION credit_persona_earnings(
  p_persona_id UUID,
  p_amount DECIMAL(18,6),
  p_source_type VARCHAR(50),
  p_source_id UUID DEFAULT NULL,
  p_buyer_address TEXT DEFAULT NULL,
  p_tx_hash TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_earning_id UUID;
BEGIN
  -- Insert earning record
  INSERT INTO earnings (persona_id, amount_usdc, source_type, source_id, buyer_address, tx_hash)
  VALUES (p_persona_id, p_amount, p_source_type, p_source_id, p_buyer_address, p_tx_hash)
  RETURNING id INTO v_earning_id;

  -- Update persona balance
  UPDATE personas SET balance_usdc = balance_usdc + p_amount, updated_at = NOW()
  WHERE id = p_persona_id;

  RETURN v_earning_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to credit earnings to a TBD wallet
CREATE OR REPLACE FUNCTION credit_tbd_earnings(
  p_tbd_wallet_id UUID,
  p_amount DECIMAL(18,6),
  p_source_type VARCHAR(50),
  p_source_id UUID DEFAULT NULL,
  p_buyer_address TEXT DEFAULT NULL,
  p_tx_hash TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_earning_id UUID;
BEGIN
  -- Insert earning record
  INSERT INTO earnings (tbd_wallet_id, amount_usdc, source_type, source_id, buyer_address, tx_hash)
  VALUES (p_tbd_wallet_id, p_amount, p_source_type, p_source_id, p_buyer_address, p_tx_hash)
  RETURNING id INTO v_earning_id;

  -- Update TBD wallet balance
  UPDATE tbd_wallets SET balance_usdc = balance_usdc + p_amount, updated_at = NOW()
  WHERE id = p_tbd_wallet_id;

  RETURN v_earning_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to claim a TBD wallet
CREATE OR REPLACE FUNCTION claim_tbd_wallet(
  p_claim_code UUID,
  p_claimer_account_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_tbd_wallet tbd_wallets%ROWTYPE;
  v_new_persona_id UUID;
BEGIN
  -- Find and lock the TBD wallet
  SELECT * INTO v_tbd_wallet
  FROM tbd_wallets
  WHERE claim_code = p_claim_code AND claimed_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or already claimed TBD wallet';
  END IF;

  -- Mark as claimed
  UPDATE tbd_wallets
  SET claimed_by_account_id = p_claimer_account_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = v_tbd_wallet.id;

  -- Create a new persona for the claimer with the balance
  INSERT INTO personas (account_id, username, display_name, balance_usdc, is_default)
  VALUES (
    p_claimer_account_id,
    'claimed_' || substring(p_claim_code::text, 1, 8),  -- Temporary username
    v_tbd_wallet.label,
    v_tbd_wallet.balance_usdc,
    false
  )
  RETURNING id INTO v_new_persona_id;

  RETURN v_new_persona_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 9. UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personas_updated_at
  BEFORE UPDATE ON personas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tbd_wallets_updated_at
  BEFORE UPDATE ON tbd_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. GRANTS
-- ============================================

GRANT SELECT ON accounts TO authenticated;
GRANT SELECT ON personas TO authenticated;
GRANT SELECT ON tbd_wallets TO authenticated;
GRANT SELECT ON earnings TO authenticated;
GRANT SELECT ON withdrawals TO authenticated;

GRANT ALL ON accounts TO service_role;
GRANT ALL ON personas TO service_role;
GRANT ALL ON tbd_wallets TO service_role;
GRANT ALL ON earnings TO service_role;
GRANT ALL ON withdrawals TO service_role;
