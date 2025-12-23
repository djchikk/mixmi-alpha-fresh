-- ZkLogin Support Migration
-- Run this in Supabase SQL Editor

-- 1. Add sui_address column to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sui_address TEXT;
CREATE INDEX IF NOT EXISTS idx_user_profiles_sui_address ON user_profiles(sui_address);

-- 2. Create zklogin_users table for salt management
CREATE TABLE IF NOT EXISTS zklogin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT UNIQUE NOT NULL,      -- Google's unique user ID (from JWT sub claim)
  email TEXT,                            -- Google email (for display/admin lookup)
  salt TEXT NOT NULL,                    -- Random salt for address derivation (hex string)
  sui_address TEXT NOT NULL,             -- Derived SUI address
  invite_code TEXT NOT NULL,             -- Alpha invite code used to register
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_zklogin_google_sub ON zklogin_users(google_sub);
CREATE INDEX IF NOT EXISTS idx_zklogin_sui_address ON zklogin_users(sui_address);
CREATE INDEX IF NOT EXISTS idx_zklogin_invite_code ON zklogin_users(invite_code);

-- 3. Add RLS policies for zklogin_users table
ALTER TABLE zklogin_users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own zklogin record (by sui_address in JWT)
CREATE POLICY "Users can view own zklogin record" ON zklogin_users
  FOR SELECT
  USING (sui_address = current_setting('request.jwt.claims', true)::json->>'sui_address');

-- Service role can insert/update (used by our API)
CREATE POLICY "Service can manage zklogin users" ON zklogin_users
  FOR ALL
  USING (auth.role() = 'service_role');

-- 4. Update user_profiles RLS to support sui_address
-- Allow users to access their profile by either wallet_address OR sui_address

-- Drop existing select policy if it exists (to recreate with OR condition)
-- Note: You may need to adjust this based on your existing policies
-- This is additive - it creates a new policy for SUI users

CREATE POLICY "Users can view own profile by sui_address" ON user_profiles
  FOR SELECT
  USING (sui_address = current_setting('request.jwt.claims', true)::json->>'sui_address');

CREATE POLICY "Users can update own profile by sui_address" ON user_profiles
  FOR UPDATE
  USING (sui_address = current_setting('request.jwt.claims', true)::json->>'sui_address');

-- 5. Function to link zklogin to user profile
-- This creates or updates a user_profiles entry when a zkLogin user is created
CREATE OR REPLACE FUNCTION link_zklogin_to_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if profile already exists for this invite code's wallet
  -- If so, add sui_address to existing profile
  UPDATE user_profiles
  SET sui_address = NEW.sui_address,
      updated_at = NOW()
  WHERE wallet_address = (
    SELECT wallet_address FROM alpha_users WHERE invite_code = NEW.invite_code
  );

  -- If no rows updated, the profile might not exist yet
  -- The profile will be created on first authenticated request

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-link on zklogin user creation
DROP TRIGGER IF EXISTS trigger_link_zklogin_profile ON zklogin_users;
CREATE TRIGGER trigger_link_zklogin_profile
  AFTER INSERT ON zklogin_users
  FOR EACH ROW
  EXECUTE FUNCTION link_zklogin_to_profile();

-- 6. Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON zklogin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON zklogin_users TO service_role;
