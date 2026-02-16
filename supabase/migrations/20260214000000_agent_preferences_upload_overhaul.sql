-- =============================================================================
-- Agent Preferences & Upload Overhaul Migration
-- Date: February 14, 2026
--
-- Part of the combined upload & agent overhaul:
-- 1. Update persona limit from 3 to 80 (pilot community manager accounts)
-- 2. Add persona_id to upload_sessions (per-persona session tracking)
-- 3. Create agent_preferences table (system-learned business defaults)
-- 4. Backfill preferences for existing default personas
--
-- NOTE: agent_mission on personas table is USER-SET creative personality.
--       agent_preferences is SYSTEM-LEARNED business defaults.
--       These are intentionally separate — creative voice vs smart defaults.
-- =============================================================================


-- =============================================================================
-- 1. UPDATE PERSONA LIMIT: 3 → 80
-- Manager accounts for pilot communities need headroom
-- =============================================================================

CREATE OR REPLACE FUNCTION check_persona_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM personas WHERE account_id = NEW.account_id) >= 80 THEN
    RAISE EXCEPTION 'Maximum of 80 personas per account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists (enforce_persona_limit), function replacement is sufficient


-- =============================================================================
-- 2. ADD persona_id TO upload_sessions
-- Enables per-persona learning — sessions linked to specific persona, not just wallet
-- =============================================================================

ALTER TABLE upload_sessions
  ADD COLUMN IF NOT EXISTS persona_id UUID REFERENCES personas(id);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_persona
  ON upload_sessions(persona_id);

COMMENT ON COLUMN upload_sessions.persona_id IS 'Which persona uploaded this session — enables per-persona preference learning';


-- =============================================================================
-- 3. CREATE agent_preferences TABLE
-- System-learned business defaults, updated automatically after each upload.
-- Designed for extensibility: typed columns for core upload defaults,
-- JSONB extended_preferences for future capabilities (discovery, community, etc.)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES personas(id) UNIQUE NOT NULL,

  -- ===== Upload business defaults (system-learned) =====

  -- What they usually upload
  typical_content_type TEXT,

  -- Their usual BPM range (learned from upload history)
  -- Example: {"min": 90, "max": 130}
  typical_bpm_range JSONB DEFAULT '{}',

  -- Accumulated genre/mood tags from uploads (top N by frequency)
  -- Example: ["kikuyu", "percussion", "lo-fi", "chill"]
  default_tags JSONB DEFAULT '[]',

  -- Cultural/contextual tags (separate from genre for future community features)
  -- Example: ["east_african", "ceremonial", "diaspora"]
  default_cultural_tags JSONB DEFAULT '[]',

  -- Licensing defaults
  default_allow_remixing BOOLEAN DEFAULT true,
  default_allow_downloads BOOLEAN DEFAULT false,
  default_download_price_usdc DECIMAL(10,2),

  -- Remembered collaborator split templates
  -- Example: [{"name": "Sandy", "percentage": 50, "role": "composition"},
  --           {"name": "Julie", "percentage": 50, "role": "production"}]
  default_splits_template JSONB DEFAULT '[]',

  -- ===== Interaction patterns (system-learned) =====

  -- Language the creator consistently uses (Claude responds in this language)
  -- Updated by post-upload preference learner based on conversation language
  preferred_language TEXT DEFAULT 'en',

  -- Whether they prefer voice input (learned from input_mode frequency)
  prefers_voice_input BOOLEAN DEFAULT false,

  -- Whether they confirm defaults quickly (learned from conversation length)
  -- When true, agent batches more assumptions together
  prefers_minimal_questions BOOLEAN DEFAULT false,

  -- ===== Usage tracking =====
  upload_count INTEGER DEFAULT 0,

  -- ===== Extensible preferences (JSONB for future growth) =====
  -- Future additions without migrations:
  --   communication_language, discovery_interests,
  --   collaboration_preferences, community_affiliations,
  --   notification_preferences, content_curation_style
  extended_preferences JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update updated_at on changes
CREATE OR REPLACE FUNCTION update_agent_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_preferences_updated_at
  BEFORE UPDATE ON agent_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_preferences_timestamp();

-- Index for persona lookups
CREATE INDEX IF NOT EXISTS idx_agent_preferences_persona
  ON agent_preferences(persona_id);


-- =============================================================================
-- 4. AUTO-CREATE PREFERENCES FOR NEW PERSONAS
-- Only for primary (default) human personas — not AI agents, not managed
-- placeholders created during upload splits.
-- Non-default personas get preferences created lazily on first upload.
-- =============================================================================

CREATE OR REPLACE FUNCTION create_agent_preferences()
RETURNS TRIGGER AS $$
BEGIN
  -- Only auto-create for primary personas created at signup
  -- is_default = true: primary persona (created during signup or admin)
  -- is_agent = false: not an AI agent persona
  -- Managed/placeholder personas (is_default = false) get preferences
  -- created lazily when they first access the upload studio
  IF NEW.is_agent = false AND NEW.is_default = true THEN
    INSERT INTO agent_preferences (persona_id)
    VALUES (NEW.id)
    ON CONFLICT (persona_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_persona_created_preferences ON personas;

CREATE TRIGGER on_persona_created_preferences
  AFTER INSERT ON personas
  FOR EACH ROW
  EXECUTE FUNCTION create_agent_preferences();


-- =============================================================================
-- 5. BACKFILL: Create preferences for existing default personas
-- =============================================================================

INSERT INTO agent_preferences (persona_id)
SELECT id FROM personas
WHERE is_agent = false
  AND is_default = true
  AND id NOT IN (SELECT persona_id FROM agent_preferences)
ON CONFLICT (persona_id) DO NOTHING;


-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE agent_preferences IS 'System-learned business defaults per persona. Updated automatically after each upload. Separate from agent_mission (user-set creative personality on personas table).';
COMMENT ON COLUMN agent_preferences.typical_content_type IS 'Most commonly uploaded content type (loop, full_song, etc.)';
COMMENT ON COLUMN agent_preferences.typical_bpm_range IS 'Learned BPM range as JSON: {"min": 90, "max": 130}';
COMMENT ON COLUMN agent_preferences.default_tags IS 'Top genre/mood tags by frequency across uploads';
COMMENT ON COLUMN agent_preferences.default_cultural_tags IS 'Cultural/contextual tags separate from genre (for future community features)';
COMMENT ON COLUMN agent_preferences.default_splits_template IS 'Remembered collaborator patterns: [{name, percentage, role}]';
COMMENT ON COLUMN agent_preferences.preferred_language IS 'Language the creator consistently uses. Agent conducts conversations in this language.';
COMMENT ON COLUMN agent_preferences.prefers_minimal_questions IS 'When true, agent batches more assumptions together for faster uploads';
COMMENT ON COLUMN agent_preferences.extended_preferences IS 'JSONB for future preference types without schema migrations';
