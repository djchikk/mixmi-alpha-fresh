-- ========================================
-- Add Test Database Fix User to Alpha Users
-- ========================================
-- Run this in Supabase SQL Editor

-- First check if user already exists
SELECT wallet_address, artist_name, created_at
FROM alpha_users
WHERE wallet_address = 'SPCHY1Y4CWYFBQJZWP4MZZAHQS222Q6D9RHAWSEG';

-- If the query above returns 0 rows, run this INSERT:
INSERT INTO alpha_users (wallet_address, artist_name, created_at)
VALUES (
  'SPCHY1Y4CWYFBQJZWP4MZZAHQS222Q6D9RHAWSEG',
  'Test Database Fix',
  NOW()
);

-- Verify the user was added
SELECT wallet_address, artist_name, created_at
FROM alpha_users
WHERE wallet_address = 'SPCHY1Y4CWYFBQJZWP4MZZAHQS222Q6D9RHAWSEG';
