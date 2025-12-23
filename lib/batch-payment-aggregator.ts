/**
 * Batch Payment Aggregator
 *
 * Combines multiple track purchases into a single smart contract call
 * Handles duplicate wallets across tracks and calculates aggregate splits
 */

interface TrackSplit {
  wallet: string;
  percentage: number;
}

interface TrackPaymentData {
  trackId: string;
  title: string;
  totalPriceMicroSTX: number;
  compositionSplits: TrackSplit[];
  productionSplits: TrackSplit[];
}

interface AggregatedSplit {
  wallet: string;
  amountMicroSTX: number;
}

interface BatchPaymentResult {
  totalPriceMicroSTX: number;
  compositionSplits: TrackSplit[];
  productionSplits: TrackSplit[];
  breakdown: {
    trackId: string;
    title: string;
    price: number;
    contributors: string[];
  }[];
}

/**
 * Aggregate multiple track purchases into single payment split
 *
 * @param tracks Array of track payment data from API
 * @returns Aggregated splits for smart contract
 */
export function aggregateCartPayments(tracks: TrackPaymentData[]): BatchPaymentResult {
  // Calculate total cart price
  const totalPriceMicroSTX = tracks.reduce((sum, track) => sum + track.totalPriceMicroSTX, 0);

  // Aggregate composition payments
  const compositionPayments = new Map<string, number>();
  tracks.forEach(track => {
    const trackCompPool = track.totalPriceMicroSTX / 2;
    track.compositionSplits.forEach(split => {
      const amount = Math.floor((trackCompPool * split.percentage) / 100);
      const current = compositionPayments.get(split.wallet) || 0;
      compositionPayments.set(split.wallet, current + amount);
    });
  });

  // Aggregate production payments
  const productionPayments = new Map<string, number>();
  tracks.forEach(track => {
    const trackProdPool = track.totalPriceMicroSTX / 2;
    track.productionSplits.forEach(split => {
      const amount = Math.floor((trackProdPool * split.percentage) / 100);
      const current = productionPayments.get(split.wallet) || 0;
      productionPayments.set(split.wallet, current + amount);
    });
  });

  // Calculate total pools (50/50 split of entire cart)
  const totalCompositionPool = totalPriceMicroSTX / 2;
  const totalProductionPool = totalPriceMicroSTX / 2;

  // Convert amounts to percentages of respective pools
  const compositionSplits: TrackSplit[] = Array.from(compositionPayments.entries()).map(
    ([wallet, amount]) => ({
      wallet,
      percentage: Math.floor((amount / totalCompositionPool) * 100)
    })
  );

  const productionSplits: TrackSplit[] = Array.from(productionPayments.entries()).map(
    ([wallet, amount]) => ({
      wallet,
      percentage: Math.floor((amount / totalProductionPool) * 100)
    })
  );

  // Adjust for rounding - give remainder to first recipient
  const compTotal = compositionSplits.reduce((sum, s) => sum + s.percentage, 0);
  const prodTotal = productionSplits.reduce((sum, s) => sum + s.percentage, 0);

  if (compTotal < 100 && compositionSplits.length > 0) {
    compositionSplits[0].percentage += (100 - compTotal);
  }
  if (prodTotal < 100 && productionSplits.length > 0) {
    productionSplits[0].percentage += (100 - prodTotal);
  }

  // Create breakdown for preview
  const breakdown = tracks.map(track => ({
    trackId: track.trackId,
    title: track.title,
    price: track.totalPriceMicroSTX / 1000000,
    contributors: [
      ...track.compositionSplits.map(s => s.wallet),
      ...track.productionSplits.map(s => s.wallet)
    ]
  }));

  return {
    totalPriceMicroSTX,
    compositionSplits,
    productionSplits,
    breakdown
  };
}

/**
 * Preview batch payment distribution
 * Shows exactly who gets paid what from cart purchase
 */
export function previewBatchPayment(tracks: TrackPaymentData[]) {
  const aggregated = aggregateCartPayments(tracks);
  const compPool = aggregated.totalPriceMicroSTX / 2;
  const prodPool = aggregated.totalPriceMicroSTX / 2;

  return {
    totalPrice: aggregated.totalPriceMicroSTX / 1000000,
    tracks: aggregated.breakdown,
    compositionPayments: aggregated.compositionSplits.map(split => ({
      wallet: split.wallet,
      percentage: split.percentage,
      amountSTX: ((compPool * split.percentage) / 100) / 1000000
    })),
    productionPayments: aggregated.productionSplits.map(split => ({
      wallet: split.wallet,
      percentage: split.percentage,
      amountSTX: ((prodPool * split.percentage) / 100) / 1000000
    }))
  };
}

/**
 * Example usage:
 *
 * const cartTracks = await Promise.all(
 *   cartItems.map(item => fetchPaymentSplits(item.trackId))
 * );
 *
 * const aggregated = aggregateCartPayments(cartTracks);
 *
 * await executePaymentSplit({
 *   trackId: 'batch-purchase',
 *   totalPriceMicroSTX: aggregated.totalPriceMicroSTX,
 *   compositionSplits: aggregated.compositionSplits,
 *   productionSplits: aggregated.productionSplits,
 *   onFinish: (data) => console.log('Batch purchase complete!'),
 *   onCancel: () => console.log('Cancelled')
 * });
 */
