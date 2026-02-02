/**
 * Payment Calculation Utilities for Mixer Recording
 *
 * Implements "sausage link" pricing model:
 * - Cost = ceil(bars / 8) × $0.10 × number_of_tracks
 * - Split: 5% platform, 80% Gen 0 creators, 15% remixer stake (stored)
 */

import { IPTrack, SourceTrackMetadata, IPSplitInfo } from '@/types';
import { PRICING } from '@/config/pricing';

// =============================================================================
// Core Pricing Calculations
// =============================================================================

/**
 * Get the duration of one bar in seconds at a given BPM
 */
export function getBarDuration(bpm: number): number {
  // 4 beats per bar, 60 seconds per minute
  return (60 / bpm) * 4;
}

/**
 * Get the duration of one 8-bar block in seconds at a given BPM
 */
export function getBlockDuration(bpm: number): number {
  return getBarDuration(bpm) * PRICING.remix.barsPerBlock;
}

/**
 * Convert seconds to bars at a given BPM
 */
export function secondsToBars(seconds: number, bpm: number): number {
  return seconds / getBarDuration(bpm);
}

/**
 * Convert bars to seconds at a given BPM
 */
export function barsToSeconds(bars: number, bpm: number): number {
  return bars * getBarDuration(bpm);
}

/**
 * Snap a time value (in seconds) to the nearest 8-bar boundary
 */
export function snapTo8BarBoundary(seconds: number, bpm: number): number {
  const blockDuration = getBlockDuration(bpm);
  return Math.round(seconds / blockDuration) * blockDuration;
}

/**
 * Calculate the number of 8-bar blocks from a bar count
 */
export function calculateBlockCount(bars: number): number {
  return Math.ceil(bars / PRICING.remix.barsPerBlock);
}

/**
 * Calculate recording cost in USDC
 * Cost = ceil(bars / 8) × $0.10 × number_of_tracks
 */
export function calculateRecordingCost(bars: number, trackCount: number): number {
  const blocks = calculateBlockCount(bars);
  return blocks * PRICING.remix.pricePerBlock * trackCount;
}

// =============================================================================
// Payment Split Calculations
// =============================================================================

export interface PaymentSplit {
  platform: number;       // 5% - paid to platform
  creators: number;       // 80% - paid to Gen 0 creators
  remixerStake: number;   // 15% - stored, not paid
}

/**
 * Calculate the payment split for a total recording cost
 */
export function calculatePaymentSplit(totalCost: number): PaymentSplit {
  return {
    platform: totalCost * (PRICING.remix.platformCutPercent / 100),
    creators: totalCost * (PRICING.remix.creatorsCutPercent / 100),
    remixerStake: totalCost * (PRICING.remix.remixerStakePercent / 100),
  };
}

// =============================================================================
// IP Split Resolution
// =============================================================================

export interface RecipientPayment {
  sui_address: string;
  wallet_address?: string;
  amount: number;
  payment_type: 'platform' | 'composition' | 'production';
  source_track_id?: string;
  source_track_title?: string;
  percentage: number;
  display_name?: string;
}

/**
 * Extract IP split information from an IPTrack
 */
export function extractIPSplits(track: IPTrack): {
  composition: IPSplitInfo[];
  production: IPSplitInfo[];
} {
  const composition: IPSplitInfo[] = [];
  const production: IPSplitInfo[] = [];

  // Composition splits
  if (track.composition_split_1_wallet && track.composition_split_1_percentage) {
    composition.push({
      wallet: track.composition_split_1_wallet,
      sui_address: track.composition_split_1_sui_address,
      percentage: track.composition_split_1_percentage,
    });
  }
  if (track.composition_split_2_wallet && track.composition_split_2_percentage) {
    composition.push({
      wallet: track.composition_split_2_wallet,
      sui_address: track.composition_split_2_sui_address,
      percentage: track.composition_split_2_percentage,
    });
  }
  if (track.composition_split_3_wallet && track.composition_split_3_percentage) {
    composition.push({
      wallet: track.composition_split_3_wallet,
      sui_address: track.composition_split_3_sui_address,
      percentage: track.composition_split_3_percentage,
    });
  }

  // Production splits
  if (track.production_split_1_wallet && track.production_split_1_percentage) {
    production.push({
      wallet: track.production_split_1_wallet,
      sui_address: track.production_split_1_sui_address,
      percentage: track.production_split_1_percentage,
    });
  }
  if (track.production_split_2_wallet && track.production_split_2_percentage) {
    production.push({
      wallet: track.production_split_2_wallet,
      sui_address: track.production_split_2_sui_address,
      percentage: track.production_split_2_percentage,
    });
  }
  if (track.production_split_3_wallet && track.production_split_3_percentage) {
    production.push({
      wallet: track.production_split_3_wallet,
      sui_address: track.production_split_3_sui_address,
      percentage: track.production_split_3_percentage,
    });
  }

  return { composition, production };
}

/**
 * Build source track metadata for genealogy tracking
 */
export function buildSourceTrackMetadata(track: IPTrack): SourceTrackMetadata {
  const { composition, production } = extractIPSplits(track);

  return {
    id: track.id,
    title: track.title,
    bpm: track.bpm,
    generation: track.remix_depth || 0,
    remixer_stake_percentage: track.remixer_stake_percentage || 0,
    ip_ratios: {
      composition,
      production,
    },
  };
}

/**
 * Calculate payment recipients from loaded tracks
 *
 * The 80% creators cut is split equally among all tracks, then within each track
 * it's split 50/50 between composition and production.
 */
export function calculateRecipientPayments(
  loadedTracks: IPTrack[],
  creatorsCut: number,
  platformAddress: string
): RecipientPayment[] {
  const recipients: RecipientPayment[] = [];

  // No tracks = no creator payments
  if (loadedTracks.length === 0) {
    return recipients;
  }

  // Split creators cut equally among tracks
  const perTrackAmount = creatorsCut / loadedTracks.length;

  // 50/50 split between composition and production per track
  const compositionAmount = perTrackAmount * 0.5;
  const productionAmount = perTrackAmount * 0.5;

  for (const track of loadedTracks) {
    const { composition, production } = extractIPSplits(track);

    // Distribute composition amount among composition split holders
    const totalCompositionPercent = composition.reduce((sum, s) => sum + s.percentage, 0);
    for (const split of composition) {
      if (split.sui_address || split.wallet) {
        const amount = compositionAmount * (split.percentage / totalCompositionPercent);
        recipients.push({
          sui_address: split.sui_address || split.wallet,
          wallet_address: split.wallet,
          amount,
          payment_type: 'composition',
          source_track_id: track.id,
          source_track_title: track.title,
          percentage: split.percentage,
          display_name: split.display_name,
        });
      }
    }

    // Distribute production amount among production split holders
    const totalProductionPercent = production.reduce((sum, s) => sum + s.percentage, 0);
    for (const split of production) {
      if (split.sui_address || split.wallet) {
        const amount = productionAmount * (split.percentage / totalProductionPercent);
        recipients.push({
          sui_address: split.sui_address || split.wallet,
          wallet_address: split.wallet,
          amount,
          payment_type: 'production',
          source_track_id: track.id,
          source_track_title: track.title,
          percentage: split.percentage,
          display_name: split.display_name,
        });
      }
    }
  }

  return recipients;
}

/**
 * Merge duplicate recipient addresses (same address appears in multiple splits)
 */
export function mergeRecipientPayments(recipients: RecipientPayment[]): RecipientPayment[] {
  const merged = new Map<string, RecipientPayment>();

  for (const recipient of recipients) {
    const key = recipient.sui_address;
    const existing = merged.get(key);

    if (existing) {
      // Combine amounts, keep the first display name
      existing.amount += recipient.amount;
    } else {
      merged.set(key, { ...recipient });
    }
  }

  return Array.from(merged.values());
}

// =============================================================================
// Cost Display Helpers
// =============================================================================

/**
 * Format cost breakdown for display
 */
export function formatCostBreakdown(bars: number, trackCount: number): {
  blocks: number;
  pricePerBlock: number;
  totalCost: number;
  formula: string;
} {
  const blocks = calculateBlockCount(bars);
  const pricePerBlock = PRICING.remix.pricePerBlock;
  const totalCost = calculateRecordingCost(bars, trackCount);

  return {
    blocks,
    pricePerBlock,
    totalCost,
    formula: `${blocks} block${blocks !== 1 ? 's' : ''} × ${trackCount} track${trackCount !== 1 ? 's' : ''} × $${pricePerBlock.toFixed(2)} = $${totalCost.toFixed(2)} USDC`,
  };
}

/**
 * Format payment split for display
 */
export function formatPaymentSplit(totalCost: number): {
  split: PaymentSplit;
  breakdown: string;
} {
  const split = calculatePaymentSplit(totalCost);

  return {
    split,
    breakdown: `Platform (5%): $${split.platform.toFixed(2)} | Creators (80%): $${split.creators.toFixed(2)} | Your Stake (15%): $${split.remixerStake.toFixed(2)}`,
  };
}
