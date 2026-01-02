-- Generate 10 new invite codes for zkLogin-only alpha users
-- Run this in Supabase SQL Editor

INSERT INTO alpha_users (invite_code, approved, notes, created_at)
VALUES
  -- Sandy's test account
  ('MIXMI-ZK01A7', true, 'sandy''s mixmi alpha zk login google alpha user email', NOW()),

  -- 9 codes for new alpha users
  ('MIXMI-ZK02B8', true, NULL, NOW()),
  ('MIXMI-ZK03C9', true, NULL, NOW()),
  ('MIXMI-ZK04D1', true, NULL, NOW()),
  ('MIXMI-ZK05E2', true, NULL, NOW()),
  ('MIXMI-ZK06F3', true, NULL, NOW()),
  ('MIXMI-ZK07G4', true, NULL, NOW()),
  ('MIXMI-ZK08H5', true, NULL, NOW()),
  ('MIXMI-ZK09J6', true, NULL, NOW()),
  ('MIXMI-ZK10K7', true, NULL, NOW());

-- Verify the codes were created
SELECT invite_code, approved, notes, created_at
FROM alpha_users
WHERE invite_code LIKE 'MIXMI-ZK%'
ORDER BY created_at DESC;
