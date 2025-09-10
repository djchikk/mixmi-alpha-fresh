-- =================================================================
-- DEBUG CURRENT TRACKS - See what's actually showing in each store
-- =================================================================

-- DJ Chikk's store - show track titles and any collaborators
SELECT 
    title,
    artist,
    primary_uploader_wallet,
    'DJ Chikk Store' as store,
    -- Check if other wallets are in the splits (collaborators)
    CASE 
        WHEN composition_split_2_wallet IS NOT NULL AND composition_split_2_wallet != primary_uploader_wallet 
        THEN composition_split_2_wallet 
        ELSE 'No collaborator'
    END as collaborator_wallet_1,
    CASE 
        WHEN production_split_2_wallet IS NOT NULL AND production_split_2_wallet != primary_uploader_wallet 
        THEN production_split_2_wallet 
        ELSE 'No collaborator'
    END as collaborator_wallet_2
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE'
ORDER BY title
LIMIT 10;

-- Lunar Drive's store - show track titles and any collaborators  
SELECT 
    title,
    artist,
    primary_uploader_wallet,
    'Lunar Drive Store' as store,
    CASE 
        WHEN composition_split_2_wallet IS NOT NULL AND composition_split_2_wallet != primary_uploader_wallet 
        THEN composition_split_2_wallet 
        ELSE 'No collaborator'
    END as collaborator_wallet_1,
    CASE 
        WHEN production_split_2_wallet IS NOT NULL AND production_split_2_wallet != primary_uploader_wallet 
        THEN production_split_2_wallet 
        ELSE 'No collaborator'
    END as collaborator_wallet_2
FROM ip_tracks 
WHERE primary_uploader_wallet = 'SPZ02ESS4SMXVNZ9CXXQWGCTAWJ1APD6MAPWK9EQ'
ORDER BY title
LIMIT 10;

-- Check for any tracks with "Tootles and Soph" in the title or artist
SELECT 
    title,
    artist,
    primary_uploader_wallet,
    uploader_address,
    'Contains Tootles/Soph' as note
FROM ip_tracks 
WHERE title ILIKE '%tootles%' OR title ILIKE '%soph%' OR artist ILIKE '%tootles%' OR artist ILIKE '%soph%';

-- =================================================================
-- This will show us exactly what's in each store and why
-- ================================================================= 