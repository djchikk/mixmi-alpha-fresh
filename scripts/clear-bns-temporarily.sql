-- Temporarily clear BNS names and convert them to usernames
-- This helps while we sort out BNS/BNSx API compatibility issues

-- For any profile that has a BNS name but no username,
-- convert the BNS name to a username (without the .btc/.id suffix)
UPDATE user_profiles
SET
  username = CASE
    WHEN username IS NULL OR username = ''
    THEN SPLIT_PART(bns_name, '.', 1)  -- Get the part before the dot
    ELSE username
  END,
  bns_name = NULL  -- Clear the BNS name
WHERE bns_name IS NOT NULL;

-- Show what was updated
SELECT
  wallet_address,
  username,
  bns_name,
  display_name
FROM user_profiles
WHERE wallet_address IN (
  SELECT wallet_address
  FROM user_profiles
  WHERE username IS NOT NULL
)
ORDER BY updated_at DESC
LIMIT 10;