-- TBD Claim Tokens
-- Allows managers to generate invite links for TBD collaborators to claim their earnings

CREATE TABLE IF NOT EXISTS tbd_claim_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The unique claim token (short, URL-safe)
  token text UNIQUE NOT NULL,

  -- Which TBD persona this is for
  tbd_persona_id uuid REFERENCES personas(id) ON DELETE CASCADE NOT NULL,

  -- Who created this invite
  created_by_account_id uuid REFERENCES accounts(id) NOT NULL,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '90 days'),

  -- Claim tracking
  claimed_at timestamptz,
  claimed_by_persona_id uuid REFERENCES personas(id),

  -- Optional notes (who is this for?)
  recipient_name text,
  recipient_contact text -- email, phone, etc for reference
);

-- Index for token lookups
CREATE INDEX IF NOT EXISTS idx_tbd_claim_tokens_token ON tbd_claim_tokens(token);

-- Index for finding tokens by TBD persona
CREATE INDEX IF NOT EXISTS idx_tbd_claim_tokens_tbd_persona ON tbd_claim_tokens(tbd_persona_id);

-- RLS policies
ALTER TABLE tbd_claim_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can read token info (needed for claim page)
CREATE POLICY "Anyone can read claim tokens" ON tbd_claim_tokens
  FOR SELECT USING (true);

-- Only the creator's account can insert/update
CREATE POLICY "Account owners can manage their claim tokens" ON tbd_claim_tokens
  FOR ALL USING (
    created_by_account_id IN (
      SELECT id FROM accounts WHERE sui_address = auth.uid()::text
    )
  );

COMMENT ON TABLE tbd_claim_tokens IS 'Invite tokens for TBD collaborators to claim their earnings';
COMMENT ON COLUMN tbd_claim_tokens.token IS 'Short URL-safe token for the claim link';
COMMENT ON COLUMN tbd_claim_tokens.recipient_name IS 'Human-readable name of intended recipient';
COMMENT ON COLUMN tbd_claim_tokens.recipient_contact IS 'Optional contact info for the recipient';
