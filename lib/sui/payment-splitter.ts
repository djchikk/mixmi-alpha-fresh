/**
 * SUI Payment Splitter
 *
 * Builds transactions to split USDC payments among multiple recipients.
 * Uses Programmable Transaction Blocks (PTBs) for efficient multi-recipient payments.
 */

import { Transaction } from '@mysten/sui/transactions';
import { getSuiClient, getUsdcType, getUsdcCoins, usdcToUnits, SuiNetwork } from './client';

export interface PaymentRecipient {
  address: string;      // SUI address (0x...)
  amountUsdc: number;   // Amount in USDC (e.g., 2.50 for $2.50)
  label?: string;       // Optional display label (for logging)
}

export interface SplitPaymentParams {
  senderAddress: string;
  recipients: PaymentRecipient[];
  network?: SuiNetwork;
}

export interface SplitPaymentResult {
  txBytes: Uint8Array;
  totalUsdc: number;
  recipientCount: number;
}

/**
 * Build a transaction to split USDC payment among multiple recipients
 *
 * This uses SUI's native PTB (Programmable Transaction Block) to:
 * 1. Merge all sender's USDC coins (if multiple)
 * 2. Split into exact amounts for each recipient
 * 3. Transfer to all recipients in a single atomic transaction
 *
 * @returns Transaction bytes ready for signing
 */
export async function buildSplitPaymentTransaction({
  senderAddress,
  recipients,
  network,
}: SplitPaymentParams): Promise<SplitPaymentResult> {
  if (recipients.length === 0) {
    throw new Error('No recipients provided');
  }

  // Filter out zero amounts and validate addresses
  const validRecipients = recipients.filter(r => {
    if (r.amountUsdc <= 0) {
      console.warn(`Skipping recipient with zero/negative amount: ${r.label || r.address}`);
      return false;
    }
    if (!r.address || !r.address.startsWith('0x')) {
      console.warn(`Skipping recipient with invalid address: ${r.label || 'unknown'}`);
      return false;
    }
    return true;
  });

  if (validRecipients.length === 0) {
    throw new Error('No valid recipients after filtering');
  }

  const client = getSuiClient(network);
  const usdcType = getUsdcType(network);

  // Get sender's USDC coins
  const usdcCoins = await getUsdcCoins(senderAddress, network);

  if (usdcCoins.length === 0) {
    throw new Error('No USDC found in sender wallet');
  }

  // Calculate total needed
  const totalUsdc = validRecipients.reduce((sum, r) => sum + r.amountUsdc, 0);
  const totalUnits = usdcToUnits(totalUsdc);

  // Check balance
  const availableUnits = usdcCoins.reduce(
    (sum, coin) => sum + BigInt(coin.balance),
    BigInt(0)
  );

  if (availableUnits < totalUnits) {
    const available = Number(availableUnits) / 1_000_000;
    throw new Error(`Insufficient USDC: need $${totalUsdc.toFixed(2)}, have $${available.toFixed(2)}`);
  }

  // Build transaction
  const tx = new Transaction();
  tx.setSender(senderAddress);

  // If multiple USDC coins, merge them first
  let primaryCoin;
  if (usdcCoins.length > 1) {
    const [first, ...rest] = usdcCoins;
    primaryCoin = tx.object(first.coinObjectId);
    tx.mergeCoins(
      primaryCoin,
      rest.map(c => tx.object(c.coinObjectId))
    );
  } else {
    primaryCoin = tx.object(usdcCoins[0].coinObjectId);
  }

  // Split coins for each recipient
  const amounts = validRecipients.map(r => tx.pure.u64(usdcToUnits(r.amountUsdc)));
  const splitCoins = tx.splitCoins(primaryCoin, amounts);

  // Transfer to each recipient
  validRecipients.forEach((recipient, index) => {
    tx.transferObjects(
      [splitCoins[index]],
      tx.pure.address(recipient.address)
    );
  });

  // Build transaction bytes
  const txBytes = await tx.build({ client });

  return {
    txBytes,
    totalUsdc,
    recipientCount: validRecipients.length,
  };
}

export interface SplitPaymentForSponsorshipResult {
  tx: Transaction;
  kindBytes: Uint8Array;
}

/**
 * Build a transaction for sponsorship (without gas info)
 *
 * Returns transaction kind bytes that can be used with sponsored transactions.
 * The sponsor will add gas payment info before final signing.
 */
export async function buildSplitPaymentForSponsorship({
  senderAddress,
  recipients,
  network,
}: SplitPaymentParams): Promise<SplitPaymentForSponsorshipResult> {
  if (recipients.length === 0) {
    throw new Error('No recipients provided');
  }

  const validRecipients = recipients.filter(r => r.amountUsdc > 0 && r.address?.startsWith('0x'));

  if (validRecipients.length === 0) {
    throw new Error('No valid recipients after filtering');
  }

  const client = getSuiClient(network);
  const usdcType = getUsdcType(network);

  // Get sender's USDC coins
  const usdcCoins = await getUsdcCoins(senderAddress, network);

  if (usdcCoins.length === 0) {
    throw new Error('No USDC found in sender wallet');
  }

  // Build transaction
  const tx = new Transaction();
  tx.setSender(senderAddress);

  // Merge and split coins
  let primaryCoin;
  if (usdcCoins.length > 1) {
    const [first, ...rest] = usdcCoins;
    primaryCoin = tx.object(first.coinObjectId);
    tx.mergeCoins(primaryCoin, rest.map(c => tx.object(c.coinObjectId)));
  } else {
    primaryCoin = tx.object(usdcCoins[0].coinObjectId);
  }

  const amounts = validRecipients.map(r => tx.pure.u64(usdcToUnits(r.amountUsdc)));
  const splitCoins = tx.splitCoins(primaryCoin, amounts);

  validRecipients.forEach((recipient, index) => {
    tx.transferObjects([splitCoins[index]], tx.pure.address(recipient.address));
  });

  // Build as transaction kind only (for sponsorship)
  const kindBytes = await tx.build({
    client,
    onlyTransactionKind: true,
  });

  return { tx, kindBytes };
}

/**
 * Convert aggregated cart payment data to recipient list
 *
 * Takes the output from batch-payment-aggregator and converts
 * wallet addresses to SUI addresses for payment.
 */
export interface AggregatedPayment {
  compositionSplits: { wallet: string; percentage: number; suiAddress?: string }[];
  productionSplits: { wallet: string; percentage: number; suiAddress?: string }[];
  totalPriceUsdc: number;
}

export function aggregatedPaymentToRecipients(
  aggregated: AggregatedPayment,
  fallbackTreasuryAddress: string
): {
  directRecipients: PaymentRecipient[];
  treasuryAmount: number;
  treasuryBreakdown: { label: string; amount: number }[];
} {
  const directRecipients: PaymentRecipient[] = [];
  const treasuryBreakdown: { label: string; amount: number }[] = [];
  let treasuryAmount = 0;

  const compPool = aggregated.totalPriceUsdc / 2;
  const prodPool = aggregated.totalPriceUsdc / 2;

  // Process composition splits
  aggregated.compositionSplits.forEach(split => {
    const amount = (compPool * split.percentage) / 100;

    if (split.suiAddress) {
      // Has SUI address - pay directly
      const existing = directRecipients.find(r => r.address === split.suiAddress);
      if (existing) {
        existing.amountUsdc += amount;
      } else {
        directRecipients.push({
          address: split.suiAddress,
          amountUsdc: amount,
          label: `Composition: ${split.wallet}`,
        });
      }
    } else {
      // No SUI address - goes to treasury
      treasuryAmount += amount;
      treasuryBreakdown.push({
        label: split.wallet,
        amount,
      });
    }
  });

  // Process production splits
  aggregated.productionSplits.forEach(split => {
    const amount = (prodPool * split.percentage) / 100;

    if (split.suiAddress) {
      const existing = directRecipients.find(r => r.address === split.suiAddress);
      if (existing) {
        existing.amountUsdc += amount;
      } else {
        directRecipients.push({
          address: split.suiAddress,
          amountUsdc: amount,
          label: `Production: ${split.wallet}`,
        });
      }
    } else {
      treasuryAmount += amount;
      treasuryBreakdown.push({
        label: split.wallet,
        amount,
      });
    }
  });

  // Add treasury as a recipient if there are funds for unnamed collaborators
  if (treasuryAmount > 0) {
    directRecipients.push({
      address: fallbackTreasuryAddress,
      amountUsdc: treasuryAmount,
      label: 'Treasury (for unnamed collaborators)',
    });
  }

  return {
    directRecipients,
    treasuryAmount,
    treasuryBreakdown,
  };
}

/**
 * Simple single-recipient transfer (for withdrawals)
 */
export async function buildSimpleTransfer(
  senderAddress: string,
  recipientAddress: string,
  amountUsdc: number,
  network?: SuiNetwork
): Promise<SplitPaymentResult> {
  return buildSplitPaymentTransaction({
    senderAddress,
    recipients: [{ address: recipientAddress, amountUsdc }],
    network,
  });
}
