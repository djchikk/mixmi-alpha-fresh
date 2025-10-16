-- Clean up test data
-- Run this after testing is complete to remove all test records

-- Delete all test loops
DELETE FROM ip_tracks
WHERE id LIKE 'test-loop-%';

-- Delete any test remixes that might have been created
DELETE FROM ip_tracks
WHERE parent_track_1_id LIKE 'test-loop-%'
   OR parent_track_2_id LIKE 'test-loop-%';

-- Verify cleanup
SELECT '✅ Test data cleaned up!' as status,
       COUNT(*) as remaining_test_records
FROM ip_tracks
WHERE id LIKE 'test-loop-%'
   OR parent_track_1_id LIKE 'test-loop-%'
   OR parent_track_2_id LIKE 'test-loop-%';
