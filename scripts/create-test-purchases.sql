-- Create a purchases table for testing buyer functionality
-- This simulates what would happen when users buy tracks

-- Create purchases table if it doesn't exist
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id UUID REFERENCES ip_tracks(id),
  buyer_wallet TEXT NOT NULL,
  seller_wallet TEXT NOT NULL,
  purchase_price DECIMAL,
  purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Create policy for buyers to see their purchases
CREATE POLICY "Buyers can view own purchases" ON purchases
FOR SELECT
USING (buyer_wallet = auth.jwt() ->> 'sub' OR true); -- 'OR true' for testing

-- Insert some test purchases (simulate buyers who bought tracks)
-- Replace track IDs with actual IDs from your database
INSERT INTO purchases (track_id, buyer_wallet, seller_wallet, purchase_price)
VALUES 
  -- Test Buyer 1 purchases
  ('YOUR_TRACK_ID_1', 'SP1TEST1BUYER1WALLET1ADDRESS1EXAMPLE111', 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 2.5),
  ('YOUR_TRACK_ID_2', 'SP1TEST1BUYER1WALLET1ADDRESS1EXAMPLE111', 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 2.5),
  
  -- Test Buyer 2 purchases
  ('YOUR_TRACK_ID_3', 'SP2TEST2BUYER2WALLET2ADDRESS2EXAMPLE222', 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 1.5);

-- Query to test: Show all tracks for a buyer, including deleted ones
-- This is what the vault should use for buyers
SELECT DISTINCT t.*
FROM ip_tracks t
LEFT JOIN purchases p ON t.id = p.track_id
WHERE 
  -- Show tracks they created
  (t.primary_uploader_wallet = 'BUYER_WALLET_HERE')
  OR 
  -- Show tracks they purchased (even if deleted)
  (p.buyer_wallet = 'BUYER_WALLET_HERE')
ORDER BY COALESCE(t.deleted_at, t.created_at) DESC;