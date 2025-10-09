/**
 * Calculate Remix Payment Splits - 80/20 Formula
 *
 * Remixer gets 20% ownership
 * Original track creators get 80% (split between 2 source loops)
 * Each source loop contributes 50% of the 80% pool (40% each)
 */

interface TrackSplit {
  wallet: string;
  percentage: number;
}

interface SourceTrack {
  // Composition splits
  composition_split_1_wallet?: string | null;
  composition_split_1_percentage?: number | null;
  composition_split_2_wallet?: string | null;
  composition_split_2_percentage?: number | null;
  composition_split_3_wallet?: string | null;
  composition_split_3_percentage?: number | null;

  // Production splits
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
 * Calculate remix splits from two source tracks
 * Returns splits that sum to 100% for both composition and production
 */
export function calculateRemixSplits(
  loop1: SourceTrack,
  loop2: SourceTrack,
  remixerWallet: string
): RemixSplits {
  const ORIGINAL_SHARE = 0.8;  // 80% to originals
  const REMIXER_SHARE = 0.2;   // 20% to remixer
  const POOL_PER_LOOP = 0.5;   // Each loop contributes 50% of the 80% pool

  const compositionSplits: TrackSplit[] = [];
  const productionSplits: TrackSplit[] = [];

  // Add remixer's 20% to both pools
  compositionSplits.push({
    wallet: remixerWallet,
    percentage: Math.floor(REMIXER_SHARE * 100) // 20%
  });

  productionSplits.push({
    wallet: remixerWallet,
    percentage: Math.floor(REMIXER_SHARE * 100) // 20%
  });

  // Process Loop 1 Composition (40% of total)
  if (loop1.composition_split_1_wallet && loop1.composition_split_1_percentage) {
    compositionSplits.push({
      wallet: loop1.composition_split_1_wallet,
      percentage: Math.floor((loop1.composition_split_1_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }
  if (loop1.composition_split_2_wallet && loop1.composition_split_2_percentage) {
    compositionSplits.push({
      wallet: loop1.composition_split_2_wallet,
      percentage: Math.floor((loop1.composition_split_2_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }
  if (loop1.composition_split_3_wallet && loop1.composition_split_3_percentage) {
    compositionSplits.push({
      wallet: loop1.composition_split_3_wallet,
      percentage: Math.floor((loop1.composition_split_3_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }

  // Process Loop 2 Composition (40% of total)
  if (loop2.composition_split_1_wallet && loop2.composition_split_1_percentage) {
    compositionSplits.push({
      wallet: loop2.composition_split_1_wallet,
      percentage: Math.floor((loop2.composition_split_1_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }
  if (loop2.composition_split_2_wallet && loop2.composition_split_2_percentage) {
    compositionSplits.push({
      wallet: loop2.composition_split_2_wallet,
      percentage: Math.floor((loop2.composition_split_2_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }
  if (loop2.composition_split_3_wallet && loop2.composition_split_3_percentage) {
    compositionSplits.push({
      wallet: loop2.composition_split_3_wallet,
      percentage: Math.floor((loop2.composition_split_3_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }

  // Process Loop 1 Production (40% of total)
  if (loop1.production_split_1_wallet && loop1.production_split_1_percentage) {
    productionSplits.push({
      wallet: loop1.production_split_1_wallet,
      percentage: Math.floor((loop1.production_split_1_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }
  if (loop1.production_split_2_wallet && loop1.production_split_2_percentage) {
    productionSplits.push({
      wallet: loop1.production_split_2_wallet,
      percentage: Math.floor((loop1.production_split_2_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }
  if (loop1.production_split_3_wallet && loop1.production_split_3_percentage) {
    productionSplits.push({
      wallet: loop1.production_split_3_wallet,
      percentage: Math.floor((loop1.production_split_3_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }

  // Process Loop 2 Production (40% of total)
  if (loop2.production_split_1_wallet && loop2.production_split_1_percentage) {
    productionSplits.push({
      wallet: loop2.production_split_1_wallet,
      percentage: Math.floor((loop2.production_split_1_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }
  if (loop2.production_split_2_wallet && loop2.production_split_2_percentage) {
    productionSplits.push({
      wallet: loop2.production_split_2_wallet,
      percentage: Math.floor((loop2.production_split_2_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }
  if (loop2.production_split_3_wallet && loop2.production_split_3_percentage) {
    productionSplits.push({
      wallet: loop2.production_split_3_wallet,
      percentage: Math.floor((loop2.production_split_3_percentage / 100) * POOL_PER_LOOP * ORIGINAL_SHARE * 100)
    });
  }

  // Calculate totals
  const totalComposition = compositionSplits.reduce((sum, split) => sum + split.percentage, 0);
  const totalProduction = productionSplits.reduce((sum, split) => sum + split.percentage, 0);

  // Adjust for rounding (add remainder to remixer)
  if (totalComposition < 100 && compositionSplits.length > 0) {
    compositionSplits[0].percentage += (100 - totalComposition);
  }
  if (totalProduction < 100 && productionSplits.length > 0) {
    productionSplits[0].percentage += (100 - totalProduction);
  }

  return {
    composition: compositionSplits,
    production: productionSplits,
    totalComposition: compositionSplits.reduce((sum, split) => sum + split.percentage, 0),
    totalProduction: productionSplits.reduce((sum, split) => sum + split.percentage, 0)
  };
}
