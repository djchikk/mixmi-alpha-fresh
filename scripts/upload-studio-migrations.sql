-- =====================================================
-- Upload Studio Database Migrations
-- Run these in Supabase SQL Editor
-- =====================================================

-- 1. Add upload_source column to ip_tracks
-- Tracks where the upload came from ('modal', 'conversational', 'api')
-- =====================================================

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS upload_source TEXT DEFAULT 'modal';

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS conversation_id TEXT;

COMMENT ON COLUMN ip_tracks.upload_source IS 'Source of the upload: modal, conversational, api';
COMMENT ON COLUMN ip_tracks.conversation_id IS 'Conversation ID if uploaded via conversational UI';


-- 2. Create pending_collaborators table
-- For collaborators named but without wallet addresses
-- =====================================================

CREATE TABLE IF NOT EXISTS pending_collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to track
  track_id UUID NOT NULL REFERENCES ip_tracks(id) ON DELETE CASCADE,

  -- Collaborator info
  collaborator_name TEXT NOT NULL,
  collaborator_email TEXT,

  -- Split details
  split_percentage DECIMAL(5,2) NOT NULL CHECK (split_percentage > 0 AND split_percentage <= 100),
  split_type TEXT NOT NULL CHECK (split_type IN ('composition', 'production')),
  split_position INTEGER NOT NULL DEFAULT 1 CHECK (split_position BETWEEN 1 AND 3),

  -- Resolution status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'claimed', 'rejected', 'expired')),
  resolved_wallet TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Notification tracking
  invite_code TEXT UNIQUE,
  invite_sent_at TIMESTAMP WITH TIME ZONE,
  invite_expires_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pending_collaborators_track_id ON pending_collaborators(track_id);
CREATE INDEX IF NOT EXISTS idx_pending_collaborators_status ON pending_collaborators(status);
CREATE INDEX IF NOT EXISTS idx_pending_collaborators_invite_code ON pending_collaborators(invite_code);
CREATE INDEX IF NOT EXISTS idx_pending_collaborators_email ON pending_collaborators(collaborator_email);

-- RLS policies
ALTER TABLE pending_collaborators ENABLE ROW LEVEL SECURITY;

-- Track owners can see their pending collaborators
CREATE POLICY "Track owners can view pending collaborators"
  ON pending_collaborators
  FOR SELECT
  USING (
    track_id IN (
      SELECT id FROM ip_tracks WHERE uploader_address = auth.jwt()->>'wallet_address'
    )
  );

-- Track owners can insert pending collaborators
CREATE POLICY "Track owners can insert pending collaborators"
  ON pending_collaborators
  FOR INSERT
  WITH CHECK (
    track_id IN (
      SELECT id FROM ip_tracks WHERE uploader_address = auth.jwt()->>'wallet_address'
    )
  );

-- Service role bypass for API operations
CREATE POLICY "Service role full access"
  ON pending_collaborators
  FOR ALL
  USING (auth.role() = 'service_role');


-- 3. Create conversation_logs table (optional, for debugging)
-- =====================================================

CREATE TABLE IF NOT EXISTS conversation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,

  -- Conversation content
  messages JSONB DEFAULT '[]'::jsonb,
  extracted_data JSONB DEFAULT '{}'::jsonb,

  -- Result
  track_id UUID REFERENCES ip_tracks(id),
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_conversation_logs_conversation_id ON conversation_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_wallet ON conversation_logs(wallet_address);
CREATE INDEX IF NOT EXISTS idx_conversation_logs_status ON conversation_logs(status);


-- 4. Helper function to claim pending collaborator spot
-- =====================================================

CREATE OR REPLACE FUNCTION claim_pending_collaborator(
  p_invite_code TEXT,
  p_wallet_address TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  track_id UUID,
  split_type TEXT,
  split_percentage DECIMAL,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pending pending_collaborators%ROWTYPE;
  v_track ip_tracks%ROWTYPE;
BEGIN
  -- Find the pending collaborator
  SELECT * INTO v_pending
  FROM pending_collaborators
  WHERE invite_code = p_invite_code
    AND status = 'pending'
    AND (invite_expires_at IS NULL OR invite_expires_at > NOW());

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'Invalid or expired invite code'::TEXT;
    RETURN;
  END IF;

  -- Get the track
  SELECT * INTO v_track FROM ip_tracks WHERE id = v_pending.track_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'Track not found'::TEXT;
    RETURN;
  END IF;

  -- Update the track with the new wallet
  IF v_pending.split_type = 'composition' THEN
    IF v_pending.split_position = 2 THEN
      UPDATE ip_tracks SET composition_split_2_wallet = p_wallet_address, updated_at = NOW()
      WHERE id = v_pending.track_id;
    ELSIF v_pending.split_position = 3 THEN
      UPDATE ip_tracks SET composition_split_3_wallet = p_wallet_address, updated_at = NOW()
      WHERE id = v_pending.track_id;
    END IF;
  ELSE -- production
    IF v_pending.split_position = 2 THEN
      UPDATE ip_tracks SET production_split_2_wallet = p_wallet_address, updated_at = NOW()
      WHERE id = v_pending.track_id;
    ELSIF v_pending.split_position = 3 THEN
      UPDATE ip_tracks SET production_split_3_wallet = p_wallet_address, updated_at = NOW()
      WHERE id = v_pending.track_id;
    END IF;
  END IF;

  -- Mark as claimed
  UPDATE pending_collaborators
  SET
    status = 'claimed',
    resolved_wallet = p_wallet_address,
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE id = v_pending.id;

  RETURN QUERY SELECT
    true,
    v_pending.track_id,
    v_pending.split_type,
    v_pending.split_percentage,
    NULL::TEXT;
END;
$$;


-- 5. Summary
-- =====================================================
-- Run this query to verify the changes:

-- SELECT
--   column_name,
--   data_type,
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'ip_tracks'
--   AND column_name IN ('upload_source', 'conversation_id');

-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_name IN ('pending_collaborators', 'conversation_logs');
