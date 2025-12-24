-- Add soft delete functionality to ip_tracks table
-- This allows creators to remove items from their store without affecting buyers who already own them

-- Add deleted_at column to ip_tracks table
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create an index on deleted_at for faster queries
CREATE INDEX IF NOT EXISTS idx_ip_tracks_deleted_at ON ip_tracks(deleted_at);

-- Create a view for active (non-deleted) tracks
CREATE OR REPLACE VIEW ip_tracks_active AS
SELECT * FROM ip_tracks
WHERE deleted_at IS NULL;

-- Update RLS policies to handle soft deletes
-- Store queries should only show non-deleted tracks
-- But buyers' vaults should still show tracks they purchased, even if deleted by creator

-- Example function to soft delete a track (only by the owner)
CREATE OR REPLACE FUNCTION soft_delete_track(track_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ip_tracks
  SET deleted_at = NOW()
  WHERE id = track_id
    AND primary_uploader_wallet = auth.jwt() ->> 'sub'
    AND deleted_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example function to restore a deleted track (for future use)
CREATE OR REPLACE FUNCTION restore_deleted_track(track_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE ip_tracks
  SET deleted_at = NULL
  WHERE id = track_id
    AND primary_uploader_wallet = auth.jwt() ->> 'sub'
    AND deleted_at IS NOT NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION soft_delete_track TO authenticated;
GRANT EXECUTE ON FUNCTION restore_deleted_track TO authenticated;

-- Note: When implementing purchases table in the future:
-- Buyers should always see their purchased items regardless of deleted_at status
-- Example query for buyer's vault:
-- SELECT * FROM ip_tracks t
-- WHERE EXISTS (
--   SELECT 1 FROM purchases p 
--   WHERE p.track_id = t.id 
--   AND p.buyer_wallet = $wallet_address
-- )
-- This ignores deleted_at status for purchased items