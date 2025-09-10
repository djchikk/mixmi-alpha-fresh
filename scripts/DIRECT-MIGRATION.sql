-- =====================================================================
-- DIRECT MIGRATION: RENAME FIELDS TO MATCH NEW COLLABORATION SYSTEM
-- =====================================================================
-- 
-- INSTRUCTIONS:
-- 1. Copy this entire SQL code
-- 2. Go to your Supabase dashboard > SQL Editor
-- 3. Paste and run this code
-- 4. Your database will match the new collaboration system!
-- 
-- =====================================================================

-- Step 1: Rename composition fields
ALTER TABLE ip_tracks RENAME COLUMN composition_address1 TO composition_split_1_wallet;
ALTER TABLE ip_tracks RENAME COLUMN composition_shares1 TO composition_split_1_percentage;
ALTER TABLE ip_tracks RENAME COLUMN composition_address2 TO composition_split_2_wallet;
ALTER TABLE ip_tracks RENAME COLUMN composition_shares2 TO composition_split_2_percentage;
ALTER TABLE ip_tracks RENAME COLUMN composition_address3 TO composition_split_3_wallet;
ALTER TABLE ip_tracks RENAME COLUMN composition_shares3 TO composition_split_3_percentage;

-- Step 2: Rename production fields  
ALTER TABLE ip_tracks RENAME COLUMN production_address1 TO production_split_1_wallet;
ALTER TABLE ip_tracks RENAME COLUMN production_shares1 TO production_split_1_percentage;
ALTER TABLE ip_tracks RENAME COLUMN production_address2 TO production_split_2_wallet;
ALTER TABLE ip_tracks RENAME COLUMN production_shares2 TO production_split_2_percentage;
ALTER TABLE ip_tracks RENAME COLUMN production_address3 TO production_split_3_wallet;
ALTER TABLE ip_tracks RENAME COLUMN production_shares3 TO production_split_3_percentage;

-- Step 3: Add new licensing fields
ALTER TABLE ip_tracks ADD COLUMN allow_remixing BOOLEAN DEFAULT true;
ALTER TABLE ip_tracks ADD COLUMN open_to_collaboration BOOLEAN DEFAULT true;
ALTER TABLE ip_tracks ADD COLUMN license_type VARCHAR(50) DEFAULT 'remix_only';

-- Step 4: Migrate existing licensing data
UPDATE ip_tracks SET allow_remixing = agree_permissions WHERE agree_permissions IS NOT NULL;
UPDATE ip_tracks SET open_to_collaboration = agree_collab WHERE agree_collab IS NOT NULL;
UPDATE ip_tracks SET license_type = 'custom' WHERE licensed_by IS NOT NULL;

-- Step 5: Verification query
SELECT 
    title,
    artist,
    composition_split_1_wallet,
    composition_split_1_percentage,
    production_split_1_wallet,
    production_split_1_percentage,
    allow_remixing,
    open_to_collaboration,
    license_type
FROM ip_tracks 
LIMIT 3;

-- =====================================================================
-- MIGRATION COMPLETE!
-- Your TrackCards will now show proper attribution and licensing info!
-- ===================================================================== 