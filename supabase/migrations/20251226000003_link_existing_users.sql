-- Link Existing Users to Persona Accounting System
-- Run this in Supabase SQL Editor AFTER persona_accounting and usdc_pricing migrations
-- Created: 2025-12-26
--
-- This migration:
-- 1. Creates accounts for existing users (zklogin_users + user_profiles)
-- 2. Creates default personas for each account
-- 3. Links existing tracks to their owner's persona
--
-- Link path: zklogin_users.invite_code → alpha_users.invite_code → alpha_users.wallet_address

-- ============================================
-- 1. CREATE ACCOUNTS FOR ZKLOGIN USERS
-- ============================================

-- Insert accounts for zklogin users who don't have one yet
INSERT INTO accounts (sui_address, account_type, created_at)
SELECT
  z.sui_address,
  'human',
  COALESCE(z.created_at, NOW())
FROM zklogin_users z
WHERE z.sui_address IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.sui_address = z.sui_address
  )
ON CONFLICT (sui_address) DO NOTHING;

-- ============================================
-- 2. CREATE ACCOUNTS FOR STACKS WALLET USERS
-- ============================================

-- Insert accounts for user_profiles with wallet addresses who don't have one yet
-- (Only if they don't already have an account via zklogin)
INSERT INTO accounts (wallet_address, account_type, created_at)
SELECT
  p.wallet_address,
  'human',
  COALESCE(p.created_at, NOW())
FROM user_profiles p
WHERE p.wallet_address IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.wallet_address = p.wallet_address
  )
  -- Also check if this wallet is linked to a zklogin user via alpha_users
  AND NOT EXISTS (
    SELECT 1 FROM accounts a
    JOIN zklogin_users z ON z.sui_address = a.sui_address
    JOIN alpha_users au ON au.invite_code = z.invite_code
    WHERE au.wallet_address = p.wallet_address
  )
ON CONFLICT (wallet_address) DO NOTHING;

-- ============================================
-- 3. LINK ZKLOGIN ACCOUNTS TO STACKS WALLETS
-- ============================================

-- For zklogin users, link their Stacks wallet via alpha_users invite code
UPDATE accounts a
SET wallet_address = au.wallet_address
FROM zklogin_users z
JOIN alpha_users au ON au.invite_code = z.invite_code
WHERE a.sui_address = z.sui_address
  AND a.wallet_address IS NULL
  AND au.wallet_address IS NOT NULL;

-- ============================================
-- 4. LINK USER_PROFILES TO ACCOUNTS
-- ============================================

-- Update user_profiles to link to their account (by wallet_address)
UPDATE user_profiles p
SET account_id = a.id
FROM accounts a
WHERE p.wallet_address = a.wallet_address
  AND p.account_id IS NULL;

-- ============================================
-- 5. CREATE DEFAULT PERSONAS FOR ACCOUNTS
-- ============================================

-- Create personas from user_profiles data
INSERT INTO personas (
  account_id,
  username,
  display_name,
  avatar_url,
  bio,
  is_default,
  is_active,
  created_at
)
SELECT DISTINCT ON (a.id)
  a.id,
  COALESCE(p.username, 'user_' || LEFT(COALESCE(a.wallet_address, a.sui_address), 8)),
  COALESCE(p.display_name, p.username, 'Creator'),
  p.avatar_url,
  p.bio,
  true,  -- is_default
  true,  -- is_active
  COALESCE(p.created_at, NOW())
FROM accounts a
LEFT JOIN user_profiles p ON p.account_id = a.id
WHERE NOT EXISTS (
  SELECT 1 FROM personas pe WHERE pe.account_id = a.id
)
ORDER BY a.id, p.created_at ASC;

-- For accounts without user_profiles, create minimal persona
INSERT INTO personas (
  account_id,
  username,
  display_name,
  is_default,
  is_active,
  created_at
)
SELECT
  a.id,
  'user_' || LEFT(COALESCE(a.wallet_address, a.sui_address), 8),
  'Creator',
  true,
  true,
  a.created_at
FROM accounts a
WHERE NOT EXISTS (
  SELECT 1 FROM personas pe WHERE pe.account_id = a.id
);

-- ============================================
-- 6. LINK TRACKS TO PERSONAS
-- ============================================

-- Link ip_tracks to their owner's persona (via primary_uploader_wallet)
UPDATE ip_tracks t
SET persona_id = pe.id
FROM personas pe
JOIN accounts a ON a.id = pe.account_id
WHERE t.primary_uploader_wallet = a.wallet_address
  AND t.persona_id IS NULL
  AND pe.is_default = true;

-- ============================================
-- 7. VERIFICATION QUERIES
-- ============================================

DO $$
DECLARE
  v_accounts INTEGER;
  v_personas INTEGER;
  v_linked_profiles INTEGER;
  v_linked_tracks INTEGER;
  v_unlinked_tracks INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_accounts FROM accounts;
  SELECT COUNT(*) INTO v_personas FROM personas;
  SELECT COUNT(*) INTO v_linked_profiles FROM user_profiles WHERE account_id IS NOT NULL;
  SELECT COUNT(*) INTO v_linked_tracks FROM ip_tracks WHERE persona_id IS NOT NULL;
  SELECT COUNT(*) INTO v_unlinked_tracks FROM ip_tracks WHERE persona_id IS NULL AND is_deleted IS NOT TRUE;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Accounts created: %', v_accounts;
  RAISE NOTICE 'Personas created: %', v_personas;
  RAISE NOTICE 'Profiles linked to accounts: %', v_linked_profiles;
  RAISE NOTICE 'Tracks linked to personas: %', v_linked_tracks;
  RAISE NOTICE 'Tracks still unlinked: %', v_unlinked_tracks;
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- 8. HELPFUL QUERIES (Run manually to verify)
-- ============================================

-- Check accounts with their personas:
-- SELECT a.id, a.wallet_address, a.sui_address, pe.username, pe.display_name
-- FROM accounts a
-- LEFT JOIN personas pe ON pe.account_id = a.id AND pe.is_default = true
-- ORDER BY a.created_at DESC
-- LIMIT 20;

-- Check tracks with their persona owners:
-- SELECT t.title, t.primary_uploader_wallet, pe.username, pe.display_name
-- FROM ip_tracks t
-- LEFT JOIN personas pe ON pe.id = t.persona_id
-- WHERE t.is_deleted IS NOT TRUE
-- ORDER BY t.created_at DESC
-- LIMIT 20;

-- Find any orphaned tracks (no persona):
-- SELECT t.id, t.title, t.primary_uploader_wallet
-- FROM ip_tracks t
-- WHERE t.persona_id IS NULL AND t.is_deleted IS NOT TRUE;

