-- Upload Session Events Table
-- Append-only event log for conversation analysis
-- Created: 2025-12-16

-- ============================================
-- EVENTS TABLE (append-only)
-- ============================================
CREATE TABLE IF NOT EXISTS upload_session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES upload_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ordering within session
  event_index INT NOT NULL,

  -- Event classification
  event_type TEXT NOT NULL,
  -- Types: 'user_message', 'assistant_message', 'file_upload', 'extraction',
  --        'nudge', 'edit', 'state_change', 'sensitivity_signal', 'error'

  -- Message-specific fields
  role TEXT,  -- 'user', 'assistant', 'system'
  content TEXT,

  -- Flexible payload for event-specific data
  -- For messages: { attachments: [...] }
  -- For extractions: { field: 'bpm', value: 120, confidence: 0.9 }
  -- For nudges: { nudge_type: 'equal_splits', shown: true, accepted: false }
  -- For edits: { field: 'title', from: 'Untitled', to: 'My Song' }
  -- For sensitivity_signal: { keywords: ['sacred', 'ceremony'], context: '...' }
  payload JSONB DEFAULT '{}'::jsonb,

  -- Ensure ordering
  UNIQUE(session_id, event_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_session ON upload_session_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON upload_session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_session_index ON upload_session_events(session_id, event_index);

-- ============================================
-- ADD VERSION TRACKING TO SESSIONS
-- ============================================
ALTER TABLE upload_sessions
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS model_name TEXT;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE upload_session_events IS 'Append-only event log for upload conversations - enables replay and analysis';
COMMENT ON COLUMN upload_session_events.event_type IS 'Event type: user_message, assistant_message, file_upload, extraction, nudge, edit, state_change, sensitivity_signal, error';
COMMENT ON COLUMN upload_session_events.payload IS 'Event-specific data as JSON';
COMMENT ON COLUMN upload_sessions.prompt_version IS 'Version of the system prompt used for this session';
COMMENT ON COLUMN upload_sessions.model_name IS 'AI model used (e.g., claude-3-5-sonnet)';
