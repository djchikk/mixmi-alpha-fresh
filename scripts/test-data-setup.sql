-- Test Data Setup for Complex Remix Split Scenarios
-- This script creates test loops with various edge cases to validate remix split calculations
-- IMPORTANT: These are test records - delete them after testing!

-- Test wallets for easy identification
-- Alice, Amy, Andy, Bob, Betty, Ben, Charlie (remixer)

-- =============================================================================
-- SCENARIO 1: Simple case (baseline)
-- Loop A: Alice 100% comp, Amy 100% prod
-- Loop B: Bob 100% comp, Betty 100% prod
-- Expected remix: Alice 50%, Bob 50% comp | Amy 50%, Betty 50% prod
-- =============================================================================

INSERT INTO ip_tracks (
  id, title, artist, content_type, generation, remix_depth,
  primary_uploader_wallet,
  composition_split_1_wallet, composition_split_1_percentage,
  production_split_1_wallet, production_split_1_percentage,
  audio_url, created_at
) VALUES (
  'test-loop-a-simple',
  'Test Loop A - Simple',
  'Alice',
  'loop',
  0,
  0,
  'SP1ALICE111111111111111111111',
  'SP1ALICE111111111111111111111', 100,
  'SP1AMY222222222222222222222', 100,
  'https://example.com/test-a.mp3',
  NOW()
);

INSERT INTO ip_tracks (
  id, title, artist, content_type, generation, remix_depth,
  primary_uploader_wallet,
  composition_split_1_wallet, composition_split_1_percentage,
  production_split_1_wallet, production_split_1_percentage,
  audio_url, created_at
) VALUES (
  'test-loop-b-simple',
  'Test Loop B - Simple',
  'Bob',
  'loop',
  0,
  0,
  'SP1BOB333333333333333333333',
  'SP1BOB333333333333333333333', 100,
  'SP1BETTY44444444444444444', 100,
  'https://example.com/test-b.mp3',
  NOW()
);

-- =============================================================================
-- SCENARIO 2: Multiple contributors per loop
-- Loop C: 3 composers (33%, 33%, 34%) and 2 producers (50%, 50%)
-- Loop D: 2 composers (60%, 40%) and 3 producers (33%, 33%, 34%)
-- Expected: Should handle multiple splits and maintain 100% total after scaling
-- =============================================================================

INSERT INTO ip_tracks (
  id, title, artist, content_type, generation, remix_depth,
  primary_uploader_wallet,
  composition_split_1_wallet, composition_split_1_percentage,
  composition_split_2_wallet, composition_split_2_percentage,
  composition_split_3_wallet, composition_split_3_percentage,
  production_split_1_wallet, production_split_1_percentage,
  production_split_2_wallet, production_split_2_percentage,
  audio_url, created_at
) VALUES (
  'test-loop-c-multi',
  'Test Loop C - Multi Contributors',
  'Alice & Friends',
  'loop',
  0,
  0,
  'SP1ALICE111111111111111111111',
  'SP1ALICE111111111111111111111', 33,
  'SP1BOB333333333333333333333', 33,
  'SP1CHARLIE5555555555555555', 34,
  'SP1AMY222222222222222222222', 50,
  'SP1BETTY44444444444444444', 50,
  'https://example.com/test-c.mp3',
  NOW()
);

INSERT INTO ip_tracks (
  id, title, artist, content_type, generation, remix_depth,
  primary_uploader_wallet,
  composition_split_1_wallet, composition_split_1_percentage,
  composition_split_2_wallet, composition_split_2_percentage,
  production_split_1_wallet, production_split_1_percentage,
  production_split_2_wallet, production_split_2_percentage,
  production_split_3_wallet, production_split_3_percentage,
  audio_url, created_at
) VALUES (
  'test-loop-d-multi',
  'Test Loop D - Multi Contributors',
  'Betty & Friends',
  'loop',
  0,
  0,
  'SP1BETTY44444444444444444',
  'SP1BETTY44444444444444444', 60,
  'SP1AMY222222222222222222222', 40,
  'SP1ALICE111111111111111111111', 33,
  'SP1BOB333333333333333333333', 33,
  'SP1ANDY666666666666666666', 34,
  'https://example.com/test-d.mp3',
  NOW()
);

-- =============================================================================
-- SCENARIO 3: Same person in multiple roles
-- Loop E: Alice is 100% comp AND 100% prod (composer/producer)
-- Loop F: Bob 50% comp, Betty 50% comp, Bob 100% prod (Bob in both)
-- Expected: Consolidation should merge duplicate wallets
-- =============================================================================

INSERT INTO ip_tracks (
  id, title, artist, content_type, generation, remix_depth,
  primary_uploader_wallet,
  composition_split_1_wallet, composition_split_1_percentage,
  production_split_1_wallet, production_split_1_percentage,
  audio_url, created_at
) VALUES (
  'test-loop-e-same-person',
  'Test Loop E - Same Person Both Roles',
  'Alice',
  'loop',
  0,
  0,
  'SP1ALICE111111111111111111111',
  'SP1ALICE111111111111111111111', 100,
  'SP1ALICE111111111111111111111', 100,
  'https://example.com/test-e.mp3',
  NOW()
);

INSERT INTO ip_tracks (
  id, title, artist, content_type, generation, remix_depth,
  primary_uploader_wallet,
  composition_split_1_wallet, composition_split_1_percentage,
  composition_split_2_wallet, composition_split_2_percentage,
  production_split_1_wallet, production_split_1_percentage,
  audio_url, created_at
) VALUES (
  'test-loop-f-overlap',
  'Test Loop F - Overlapping Contributors',
  'Bob & Betty',
  'loop',
  0,
  0,
  'SP1BOB333333333333333333333',
  'SP1BOB333333333333333333333', 50,
  'SP1BETTY44444444444444444', 50,
  'SP1BOB333333333333333333333', 100,
  'https://example.com/test-f.mp3',
  NOW()
);

-- =============================================================================
-- SCENARIO 4: Uneven splits (rounding edge case)
-- Loop G: 3 composers with 33.33% each (tests rounding)
-- Loop H: 2 composers with 51%, 49%
-- Expected: Should adjust rounding to maintain exactly 100%
-- =============================================================================

INSERT INTO ip_tracks (
  id, title, artist, content_type, generation, remix_depth,
  primary_uploader_wallet,
  composition_split_1_wallet, composition_split_1_percentage,
  composition_split_2_wallet, composition_split_2_percentage,
  composition_split_3_wallet, composition_split_3_percentage,
  production_split_1_wallet, production_split_1_percentage,
  audio_url, created_at
) VALUES (
  'test-loop-g-rounding',
  'Test Loop G - Rounding Test',
  'The Thirds',
  'loop',
  0,
  0,
  'SP1ALICE111111111111111111111',
  'SP1ALICE111111111111111111111', 33,
  'SP1BOB333333333333333333333', 33,
  'SP1CHARLIE5555555555555555', 34,
  'SP1AMY222222222222222222222', 100,
  'https://example.com/test-g.mp3',
  NOW()
);

INSERT INTO ip_tracks (
  id, title, artist, content_type, generation, remix_depth,
  primary_uploader_wallet,
  composition_split_1_wallet, composition_split_1_percentage,
  composition_split_2_wallet, composition_split_2_percentage,
  production_split_1_wallet, production_split_1_percentage,
  audio_url, created_at
) VALUES (
  'test-loop-h-uneven',
  'Test Loop H - Uneven Split',
  'The Unevens',
  'loop',
  0,
  0,
  'SP1BETTY44444444444444444',
  'SP1BETTY44444444444444444', 51,
  'SP1AMY222222222222222222222', 49,
  'SP1BOB333333333333333333333', 100,
  'https://example.com/test-h.mp3',
  NOW()
);

-- Success message
SELECT '✅ Test data inserted successfully!' as status,
       COUNT(*) as total_test_loops
FROM ip_tracks
WHERE id LIKE 'test-loop-%';
