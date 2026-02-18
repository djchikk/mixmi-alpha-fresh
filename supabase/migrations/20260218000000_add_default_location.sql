-- =============================================================================
-- Add default_location to agent_preferences
-- Tracks the creator's most commonly used location for smart defaults.
-- =============================================================================

ALTER TABLE agent_preferences
ADD COLUMN IF NOT EXISTS default_location TEXT;

COMMENT ON COLUMN agent_preferences.default_location IS 'Most commonly used upload location (e.g., "Tokyo, Japan"). Proposed as default for repeat uploaders.';
