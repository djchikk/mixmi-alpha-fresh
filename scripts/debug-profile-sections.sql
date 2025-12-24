-- Debug Profile Sections for Wallet: SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM
-- Purpose: Understand where profile image and profile data is stored

-- 1. Check all sections for this wallet in user_profile_sections
SELECT
  id,
  wallet_address,
  section_type,
  section_order,
  is_visible,
  config,
  created_at,
  updated_at
FROM user_profile_sections
WHERE wallet_address = 'SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM'
ORDER BY section_order;

-- 2. Count sections by type for this wallet
SELECT
  section_type,
  COUNT(*) as count,
  SUM(CASE WHEN is_visible THEN 1 ELSE 0 END) as visible_count
FROM user_profile_sections
WHERE wallet_address = 'SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM'
GROUP BY section_type
ORDER BY section_type;

-- 3. Check specifically for profile section (if it exists as a section type)
SELECT
  id,
  wallet_address,
  section_type,
  config::text as config_text,
  jsonb_pretty(config) as config_pretty
FROM user_profile_sections
WHERE wallet_address = 'SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM'
  AND section_type = 'profile';

-- 4. Check user_profiles table for profile metadata
SELECT
  wallet_address,
  display_name,
  bio,
  profile_image,
  location,
  website,
  created_at,
  updated_at
FROM user_profiles
WHERE wallet_address = 'SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM';

-- 5. Check if profile image might be in config of any section type
SELECT
  section_type,
  config::text as config_text,
  config->'profile_image' as profile_image_path,
  config->'profileImage' as profile_image_camel
FROM user_profile_sections
WHERE wallet_address = 'SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM'
  AND (
    config::text LIKE '%profile%image%'
    OR config::text LIKE '%profileImage%'
  );

-- 6. Show full config structure for all sections (pretty printed)
SELECT
  section_type,
  jsonb_pretty(config) as config_structure
FROM user_profile_sections
WHERE wallet_address = 'SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM'
ORDER BY section_order;

-- 7. Check if there are any records at all for this wallet in either table
SELECT
  'user_profiles' as table_name,
  COUNT(*) as record_count
FROM user_profiles
WHERE wallet_address = 'SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM'
UNION ALL
SELECT
  'user_profile_sections' as table_name,
  COUNT(*) as record_count
FROM user_profile_sections
WHERE wallet_address = 'SP8YV7E4J52P3ZQ37FS668GF2283VCQWS1YET8YM';