-- ========================================
-- FIX: Add PRIMARY KEY to user_profiles
-- ========================================
-- IMPORTANT: Only run this AFTER creating backups!

-- Step 1: Check for duplicate wallet addresses (should return 0 rows)
SELECT wallet_address, COUNT(*) as count
FROM user_profiles
GROUP BY wallet_address
HAVING COUNT(*) > 1;

-- If the query above returns 0 rows, proceed with Step 2:

-- Step 2: Add PRIMARY KEY constraint
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_pkey
PRIMARY KEY (wallet_address);

-- Step 3: Verify the constraint was added
SELECT
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'user_profiles'::regclass;

-- Should show:
-- user_profiles_pkey | p (p = primary key)
