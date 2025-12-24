-- Upload Sessions Table
-- Three-layer conversation logging for the Upload Studio chatbot
-- Created: 2025-12-16

-- Layer 1: Raw conversation transcripts
-- Layer 2: AI sense-making annotations (what was inferred, confidence levels)
-- Layer 3: Outcome signals (what happened - submitted, edited, abandoned)

CREATE TABLE IF NOT EXISTS upload_sessions (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session identification
  conversation_id TEXT NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- ============================================
  -- LAYER 1: Raw Conversation Transcript
  -- ============================================
  -- Array of message objects: { role, content, timestamp, attachments? }
  messages JSONB DEFAULT '[]'::jsonb,

  -- Files uploaded during the session (URLs + metadata)
  uploaded_files JSONB DEFAULT '[]'::jsonb,

  -- ============================================
  -- LAYER 2: AI Sense-Making Annotations
  -- ============================================
  -- What the AI extracted/inferred from the conversation
  -- This is the extractedData state from the chatbot
  inferred_data JSONB DEFAULT '{}'::jsonb,

  -- Confidence scores for inferred fields (0-1 scale)
  -- e.g., { "title": 0.95, "bpm": 0.8, "location": 0.7 }
  confidence_scores JSONB DEFAULT '{}'::jsonb,

  -- Flags/observations during the conversation
  -- e.g., { "user_seemed_unsure_about_splits": true, "ai_detected_sacred_content": true }
  flags JSONB DEFAULT '{}'::jsonb,

  -- Content type detected and when
  detected_content_type TEXT,
  content_type_changed BOOLEAN DEFAULT FALSE,

  -- Persona signals detected (professional, community, etc.)
  detected_persona TEXT,

  -- ============================================
  -- LAYER 3: Outcome Signals
  -- ============================================
  -- Final outcome: 'submitted', 'abandoned', 'error'
  outcome TEXT DEFAULT 'in_progress',

  -- If submitted, link to the created track(s)
  final_track_id UUID REFERENCES ip_tracks(id) ON DELETE SET NULL,
  final_pack_id UUID, -- For loop packs/EPs (also references ip_tracks but separately)

  -- User edits after AI inference (what they changed from what we inferred)
  -- e.g., { "title": { "inferred": "Untitled Loop", "final": "Summer Vibes" } }
  user_edits JSONB DEFAULT '{}'::jsonb,

  -- Was the "ready to submit" banner shown?
  reached_ready_state BOOLEAN DEFAULT FALSE,

  -- Time from first message to outcome
  session_duration_ms INTEGER,

  -- Number of back-and-forth exchanges
  message_count INTEGER DEFAULT 0,

  -- Error details if outcome is 'error'
  error_message TEXT,
  error_details JSONB,

  -- ============================================
  -- Analytics Helpers
  -- ============================================
  -- Quick access fields for common queries
  has_audio BOOLEAN DEFAULT FALSE,
  has_video BOOLEAN DEFAULT FALSE,
  has_cover_image BOOLEAN DEFAULT FALSE,
  file_count INTEGER DEFAULT 0,
  is_multi_file BOOLEAN DEFAULT FALSE -- Loop pack or EP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_upload_sessions_wallet ON upload_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_outcome ON upload_sessions(outcome);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON upload_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_content_type ON upload_sessions(detected_content_type);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_conversation_id ON upload_sessions(conversation_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_upload_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER upload_sessions_updated_at
  BEFORE UPDATE ON upload_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_upload_sessions_updated_at();

-- RLS (Row Level Security) - optional but recommended
-- ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
-- CREATE POLICY "Users can view own sessions"
--   ON upload_sessions
--   FOR SELECT
--   USING (wallet_address = current_setting('app.current_user_wallet', true));

-- Policy: Service role can do everything
-- CREATE POLICY "Service role has full access"
--   ON upload_sessions
--   FOR ALL
--   USING (true);

COMMENT ON TABLE upload_sessions IS 'Conversation logs from the Upload Studio chatbot for analysis and improvement';
COMMENT ON COLUMN upload_sessions.messages IS 'Layer 1: Raw conversation transcript as JSON array';
COMMENT ON COLUMN upload_sessions.inferred_data IS 'Layer 2: What the AI extracted/inferred from conversation';
COMMENT ON COLUMN upload_sessions.confidence_scores IS 'Layer 2: Confidence levels for each inferred field (0-1)';
COMMENT ON COLUMN upload_sessions.flags IS 'Layer 2: Observations/flags during conversation';
COMMENT ON COLUMN upload_sessions.outcome IS 'Layer 3: Final outcome - submitted, abandoned, error, in_progress';
COMMENT ON COLUMN upload_sessions.user_edits IS 'Layer 3: Changes user made from AI inferences';
