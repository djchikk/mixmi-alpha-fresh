-- Add test wallets to alpha_users table
-- Uses ON CONFLICT to update if wallet already exists, insert if new
-- All wallets set to approved = true

INSERT INTO alpha_users (wallet_address, artist_name, approved, created_at, updated_at)
VALUES
  ('SP3YXETJCM777DYZMARH1T7P55X0Q58696BBXJ462', 'sandyhoover-account9', true, NOW(), NOW()),
  ('SP20GF14NEB1MJAEPWFCP1G2X02ARP8VH1R2QAJKA', 'mixmi.btc', true, NOW(), NOW()),
  ('SP3P08QBCVS8K93MDV8YVZ9H3009AC5B8TA67WG0N', 'sandyhoover.btc', true, NOW(), NOW()),
  ('SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ', 'lunardrive.btc', true, NOW(), NOW()),
  ('SP19CAXYZ89Q7DZWAGGTVPQZBGNVGGV9K7A9DH2E8', 'S_account4', true, NOW(), NOW()),
  ('SP37D6RYVV3KVT2CP41GQC62PBYGN42WHE88FAGYG', 's_h_.btc', true, NOW(), NOW())
ON CONFLICT (wallet_address)
DO UPDATE SET
  artist_name = EXCLUDED.artist_name,
  approved = EXCLUDED.approved,
  updated_at = NOW();

-- Verify the wallets were added
SELECT wallet_address, artist_name, approved, invite_code
FROM alpha_users
WHERE wallet_address IN (
  'SP3YXETJCM777DYZMARH1T7P55X0Q58696BBXJ462',
  'SP20GF14NEB1MJAEPWFCP1G2X02ARP8VH1R2QAJKA',
  'SP3P08QBCVS8K93MDV8YVZ9H3009AC5B8TA67WG0N',
  'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ',
  'SP19CAXYZ89Q7DZWAGGTVPQZBGNVGGV9K7A9DH2E8',
  'SP37D6RYVV3KVT2CP41GQC62PBYGN42WHE88FAGYG'
)
ORDER BY artist_name;
