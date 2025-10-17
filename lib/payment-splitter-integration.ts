/**
 * Payment Splitter Smart Contract Integration
 *
 * This file shows how to integrate the music-payment-splitter.clar smart contract
 * with the frontend CartContext for purchases.
 *
 * BEFORE USING:
 * 1. Deploy music-payment-splitter.clar to Stacks testnet
 * 2. Update CONTRACT_ADDRESS with deployed contract address
 * 3. Test with testnet STX
 * 4. Deploy to mainnet when ready
 */

import { openContractCall } from '@stacks/connect';
import { StacksTestnet, StacksMainnet } from '@stacks/network';
import {
  uintCV,
  listCV,
  tupleCV,
  principalCV,
  standardPrincipalCV
} from '@stacks/transactions';

// CONFIGURATION
const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK || 'testnet';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT || 'ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB'; // Deployed testnet address
const CONTRACT_NAME = 'music-payment-splitter';

/**
 * Get the appropriate Stacks network
 */
function getNetwork() {
  return NETWORK === 'mainnet' ? new StacksMainnet() : new StacksTestnet();
}

/**
 * Format payment splits for smart contract
 * Converts {wallet: string, percentage: number} to Clarity CV format
 */
function formatSplitsForContract(splits: Array<{wallet: string, percentage: number}>) {
  return listCV(
    splits.map(split =>
      tupleCV({
        wallet: standardPrincipalCV(split.wallet),
        percentage: uintCV(split.percentage)
      })
    )
  );
}

/**
 * Execute payment split for a single track purchase
 *
 * @param trackId - ID of the track being purchased
 * @param totalPriceMicroSTX - Total price in microSTX
 * @param compositionSplits - Composition rights holders and percentages
 * @param productionSplits - Production rights holders and percentages
 * @param onFinish - Callback when transaction completes
 * @param onCancel - Callback when user cancels
 */
export async function executePay mentSplit({
  trackId,
  totalPriceMicroSTX,
  compositionSplits,
  productionSplits,
  onFinish,
  onCancel
}: {
  trackId: string;
  totalPriceMicroSTX: number;
  compositionSplits: Array<{wallet: string, percentage: number}>;
  productionSplits: Array<{wallet: string, percentage: number}>;
  onFinish: (data: any) => void;
  onCancel: () => void;
}) {
  try {
    console.log('🎵 Executing payment split for track:', trackId);
    console.log('💰 Total price (microSTX):', totalPriceMicroSTX);
    console.log('🎼 Composition splits:', compositionSplits);
    console.log('🎙️ Production splits:', productionSplits);

    // Format splits for Clarity contract
    const compositionCV = formatSplitsForContract(compositionSplits);
    const productionCV = formatSplitsForContract(productionSplits);

    // Call the smart contract
    await openContractCall({
      network: getNetwork(),
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: 'split-track-payment',
      functionArgs: [
        uintCV(totalPriceMicroSTX),
        compositionCV,
        productionCV
      ],
      postConditions: [], // TODO: Add post-conditions for security
      onFinish: (data) => {
        console.log('✅ Payment split executed successfully:', data);
        onFinish(data);
      },
      onCancel: () => {
        console.log('❌ Payment cancelled by user');
        onCancel();
      }
    });

  } catch (error) {
    console.error('💥 Error executing payment split:', error);
    throw error;
  }
}

/**
 * Fetch payment splits from backend API
 *
 * @param trackId - ID of the track
 * @returns Payment split data formatted for smart contract
 */
export async function fetchPaymentSplits(trackId: string) {
  try {
    const response = await fetch(`/api/calculate-payment-splits?trackId=${trackId}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch payment splits: ${response.statusText}`);
    }

    const data = await response.json();

    console.log('📊 Payment splits fetched:', data);

    return {
      trackId: data.trackId,
      title: data.title,
      artist: data.artist,
      totalPriceMicroSTX: data.totalPriceMicroSTX,
      compositionSplits: data.compositionSplits,
      productionSplits: data.productionSplits
    };

  } catch (error) {
    console.error('❌ Error fetching payment splits:', error);
    throw error;
  }
}

/**
 * Complete purchase flow for a single track
 * Combines API fetch + smart contract execution
 *
 * @param trackId - ID of the track to purchase
 * @param onFinish - Callback when purchase completes
 * @param onCancel - Callback when user cancels
 */
export async function purchaseTrack({
  trackId,
  onFinish,
  onCancel
}: {
  trackId: string;
  onFinish: (data: any) => void;
  onCancel: () => void;
}) {
  // Step 1: Fetch payment splits from database
  const splits = await fetchPaymentSplits(trackId);

  // Step 2: Execute smart contract payment
  await executePaymentSplit({
    trackId: splits.trackId,
    totalPriceMicroSTX: splits.totalPriceMicroSTX,
    compositionSplits: splits.compositionSplits,
    productionSplits: splits.productionSplits,
    onFinish,
    onCancel
  });
}

/**
 * Preview payment splits without executing transaction
 * Useful for showing users who will receive payment before purchase
 *
 * @param trackId - ID of the track
 * @returns Formatted preview of payment distribution
 */
export async function previewPaymentSplits(trackId: string) {
  const splits = await fetchPaymentSplits(trackId);

  const compositionPool = splits.totalPriceMicroSTX / 2;
  const productionPool = splits.totalPriceMicroSTX / 2;

  return {
    trackId: splits.trackId,
    title: splits.title,
    artist: splits.artist,
    totalPrice: splits.totalPriceMicroSTX / 1000000, // Convert to STX for display
    compositionPayments: splits.compositionSplits.map(split => ({
      wallet: split.wallet,
      percentage: split.percentage,
      amountSTX: (compositionPool * split.percentage / 100) / 1000000
    })),
    productionPayments: splits.productionSplits.map(split => ({
      wallet: split.wallet,
      percentage: split.percentage,
      amountSTX: (productionPool * split.percentage / 100) / 1000000
    }))
  };
}

/**
 * EXAMPLE USAGE IN CARTCONTEXT:
 *
 * const purchaseAll = async () => {
 *   if (!isAuthenticated || !walletAddress) {
 *     setPurchaseError('Please connect your wallet first');
 *     return;
 *   }
 *
 *   if (cart.length === 0) return;
 *
 *   try {
 *     setPurchaseStatus('pending');
 *     setShowPurchaseModal(true);
 *
 *     // For now: purchase one track at a time
 *     // TODO Phase 2: batch multiple tracks
 *     const trackId = cart[0].id;
 *
 *     await purchaseTrack({
 *       trackId,
 *       onFinish: (data) => {
 *         console.log('✅ Purchase complete:', data);
 *         setPurchaseStatus('success');
 *         setTimeout(() => {
 *           clearCart();
 *           setShowPurchaseModal(false);
 *           setPurchaseStatus('idle');
 *         }, 3000);
 *       },
 *       onCancel: () => {
 *         console.log('❌ Purchase cancelled');
 *         setPurchaseStatus('idle');
 *         setShowPurchaseModal(false);
 *       }
 *     });
 *
 *   } catch (error) {
 *     console.error('💥 Purchase error:', error);
 *     setPurchaseError(error.message);
 *     setPurchaseStatus('error');
 *   }
 * };
 */
