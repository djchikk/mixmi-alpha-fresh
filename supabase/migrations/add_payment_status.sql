-- Add payment_status field to track transaction confirmation
-- This allows us to clean up remixes where payment failed

ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'failed'));

-- Add index for efficient queries of pending payments
CREATE INDEX IF NOT EXISTS idx_ip_tracks_payment_status ON ip_tracks(payment_status);

-- Add timestamp for when we last checked the payment status
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS payment_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN ip_tracks.payment_status IS 'Tracks the status of the blockchain transaction: pending (just submitted), confirmed (verified on-chain), failed (rejected by blockchain)';
COMMENT ON COLUMN ip_tracks.payment_checked_at IS 'Last time we verified the transaction status on-chain';
