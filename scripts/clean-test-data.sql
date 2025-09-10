-- =================================================================
-- CLEAN TEST DATA: Remove tracks with placeholder audio URLs
-- =================================================================
-- This script removes tracks that have placeholder [UPLOADED] URLs
-- so we can start fresh with real audio files
-- =================================================================

-- Show current placeholder tracks before deletion
SELECT 
    'BEFORE CLEANUP' as status,
    COUNT(*) as total_tracks,
    COUNT(CASE WHEN audio_url LIKE '[UPLOADED]%' THEN 1 END) as placeholder_tracks,
    COUNT(CASE WHEN audio_url NOT LIKE '[UPLOADED]%' AND audio_url IS NOT NULL THEN 1 END) as real_audio_tracks
FROM ip_tracks;

-- Delete tracks with placeholder audio URLs
DELETE FROM ip_tracks 
WHERE audio_url LIKE '[UPLOADED]%';

-- Show results after cleanup
SELECT 
    'AFTER CLEANUP' as status,
    COUNT(*) as total_tracks,
    COUNT(CASE WHEN audio_url LIKE '[UPLOADED]%' THEN 1 END) as placeholder_tracks,
    COUNT(CASE WHEN audio_url NOT LIKE '[UPLOADED]%' AND audio_url IS NOT NULL THEN 1 END) as real_audio_tracks
FROM ip_tracks;

-- =================================================================
-- 🎉 DATABASE CLEANED! 
-- =================================================================
-- Now you can upload fresh tracks with real audio files that will:
-- 1. ✅ Actually play audio in the store
-- 2. ✅ Have real Supabase Storage URLs
-- 3. ✅ Work perfectly with the mixer
-- 4. ✅ Provide the foundation for professional testing
-- ================================================================= 