-- Migration: Persona Wallets
-- Adds individual SUI wallets for each persona (Manager Wallet System)
-- Created: 2025-12-29

-- ============================================================================
-- PART 1: Add Wallet Fields to Personas
-- ============================================================================
-- Each persona gets its own SUI address with encrypted private key

ALTER TABLE personas
ADD COLUMN IF NOT EXISTS sui_address TEXT,
ADD COLUMN IF NOT EXISTS sui_keypair_encrypted TEXT,
ADD COLUMN IF NOT EXISTS sui_keypair_nonce TEXT,
ADD COLUMN IF NOT EXISTS payout_address TEXT;

COMMENT ON COLUMN personas.sui_address IS 'Generated SUI address for this persona (receives payments)';
COMMENT ON COLUMN personas.sui_keypair_encrypted IS 'Encrypted private key (only manager can decrypt)';
COMMENT ON COLUMN personas.sui_keypair_nonce IS 'Encryption nonce for keypair';
COMMENT ON COLUMN personas.payout_address IS 'Optional external address for automatic payouts';

CREATE INDEX IF NOT EXISTS idx_personas_sui_address ON personas(sui_address);

-- ============================================================================
-- PART 2: Add Wallet Fields to TBD Wallets
-- ============================================================================
-- TBD wallets for unnamed collaborators also get real SUI addresses

ALTER TABLE tbd_wallets
ADD COLUMN IF NOT EXISTS sui_address TEXT,
ADD COLUMN IF NOT EXISTS sui_keypair_encrypted TEXT,
ADD COLUMN IF NOT EXISTS sui_keypair_nonce TEXT;

COMMENT ON COLUMN tbd_wallets.sui_address IS 'Generated SUI address for this TBD wallet';
COMMENT ON COLUMN tbd_wallets.sui_keypair_encrypted IS 'Encrypted private key (manager controls until claimed)';
COMMENT ON COLUMN tbd_wallets.sui_keypair_nonce IS 'Encryption nonce for keypair';

CREATE INDEX IF NOT EXISTS idx_tbd_wallets_sui_address ON tbd_wallets(sui_address);

-- ============================================================================
-- PART 3: Add Manager Salt to Accounts
-- ============================================================================
-- Store the zkLogin salt for key derivation

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS zklogin_salt TEXT;

COMMENT ON COLUMN accounts.zklogin_salt IS 'zkLogin salt for deriving encryption keys';

-- ============================================================================
-- DONE
-- ============================================================================

-- Summary:
-- Added sui_address, sui_keypair_encrypted, sui_keypair_nonce to personas
-- Added sui_address, sui_keypair_encrypted, sui_keypair_nonce to tbd_wallets
-- Added zklogin_salt to accounts
--
-- The encrypted keypairs can only be decrypted by the account holder
-- using their zkLogin credentials + server secret
