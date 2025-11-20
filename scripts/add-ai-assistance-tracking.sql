-- =================================================================
-- Add AI Assistance Tracking to IP Tracks
-- =================================================================
-- Tracks AI involvement at two levels:
-- 1. Idea/Concept phase (composition, direction, concept)
-- 2. Implementation phase (production, editing, filming)
-- =================================================================

-- Add columns for AI assistance tracking
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS ai_assisted_idea BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_assisted_implementation BOOLEAN DEFAULT false;

-- Add helpful comment
COMMENT ON COLUMN ip_tracks.ai_assisted_idea IS 'True if AI was used in concept, direction, or creative ideas';
COMMENT ON COLUMN ip_tracks.ai_assisted_implementation IS 'True if AI was used in production, editing, or technical implementation';

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'ip_tracks'
AND column_name IN ('ai_assisted_idea', 'ai_assisted_implementation');

-- =================================================================
-- Display logic for frontend:
-- - Neither: "🙌 100% Human"
-- - Idea only: "🤖 AI-Assisted (Concept)"
-- - Implementation only: "🤖 AI-Assisted (Production)"
-- - Both: "🤖 AI-Assisted (Concept & Production)"
-- =================================================================
