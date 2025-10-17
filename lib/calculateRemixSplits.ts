/**
 * Calculate Remix IP Splits for Generation 1 Remixes
 *
 * BUSINESS MODEL:
 * - Remixer is NOT an IP holder - they get 20% commission on sales (handled at payment time)
 * - IP ownership belongs 100% to the original contributors from Loop A and Loop B
 * - Each source loop contributes 50% to the remix's composition pie and 50% to the production pie
 *
 * COPYRIGHT MODEL:
 * - Each track has TWO separate 100% pies:
 *   - Composition rights: 100% (split among composers)
 *   - Sound recording rights: 100% (split among producers)
 * - Total ownership of track = (comp% + recording%) / 2
 *
 * Example:
 * Loop A: Alice (100% comp), Amy (100% prod)
 * Loop B: Bob (100% comp), Betty (100% prod)
 *
 * Remix IP Splits:
 * - Composition: Alice 50%, Bob 50% (total 100%)
 * - Production: Amy 50%, Betty 50% (total 100%)
 * - Remixer: NOT in these splits - gets 20% commission at payment time
 *
 * Payment Example (2 STX sale):
 * - Remixer commission: 2 × 20% = 0.4 STX
 * - Remaining for IP holders: 2 × 80% = 1.6 STX
 *   - Alice: 25% × 1.6 = 0.4 STX (50% comp of 50% total)
 *   - Amy: 25% × 1.6 = 0.4 STX (50% prod of 50% total)
 *   - Bob: 25% × 1.6 = 0.4 STX (50% comp of 50% total)
 *   - Betty: 25% × 1.6 = 0.4 STX (50% prod of 50% total)
 */

interface TrackSplit {
  wallet: string;
  percentage: number;
}

interface SourceTrack {
  // Composition splits (up to 3 contributors per loop)
  composition_split_1_wallet?: string | null;
  composition_split_1_percentage?: number | null;
  composition_split_2_wallet?: string | null;
  composition_split_2_percentage?: number | null;
  composition_split_3_wallet?: string | null;
  composition_split_3_percentage?: number | null;

  // Production splits (up to 3 contributors per loop)
  production_split_1_wallet?: string | null;
  production_split_1_percentage?: number | null;
  production_split_2_wallet?: string | null;
  production_split_2_percentage?: number | null;
  production_split_3_wallet?: string | null;
  production_split_3_percentage?: number | null;
}

interface RemixSplits {
  composition: TrackSplit[];
  production: TrackSplit[];
  totalComposition: number; // Should be 100
  totalProduction: number;  // Should be 100
}

/**
 * Calculate remix IP splits from two source loops
 *
 * IMPORTANT: The remixer is NOT included in the returned splits.
 * They get their 20% commission at payment time, not as an IP holder.
 *
 * Returns splits that sum to 100% for both composition and production,
 * with each source loop contributing 50% to each pie.
 */
export function calculateRemixSplits(
  loop1: SourceTrack,
  loop2: SourceTrack,
  remixerWallet: string // Not used in IP splits, but kept for future payment logic
): RemixSplits {
  console.log('🎵 Calculating Gen 1 remix splits...');
  console.log('📊 Loop 1:', {
    comp1: loop1.composition_split_1_wallet,
    comp2: loop1.composition_split_2_wallet,
    comp3: loop1.composition_split_3_wallet,
    prod1: loop1.production_split_1_wallet,
    prod2: loop1.production_split_2_wallet,
    prod3: loop1.production_split_3_wallet,
  });
  console.log('📊 Loop 2:', {
    comp1: loop2.composition_split_1_wallet,
    comp2: loop2.composition_split_2_wallet,
    comp3: loop2.composition_split_3_wallet,
    prod1: loop2.production_split_1_wallet,
    prod2: loop2.production_split_2_wallet,
    prod3: loop2.production_split_3_wallet,
  });

  // Each loop contributes 50% to the remix
  const LOOP_CONTRIBUTION = 0.5;

  // Step 1: Extract composition splits from Loop 1
  const loop1Composition: TrackSplit[] = [];
  if (loop1.composition_split_1_wallet && loop1.composition_split_1_percentage) {
    loop1Composition.push({
      wallet: loop1.composition_split_1_wallet,
      percentage: loop1.composition_split_1_percentage
    });
  }
  if (loop1.composition_split_2_wallet && loop1.composition_split_2_percentage) {
    loop1Composition.push({
      wallet: loop1.composition_split_2_wallet,
      percentage: loop1.composition_split_2_percentage
    });
  }
  if (loop1.composition_split_3_wallet && loop1.composition_split_3_percentage) {
    loop1Composition.push({
      wallet: loop1.composition_split_3_wallet,
      percentage: loop1.composition_split_3_percentage
    });
  }

  // Step 2: Extract production splits from Loop 1
  const loop1Production: TrackSplit[] = [];
  if (loop1.production_split_1_wallet && loop1.production_split_1_percentage) {
    loop1Production.push({
      wallet: loop1.production_split_1_wallet,
      percentage: loop1.production_split_1_percentage
    });
  }
  if (loop1.production_split_2_wallet && loop1.production_split_2_percentage) {
    loop1Production.push({
      wallet: loop1.production_split_2_wallet,
      percentage: loop1.production_split_2_percentage
    });
  }
  if (loop1.production_split_3_wallet && loop1.production_split_3_percentage) {
    loop1Production.push({
      wallet: loop1.production_split_3_wallet,
      percentage: loop1.production_split_3_percentage
    });
  }

  // Step 3: Extract composition splits from Loop 2
  const loop2Composition: TrackSplit[] = [];
  if (loop2.composition_split_1_wallet && loop2.composition_split_1_percentage) {
    loop2Composition.push({
      wallet: loop2.composition_split_1_wallet,
      percentage: loop2.composition_split_1_percentage
    });
  }
  if (loop2.composition_split_2_wallet && loop2.composition_split_2_percentage) {
    loop2Composition.push({
      wallet: loop2.composition_split_2_wallet,
      percentage: loop2.composition_split_2_percentage
    });
  }
  if (loop2.composition_split_3_wallet && loop2.composition_split_3_percentage) {
    loop2Composition.push({
      wallet: loop2.composition_split_3_wallet,
      percentage: loop2.composition_split_3_percentage
    });
  }

  // Step 4: Extract production splits from Loop 2
  const loop2Production: TrackSplit[] = [];
  if (loop2.production_split_1_wallet && loop2.production_split_1_percentage) {
    loop2Production.push({
      wallet: loop2.production_split_1_wallet,
      percentage: loop2.production_split_1_percentage
    });
  }
  if (loop2.production_split_2_wallet && loop2.production_split_2_percentage) {
    loop2Production.push({
      wallet: loop2.production_split_2_wallet,
      percentage: loop2.production_split_2_percentage
    });
  }
  if (loop2.production_split_3_wallet && loop2.production_split_3_percentage) {
    loop2Production.push({
      wallet: loop2.production_split_3_wallet,
      percentage: loop2.production_split_3_percentage
    });
  }

  console.log('📦 Extracted splits:', {
    loop1Composition,
    loop1Production,
    loop2Composition,
    loop2Production
  });

  // Step 5: Calculate remix composition splits
  // Each loop contributes 50% to the composition pie
  // Scale each contributor's percentage by 50%
  const remixComposition: TrackSplit[] = [];

  // Add Loop 1 composition contributors (scaled to 50% of pie)
  loop1Composition.forEach(split => {
    const scaledPercentage = Math.floor(split.percentage * LOOP_CONTRIBUTION);
    remixComposition.push({
      wallet: split.wallet,
      percentage: scaledPercentage
    });
  });

  // Add Loop 2 composition contributors (scaled to 50% of pie)
  loop2Composition.forEach(split => {
    const scaledPercentage = Math.floor(split.percentage * LOOP_CONTRIBUTION);
    remixComposition.push({
      wallet: split.wallet,
      percentage: scaledPercentage
    });
  });

  // Step 6: Calculate remix production splits
  // Each loop contributes 50% to the production pie
  const remixProduction: TrackSplit[] = [];

  // Add Loop 1 production contributors (scaled to 50% of pie)
  loop1Production.forEach(split => {
    const scaledPercentage = Math.floor(split.percentage * LOOP_CONTRIBUTION);
    remixProduction.push({
      wallet: split.wallet,
      percentage: scaledPercentage
    });
  });

  // Add Loop 2 production contributors (scaled to 50% of pie)
  loop2Production.forEach(split => {
    const scaledPercentage = Math.floor(split.percentage * LOOP_CONTRIBUTION);
    remixProduction.push({
      wallet: split.wallet,
      percentage: scaledPercentage
    });
  });

  console.log('🔢 Before consolidation:', {
    composition: remixComposition,
    production: remixProduction
  });

  // Step 7: Consolidate duplicate wallets
  // If the same wallet appears multiple times (e.g., same person did comp AND prod in one loop),
  // combine their percentages
  const consolidatedComposition = consolidateSplits(remixComposition);
  const consolidatedProduction = consolidateSplits(remixProduction);

  console.log('🔄 After consolidation:', {
    composition: consolidatedComposition,
    production: consolidatedProduction
  });

  // Step 8: Adjust for rounding errors to ensure exactly 100%
  const totalComp = consolidatedComposition.reduce((sum, s) => sum + s.percentage, 0);
  const totalProd = consolidatedProduction.reduce((sum, s) => sum + s.percentage, 0);

  console.log('📊 Pre-adjustment totals:', { totalComp, totalProd });

  // Add any rounding difference to the first split (or distribute evenly if large difference)
  if (totalComp !== 100 && consolidatedComposition.length > 0) {
    const diff = 100 - totalComp;
    consolidatedComposition[0].percentage += diff;
    console.log(`⚖️ Adjusted composition by ${diff}% to reach 100%`);
  }

  if (totalProd !== 100 && consolidatedProduction.length > 0) {
    const diff = 100 - totalProd;
    consolidatedProduction[0].percentage += diff;
    console.log(`⚖️ Adjusted production by ${diff}% to reach 100%`);
  }

  const result: RemixSplits = {
    composition: consolidatedComposition,
    production: consolidatedProduction,
    totalComposition: consolidatedComposition.reduce((sum, s) => sum + s.percentage, 0),
    totalProduction: consolidatedProduction.reduce((sum, s) => sum + s.percentage, 0)
  };

  console.log('✅ Final Remix IP Splits:', {
    composition: result.composition,
    production: result.production,
    totalComposition: result.totalComposition,
    totalProduction: result.totalProduction,
    note: 'Remixer gets 20% commission at payment time (not included in IP splits)'
  });

  // Validation
  if (result.totalComposition !== 100) {
    console.error('❌ Composition splits do not sum to 100%:', result.totalComposition);
  }
  if (result.totalProduction !== 100) {
    console.error('❌ Production splits do not sum to 100%:', result.totalProduction);
  }

  return result;
}

/**
 * Consolidate duplicate wallets by summing their percentages
 */
function consolidateSplits(splits: TrackSplit[]): TrackSplit[] {
  const walletMap = new Map<string, number>();

  splits.forEach(split => {
    const existing = walletMap.get(split.wallet) || 0;
    walletMap.set(split.wallet, existing + split.percentage);
  });

  return Array.from(walletMap.entries()).map(([wallet, percentage]) => ({
    wallet,
    percentage
  }));
}
