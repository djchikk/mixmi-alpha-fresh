-- Fix for BNS column drop
-- Date: October 30, 2025
-- Issue: Trigger depends on bns_name column

-- Drop the trigger first
DROP TRIGGER IF EXISTS validate_bns_name_trigger ON user_profiles;

-- Drop the trigger function if it exists
DROP FUNCTION IF EXISTS validate_bns_name();

-- Now safe to drop the column
ALTER TABLE user_profiles DROP COLUMN IF EXISTS bns_name;

-- Verify column is gone
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name = 'bns_name';
-- Expected: 0 rows (column removed)
