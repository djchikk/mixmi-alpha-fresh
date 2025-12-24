-- =================================================================
-- IMPLEMENT COLLABORATION SYSTEM: Framework 4 (Hybrid Approach)
-- =================================================================
-- This script implements the hybrid collaboration system that:
-- 1. Distinguishes primary uploader from collaborators
-- 2. Allows per-creator collaboration display preferences
-- 3. Maintains backward compatibility with existing 59 tracks
-- 4. Provides flexible scaling for future needs
-- =================================================================

-- Step 1: Add collaboration system columns
-- =================================================================
-- Primary uploader (who "owns" the track in their store)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS primary_uploader_wallet TEXT;

-- Collaboration display preferences (per-track basis)
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS collaboration_preferences JSONB DEFAULT '{}';

-- Store display policy (per-track basis) - MC Claude recommends inclusive defaults
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS store_display_policy TEXT DEFAULT 'all_collaborations';

-- MC Claude's suggestion: Add collaboration type for future filtering
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS collaboration_type TEXT DEFAULT 'primary_artist';

-- Step 2: Set up constraints and indexes
-- =================================================================
-- Add constraint for valid store display policies
ALTER TABLE ip_tracks ADD CONSTRAINT check_store_display_policy 
CHECK (store_display_policy IN ('primary_only', 'all_collaborations', 'curated_collaborations'));

-- Add constraint for valid collaboration types (MC Claude's suggestion)
ALTER TABLE ip_tracks ADD CONSTRAINT check_collaboration_type 
CHECK (collaboration_type IN ('primary_artist', 'featured_artist', 'producer', 'remixer', 'composer', 'vocalist'));

-- Create index for efficient store filtering
CREATE INDEX IF NOT EXISTS idx_ip_tracks_primary_uploader ON ip_tracks(primary_uploader_wallet);
CREATE INDEX IF NOT EXISTS idx_ip_tracks_display_policy ON ip_tracks(store_display_policy);
CREATE INDEX IF NOT EXISTS idx_ip_tracks_collaboration_type ON ip_tracks(collaboration_type);

-- Step 3: Migrate existing 59 tracks (MC Claude's inclusive strategy)
-- =================================================================
-- Set primary_uploader_wallet to uploader_address for all existing tracks
UPDATE ip_tracks 
SET primary_uploader_wallet = uploader_address 
WHERE primary_uploader_wallet IS NULL;

-- Set default collaboration preferences for existing tracks
UPDATE ip_tracks 
SET collaboration_preferences = '{}'::jsonb 
WHERE collaboration_preferences IS NULL;

-- MC Claude's recommendation: Set inclusive defaults for existing tracks
UPDATE ip_tracks 
SET store_display_policy = 'all_collaborations'
WHERE store_display_policy IS NULL;

-- Set collaboration type for existing tracks
UPDATE ip_tracks 
SET collaboration_type = 'primary_artist'
WHERE collaboration_type IS NULL;

-- Step 4: Create helper functions
-- =================================================================
-- Function to check if a wallet should see a track in their store
CREATE OR REPLACE FUNCTION should_show_track_in_store(
    track_record ip_tracks,
    wallet_address TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Always show if you're the primary uploader
    IF track_record.primary_uploader_wallet = wallet_address THEN
        RETURN true;
    END IF;
    
    -- Check if you're in any splits
    IF wallet_address IN (
        track_record.composition_split_1_wallet,
        track_record.composition_split_2_wallet,
        track_record.composition_split_3_wallet,
        track_record.production_split_1_wallet,
        track_record.production_split_2_wallet,
        track_record.production_split_3_wallet
    ) THEN
        -- Check store display policy
        CASE track_record.store_display_policy
            WHEN 'primary_only' THEN
                RETURN false;
            WHEN 'all_collaborations' THEN
                RETURN true;
            WHEN 'curated_collaborations' THEN
                -- Check if this specific wallet is allowed
                RETURN coalesce(
                    (track_record.collaboration_preferences ->> wallet_address)::boolean,
                    false
                );
            ELSE
                RETURN false;
        END CASE;
    END IF;
    
    -- Default: don't show
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create view for store display
-- =================================================================
-- View that applies collaboration filtering automatically
CREATE OR REPLACE VIEW ip_tracks_store_display AS
SELECT 
    t.*,
    -- Helper field to identify display reason
    CASE 
        WHEN t.primary_uploader_wallet = auth.jwt() ->> 'wallet_address' THEN 'primary'
        WHEN should_show_track_in_store(t, auth.jwt() ->> 'wallet_address') THEN 'collaboration'
        ELSE 'hidden'
    END as display_reason
FROM ip_tracks t
WHERE should_show_track_in_store(t, auth.jwt() ->> 'wallet_address');

-- Step 6: Add RLS policies
-- =================================================================
-- Policy for viewing tracks in store context
CREATE POLICY "Users can view tracks for their store" ON ip_tracks
    FOR SELECT 
    USING (should_show_track_in_store(ip_tracks, auth.jwt() ->> 'wallet_address'));

-- Step 7: Create utility functions for collaboration management
-- =================================================================
-- Function to set collaboration preferences for a track
CREATE OR REPLACE FUNCTION set_collaboration_preference(
    track_id UUID,
    wallet_address TEXT,
    show_on_store BOOLEAN
) RETURNS VOID AS $$
BEGIN
    UPDATE ip_tracks 
    SET collaboration_preferences = collaboration_preferences || 
        jsonb_build_object(wallet_address, show_on_store)
    WHERE id = track_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get all collaborators for a track
CREATE OR REPLACE FUNCTION get_track_collaborators(track_id UUID) 
RETURNS TABLE(
    wallet_address TEXT,
    role TEXT,
    percentage DECIMAL(5,2),
    show_on_store BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        split_wallet,
        split_role,
        split_percentage,
        coalesce(
            (t.collaboration_preferences ->> split_wallet)::boolean,
            CASE t.store_display_policy
                WHEN 'all_collaborations' THEN true
                ELSE false
            END
        ) as show_on_store
    FROM ip_tracks t,
    LATERAL (
        VALUES 
            (t.composition_split_1_wallet, 'composer', t.composition_split_1_percentage),
            (t.composition_split_2_wallet, 'composer', t.composition_split_2_percentage),
            (t.composition_split_3_wallet, 'composer', t.composition_split_3_percentage),
            (t.production_split_1_wallet, 'producer', t.production_split_1_percentage),
            (t.production_split_2_wallet, 'producer', t.production_split_2_percentage),
            (t.production_split_3_wallet, 'producer', t.production_split_3_percentage)
    ) AS splits(split_wallet, split_role, split_percentage)
    WHERE t.id = track_id 
    AND split_wallet IS NOT NULL 
    AND split_wallet != ''
    AND split_percentage > 0;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Add comments for documentation
-- =================================================================
COMMENT ON COLUMN ip_tracks.primary_uploader_wallet IS 'The wallet that owns this track in their store - typically the uploader';
COMMENT ON COLUMN ip_tracks.collaboration_preferences IS 'JSON object mapping wallet addresses to show_on_store boolean preferences';
COMMENT ON COLUMN ip_tracks.store_display_policy IS 'How to handle collaboration display: primary_only, all_collaborations, or curated_collaborations';
COMMENT ON COLUMN ip_tracks.collaboration_type IS 'MC Claude enhancement: Type of collaboration for future filtering (primary_artist, featured_artist, producer, remixer, composer, vocalist)';

-- Step 9: Verification queries
-- =================================================================
-- Check that all tracks have primary_uploader_wallet set
-- SELECT COUNT(*) as tracks_with_primary_uploader FROM ip_tracks WHERE primary_uploader_wallet IS NOT NULL;

-- Check collaboration preferences structure
-- SELECT id, title, primary_uploader_wallet, collaboration_preferences, store_display_policy FROM ip_tracks LIMIT 5;

-- Test the helper function
-- SELECT * FROM get_track_collaborators((SELECT id FROM ip_tracks LIMIT 1));

-- =================================================================
-- MIGRATION COMPLETE
-- =================================================================
-- The collaboration system is now implemented with:
-- ✅ Primary uploader designation
-- ✅ Flexible collaboration preferences  
-- ✅ Store display policies
-- ✅ Helper functions for management
-- ✅ RLS policies for security
-- ✅ Backward compatibility with existing tracks
-- ================================================================= 