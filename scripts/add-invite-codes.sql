-- 🔐 ADD ALPHA INVITE CODE SYSTEM
-- Run this script in Supabase SQL Editor

-- Step 1: Add invite_code column to alpha_users table
ALTER TABLE alpha_users 
ADD COLUMN IF NOT EXISTS invite_code VARCHAR(12) UNIQUE;

-- Step 2: Add index for performance
CREATE INDEX IF NOT EXISTS idx_alpha_users_invite_code 
ON alpha_users(invite_code);

-- Step 3: Generate invite codes for existing users
-- (We'll do this manually since PostgreSQL random string generation is complex)

-- You can manually update users with invite codes like:
-- UPDATE alpha_users SET invite_code = 'MIXMI-ABC123' WHERE wallet_address = 'SP2J6ZY4...';
-- UPDATE alpha_users SET invite_code = 'MIXMI-DEF456' WHERE wallet_address = 'SP3NTV9Y...';
-- etc.

-- Step 4: Create function to validate invite codes (for API use)
CREATE OR REPLACE FUNCTION validate_alpha_invite(input_code TEXT)
RETURNS TABLE(wallet_address TEXT, artist_name TEXT, approved BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT au.wallet_address, au.artist_name, au.approved
  FROM alpha_users au
  WHERE au.invite_code = input_code OR au.wallet_address = input_code;
END;
$$;

-- Step 5: Add comment for documentation
COMMENT ON COLUMN alpha_users.invite_code IS 'Alpha invite codes in format MIXMI-ABC123 for secure authentication';
COMMENT ON FUNCTION validate_alpha_invite IS 'Validates invite codes or wallet addresses for backward compatibility';

-- Verification query to check results
-- SELECT wallet_address, artist_name, invite_code FROM alpha_users ORDER BY created_at;