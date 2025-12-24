-- Migration: Add Gen 1 Remix Support
-- Expands split fields from 3 to 7 per category (14 total)
-- Adds track lineage table for discovery features
-- Adds generation tracking

-- ============================================================================
-- PART 1: Expand Split Fields (3 → 7 per category)
-- ============================================================================

-- Add composition splits 4-7
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS composition_split_4_wallet TEXT,
ADD COLUMN IF NOT EXISTS composition_split_4_percentage INTEGER,
ADD COLUMN IF NOT EXISTS composition_split_5_wallet TEXT,
ADD COLUMN IF NOT EXISTS composition_split_5_percentage INTEGER,
ADD COLUMN IF NOT EXISTS composition_split_6_wallet TEXT,
ADD COLUMN IF NOT EXISTS composition_split_6_percentage INTEGER,
ADD COLUMN IF NOT EXISTS composition_split_7_wallet TEXT,
ADD COLUMN IF NOT EXISTS composition_split_7_percentage INTEGER;

-- Add production splits 4-7
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS production_split_4_wallet TEXT,
ADD COLUMN IF NOT EXISTS production_split_4_percentage INTEGER,
ADD COLUMN IF NOT EXISTS production_split_5_wallet TEXT,
ADD COLUMN IF NOT EXISTS production_split_5_percentage INTEGER,
ADD COLUMN IF NOT EXISTS production_split_6_wallet TEXT,
ADD COLUMN IF NOT EXISTS production_split_6_percentage INTEGER,
ADD COLUMN IF NOT EXISTS production_split_7_wallet TEXT,
ADD COLUMN IF NOT EXISTS production_split_7_percentage INTEGER;

-- Add generation tracking
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS generation INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS parent_track_1_id UUID REFERENCES ip_tracks(id),
ADD COLUMN IF NOT EXISTS parent_track_2_id UUID REFERENCES ip_tracks(id);

-- Add comment for documentation
COMMENT ON COLUMN ip_tracks.generation IS 'Remix generation: 0 = original, 1 = first remix, 2 = remix of remix, etc.';
COMMENT ON COLUMN ip_tracks.parent_track_1_id IS 'First source loop used in this remix (if applicable)';
COMMENT ON COLUMN ip_tracks.parent_track_2_id IS 'Second source loop used in this remix (if applicable)';

-- ============================================================================
-- PART 2: Track Lineage Table (for discovery features)
-- ============================================================================

CREATE TABLE IF NOT EXISTS track_lineage (
    id BIGSERIAL PRIMARY KEY,
    track_id UUID NOT NULL REFERENCES ip_tracks(id) ON DELETE CASCADE,
    ancestor_track_id UUID NOT NULL REFERENCES ip_tracks(id) ON DELETE CASCADE,
    generation_distance INTEGER NOT NULL CHECK (generation_distance >= 0),
    contribution_weight DECIMAL(10,8) NOT NULL CHECK (contribution_weight > 0 AND contribution_weight <= 1),
    discovery_path UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Ensure we don't have duplicate lineage entries
    UNIQUE(track_id, ancestor_track_id)
);

-- Add indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_track_lineage_track_id ON track_lineage(track_id);
CREATE INDEX IF NOT EXISTS idx_track_lineage_ancestor ON track_lineage(ancestor_track_id);
CREATE INDEX IF NOT EXISTS idx_track_lineage_generation ON track_lineage(generation_distance);

-- Add comments
COMMENT ON TABLE track_lineage IS 'Tracks the full ancestry of remixes for discovery features';
COMMENT ON COLUMN track_lineage.track_id IS 'The remix track that has ancestors';
COMMENT ON COLUMN track_lineage.ancestor_track_id IS 'An ancestor (source) track in the lineage';
COMMENT ON COLUMN track_lineage.generation_distance IS 'How many generations removed (1 = direct parent, 2 = grandparent, etc.)';
COMMENT ON COLUMN track_lineage.contribution_weight IS 'Proportional contribution of this ancestor (0-1, sum to 1.0 for all ancestors)';
COMMENT ON COLUMN track_lineage.discovery_path IS 'Array of track IDs showing the path from this track to the ancestor';

-- ============================================================================
-- PART 3: Helper Views for Discovery
-- ============================================================================

-- View: All direct descendants of a track
CREATE OR REPLACE VIEW track_children AS
SELECT
    p1.id as parent_track_id,
    p1.title as parent_title,
    r.id as child_track_id,
    r.title as child_title,
    r.generation as child_generation,
    r.created_at as remixed_at
FROM ip_tracks p1
LEFT JOIN ip_tracks r ON (r.parent_track_1_id = p1.id OR r.parent_track_2_id = p1.id)
WHERE r.id IS NOT NULL
ORDER BY r.created_at DESC;

COMMENT ON VIEW track_children IS 'Shows all remixes that used a given track as a source';

-- View: All ancestors of a track
CREATE OR REPLACE VIEW track_ancestors AS
SELECT
    t.id as track_id,
    t.title as track_title,
    t.generation,
    l.ancestor_track_id,
    a.title as ancestor_title,
    a.generation as ancestor_generation,
    l.generation_distance,
    l.contribution_weight
FROM ip_tracks t
LEFT JOIN track_lineage l ON t.id = l.track_id
LEFT JOIN ip_tracks a ON l.ancestor_track_id = a.id
ORDER BY t.created_at DESC, l.generation_distance ASC;

COMMENT ON VIEW track_ancestors IS 'Shows the complete ancestry tree of a track';

-- View: Siblings (tracks that share parents)
CREATE OR REPLACE VIEW track_siblings AS
SELECT DISTINCT
    r1.id as track_id,
    r1.title as track_title,
    r1.created_at as track_created_at,
    r2.id as sibling_id,
    r2.title as sibling_title,
    CASE
        WHEN r1.parent_track_1_id = r2.parent_track_1_id AND r1.parent_track_2_id = r2.parent_track_2_id THEN 'full'
        ELSE 'half'
    END as sibling_type
FROM ip_tracks r1
JOIN ip_tracks r2 ON r1.id != r2.id
WHERE (
    r1.parent_track_1_id = r2.parent_track_1_id OR
    r1.parent_track_1_id = r2.parent_track_2_id OR
    r1.parent_track_2_id = r2.parent_track_1_id OR
    r1.parent_track_2_id = r2.parent_track_2_id
)
AND r1.parent_track_1_id IS NOT NULL
AND r2.parent_track_1_id IS NOT NULL
ORDER BY r1.created_at DESC;

COMMENT ON VIEW track_siblings IS 'Finds tracks that share one or both parent loops (remix siblings)';

-- ============================================================================
-- PART 4: Helper Function for Populating Lineage
-- ============================================================================

-- Function to automatically populate lineage when a remix is created
CREATE OR REPLACE FUNCTION populate_track_lineage()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if this is a remix (has parents)
    IF NEW.parent_track_1_id IS NOT NULL THEN
        -- Add direct parent 1 (50% contribution from each parent)
        INSERT INTO track_lineage (track_id, ancestor_track_id, generation_distance, contribution_weight, discovery_path)
        VALUES (NEW.id, NEW.parent_track_1_id, 1, 0.5, ARRAY[NEW.id, NEW.parent_track_1_id])
        ON CONFLICT (track_id, ancestor_track_id) DO NOTHING;

        -- Add all ancestors from parent 1 (at 50% contribution)
        INSERT INTO track_lineage (track_id, ancestor_track_id, generation_distance, contribution_weight, discovery_path)
        SELECT
            NEW.id,
            l.ancestor_track_id,
            l.generation_distance + 1,
            l.contribution_weight * 0.5,
            ARRAY[NEW.id] || l.discovery_path
        FROM track_lineage l
        WHERE l.track_id = NEW.parent_track_1_id
        ON CONFLICT (track_id, ancestor_track_id) DO NOTHING;
    END IF;

    IF NEW.parent_track_2_id IS NOT NULL THEN
        -- Add direct parent 2
        INSERT INTO track_lineage (track_id, ancestor_track_id, generation_distance, contribution_weight, discovery_path)
        VALUES (NEW.id, NEW.parent_track_2_id, 1, 0.5, ARRAY[NEW.id, NEW.parent_track_2_id])
        ON CONFLICT (track_id, ancestor_track_id) DO NOTHING;

        -- Add all ancestors from parent 2
        INSERT INTO track_lineage (track_id, ancestor_track_id, generation_distance, contribution_weight, discovery_path)
        SELECT
            NEW.id,
            l.ancestor_track_id,
            l.generation_distance + 1,
            l.contribution_weight * 0.5,
            ARRAY[NEW.id] || l.discovery_path
        FROM track_lineage l
        WHERE l.track_id = NEW.parent_track_2_id
        ON CONFLICT (track_id, ancestor_track_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate lineage
DROP TRIGGER IF EXISTS auto_populate_lineage ON ip_tracks;
CREATE TRIGGER auto_populate_lineage
    AFTER INSERT OR UPDATE OF parent_track_1_id, parent_track_2_id ON ip_tracks
    FOR EACH ROW
    EXECUTE FUNCTION populate_track_lineage();

COMMENT ON FUNCTION populate_track_lineage() IS 'Automatically builds the ancestry tree when a remix is created';

-- ============================================================================
-- PART 5: Data Integrity Checks
-- ============================================================================

-- Ensure percentage fields are valid (0-100)
ALTER TABLE ip_tracks
ADD CONSTRAINT check_composition_4_percentage CHECK (composition_split_4_percentage IS NULL OR (composition_split_4_percentage >= 0 AND composition_split_4_percentage <= 100)),
ADD CONSTRAINT check_composition_5_percentage CHECK (composition_split_5_percentage IS NULL OR (composition_split_5_percentage >= 0 AND composition_split_5_percentage <= 100)),
ADD CONSTRAINT check_composition_6_percentage CHECK (composition_split_6_percentage IS NULL OR (composition_split_6_percentage >= 0 AND composition_split_6_percentage <= 100)),
ADD CONSTRAINT check_composition_7_percentage CHECK (composition_split_7_percentage IS NULL OR (composition_split_7_percentage >= 0 AND composition_split_7_percentage <= 100)),
ADD CONSTRAINT check_production_4_percentage CHECK (production_split_4_percentage IS NULL OR (production_split_4_percentage >= 0 AND production_split_4_percentage <= 100)),
ADD CONSTRAINT check_production_5_percentage CHECK (production_split_5_percentage IS NULL OR (production_split_5_percentage >= 0 AND production_split_5_percentage <= 100)),
ADD CONSTRAINT check_production_6_percentage CHECK (production_split_6_percentage IS NULL OR (production_split_6_percentage >= 0 AND production_split_6_percentage <= 100)),
ADD CONSTRAINT check_production_7_percentage CHECK (production_split_7_percentage IS NULL OR (production_split_7_percentage >= 0 AND production_split_7_percentage <= 100));

-- Ensure generation is valid
ALTER TABLE ip_tracks
ADD CONSTRAINT check_generation CHECK (generation >= 0);

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Summary of changes:
-- ✅ Expanded composition splits from 3 to 7 (supports up to 7 unique composition contributors)
-- ✅ Expanded production splits from 3 to 7 (supports up to 7 unique production contributors)
-- ✅ Added generation tracking (0 = original, 1 = first remix, etc.)
-- ✅ Added parent track references for remix relationships
-- ✅ Created track_lineage table for full ancestry tracking
-- ✅ Added helper views for discovery (children, ancestors, siblings)
-- ✅ Added auto-population trigger for lineage tracking
-- ✅ Added data integrity constraints

-- Total capacity: 14 unique wallets per track (7 composition + 7 production)
-- This covers Gen 1 remixes: 1 remixer + 6 from loop A + 6 from loop B = 13 max
