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
    maxPersonas: 5,
    maxTbdWallets: 5,
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
