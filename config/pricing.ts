/**
 * Mixmi Pricing Configuration
 * All prices in USDC
 *
 * This is the single source of truth for all pricing across the platform.
 * Update values here and they propagate everywhere.
 */

export const PRICING = {
  // In-platform recording fees (mixer use)
  mixer: {
    loopRecording: 0.10,      // per 8-bar loop
    songSection: 0.10,        // per 8-bar section
    videoClip: 0.10,          // per 5-second clip
  },

  // Offline download defaults (creator can adjust)
  download: {
    loop: 2.00,
    song: 1.00,
    videoClip: 2.00,
  },

  // Streaming (future)
  streaming: {
    dayPassPrice: 1.00,
    dayPassDurationHours: 24,
    minimumPlaySeconds: 20,
    previewSeconds: 20,
  },

  // Platform economics
  platform: {
    platformCutPercent: 10,       // Platform takes 10% of recording fees
    creatorCutPercent: 90,        // Creator gets 90%
    activeSplitGenerations: 3,    // Creator + 2 ancestors get direct splits
    seedRoyaltyPercent: 1,        // Original seed always gets 1%
  },

  // Contact/licensing
  contact: {
    inquiryFee: 1.00,             // Fixed fee for collab/commercial contact
    creatorCutPercent: 100,       // 100% goes to creator (no platform cut)
  },

  // Session limits
  session: {
    maxRecordingBars: 72,         // Play/experiment freely
    saveableUnitBars: 8,          // Pay per 8-bar section saved
  },

  // Account limits
  account: {
    maxPersonas: 80,  // Manager accounts for pilot communities need headroom
    maxTbdWallets: 5,
  },

  // Remix recording pricing ("sausage link" model)
  remix: {
    pricePerBlock: 0.10,        // $0.10 USDC per 8-bar block per track
    barsPerBlock: 8,            // 8 bars = 1 "sausage link"
    platformCutPercent: 10,     // 10% to platform (paid)
    creatorsCutPercent: 90,     // 90% to source track creators (paid)
    remixerStakePercent: 10,    // 10% remixer stake in new track's IP (NOT paid - just recorded for IP metadata)
  },
} as const;

// Computed values for convenience
export const COMPUTED = {
  // What creator actually receives from recording fee
  creatorRecordingFee: PRICING.mixer.loopRecording * (PRICING.platform.creatorCutPercent / 100),
  // What platform takes from recording fee
  platformRecordingFee: PRICING.mixer.loopRecording * (PRICING.platform.platformCutPercent / 100),
} as const;

// Format helpers
export function formatUSDC(amount: number): string {
  return `$${amount.toFixed(2)} USDC`;
}

export function formatUSDCShort(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Get default download price by content type
export function getDefaultDownloadPrice(contentType: string): number {
  switch (contentType) {
    case 'loop':
    case 'loop_pack':
    case 'video_clip':
      return PRICING.download.loop;
    case 'full_song':
    case 'ep':
      return PRICING.download.song;
    default:
      return PRICING.download.song;
  }
}

// Get recording fee (same for all content types currently)
export function getRecordingFee(contentType: string): number {
  switch (contentType) {
    case 'loop':
    case 'loop_pack':
      return PRICING.mixer.loopRecording;
    case 'full_song':
    case 'ep':
      return PRICING.mixer.songSection;
    case 'video_clip':
      return PRICING.mixer.videoClip;
    default:
      return PRICING.mixer.loopRecording;
  }
}

// Calculate pack price (no discount - price × count)
export function calculatePackPrice(
  itemCount: number,
  priceType: 'recording' | 'download',
  contentType: 'loop_pack' | 'ep'
): number {
  if (priceType === 'recording') {
    return PRICING.mixer.loopRecording * itemCount;
  }

  const perItemPrice = contentType === 'loop_pack'
    ? PRICING.download.loop
    : PRICING.download.song;

  return perItemPrice * itemCount;
}

// =============================================================================
// Remix Recording ("Sausage Link") Pricing
// =============================================================================

/**
 * Calculate the number of 8-bar blocks from a bar count
 * Each block is a "sausage link" that is priced at $0.10 per track
 */
export function calculateBlockCount(bars: number): number {
  return Math.ceil(bars / PRICING.remix.barsPerBlock);
}

/**
 * Calculate recording cost using sausage link pricing
 * Cost = ceil(bars / 8) × $0.10 × number_of_tracks
 */
export function calculateRecordingCost(bars: number, trackCount: number): number {
  const blocks = calculateBlockCount(bars);
  return blocks * PRICING.remix.pricePerBlock * trackCount;
}

/**
 * Calculate payment split for a recording payment
 * Returns amounts for platform, creators, and remixer stake
 */
export function calculateRecordingPaymentSplit(totalCost: number): {
  platform: number;
  creators: number;
  remixerStake: number;
} {
  return {
    platform: totalCost * (PRICING.remix.platformCutPercent / 100),
    creators: totalCost * (PRICING.remix.creatorsCutPercent / 100),
    remixerStake: totalCost * (PRICING.remix.remixerStakePercent / 100),
  };
}

/**
 * Format recording cost breakdown for display
 */
export function formatRecordingCostBreakdown(
  bars: number,
  trackCount: number
): string {
  const blocks = calculateBlockCount(bars);
  const cost = calculateRecordingCost(bars, trackCount);
  return `${blocks} block${blocks !== 1 ? 's' : ''} × ${trackCount} track${trackCount !== 1 ? 's' : ''} × ${formatUSDCShort(PRICING.remix.pricePerBlock)} = ${formatUSDC(cost)}`;
}
