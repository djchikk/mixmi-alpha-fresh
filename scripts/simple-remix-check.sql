-- Simple check of latest remix
-- Expected: Remixer should NOT appear in composition/production splits
-- Expected: Each loop contributes 50% to each pie
-- Expected: Both comp_total and prod_total should equal 100

SELECT
    title,
    primary_uploader_wallet as remixer_wallet,
    generation,

    -- Composition splits
    composition_split_1_wallet as comp_1_wallet,
    composition_split_1_percentage as comp_1_pct,
    composition_split_2_wallet as comp_2_wallet,
    composition_split_2_percentage as comp_2_pct,
    composition_split_3_wallet as comp_3_wallet,
    composition_split_3_percentage as comp_3_pct,
    composition_split_4_wallet as comp_4_wallet,
    composition_split_4_percentage as comp_4_pct,

    -- Production splits
    production_split_1_wallet as prod_1_wallet,
    production_split_1_percentage as prod_1_pct,
    production_split_2_wallet as prod_2_wallet,
    production_split_2_percentage as prod_2_pct,
    production_split_3_wallet as prod_3_wallet,
    production_split_3_percentage as prod_3_pct,
    production_split_4_wallet as prod_4_wallet,
    production_split_4_percentage as prod_4_pct,

    -- Totals (should both be 100)
    (COALESCE(composition_split_1_percentage, 0) +
     COALESCE(composition_split_2_percentage, 0) +
     COALESCE(composition_split_3_percentage, 0) +
     COALESCE(composition_split_4_percentage, 0) +
     COALESCE(composition_split_5_percentage, 0) +
     COALESCE(composition_split_6_percentage, 0) +
     COALESCE(composition_split_7_percentage, 0)) as comp_total,

    (COALESCE(production_split_1_percentage, 0) +
     COALESCE(production_split_2_percentage, 0) +
     COALESCE(production_split_3_percentage, 0) +
     COALESCE(production_split_4_percentage, 0) +
     COALESCE(production_split_5_percentage, 0) +
     COALESCE(production_split_6_percentage, 0) +
     COALESCE(production_split_7_percentage, 0)) as prod_total,

    -- Check if remixer appears in any split (should be FALSE)
    (primary_uploader_wallet = composition_split_1_wallet OR
     primary_uploader_wallet = composition_split_2_wallet OR
     primary_uploader_wallet = composition_split_3_wallet OR
     primary_uploader_wallet = composition_split_4_wallet OR
     primary_uploader_wallet = production_split_1_wallet OR
     primary_uploader_wallet = production_split_2_wallet OR
     primary_uploader_wallet = production_split_3_wallet OR
     primary_uploader_wallet = production_split_4_wallet) as remixer_in_ip_splits

FROM ip_tracks
WHERE generation = 1  -- Only Gen 1 remixes
ORDER BY created_at DESC
LIMIT 1;
