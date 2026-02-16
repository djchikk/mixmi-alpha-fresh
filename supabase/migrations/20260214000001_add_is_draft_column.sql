-- Add is_draft column to ip_tracks
-- This column has been referenced in code (MicWidget drafts, account page filtering)
-- but was never formally added to the database.

ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT FALSE;

-- Index for efficient draft queries (account page filters by is_draft)
CREATE INDEX IF NOT EXISTS idx_ip_tracks_is_draft
  ON ip_tracks (is_draft)
  WHERE is_draft = TRUE;

-- Composite index for per-user draft lookups
CREATE INDEX IF NOT EXISTS idx_ip_tracks_draft_by_wallet
  ON ip_tracks (primary_uploader_wallet, is_draft)
  WHERE is_draft = TRUE;
