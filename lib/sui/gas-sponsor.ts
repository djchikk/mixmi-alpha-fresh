/**
 * SUI Gas Sponsorship
 *
 * Enables sponsored transactions where the platform pays gas fees
 * so users only need USDC, not SUI tokens.
 *
 * Flow:
 * 1. User builds transaction and signs intent
 * 2. Platform (sponsor) adds gas payment and signs
 * 3. Dual-signed transaction is executed
 */

import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSuiClient, SuiNetwork } from './client';

export interface SponsorshipResult {
  txBytes: Uint8Array;
  sponsorSignature: string;
}

export interface ExecutionResult {
  digest: string;
  effects: any;
  events: any[];
}

/**
 * Add gas sponsorship to a transaction
 *
 * Takes transaction kind bytes (from buildSplitPaymentForSponsorship)
 * and adds gas payment from the sponsor wallet.
 *
 * NOTE: This function requires the sponsor's private key and should
 * only be called from a secure backend API route.
 */
export async function sponsorTransaction(
  kindBytes: Uint8Array,
  senderAddress: string,
  sponsorPrivateKey: string,
  network?: SuiNetwork
): Promise<SponsorshipResult> {
  const client = getSuiClient(network);

  // Create keypair from private key
  const sponsorKeypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(sponsorPrivateKey, 'hex')
  );
  const sponsorAddress = sponsorKeypair.toSuiAddress();

  // Reconstruct transaction from kind bytes
  const tx = Transaction.fromKind(kindBytes);

  // Set sender and sponsor
  tx.setSender(senderAddress);
  tx.setGasOwner(sponsorAddress);

  // Get sponsor's gas coins (SUI)
  const gasCoins = await client.getCoins({
    owner: sponsorAddress,
    coinType: '0x2::sui::SUI',
  });

  if (gasCoins.data.length === 0) {
    throw new Error('Sponsor wallet has no SUI for gas');
  }

  // Set gas payment from sponsor
  tx.setGasPayment(
    gasCoins.data.slice(0, 1).map(coin => ({
      objectId: coin.coinObjectId,
      version: coin.version,
      digest: coin.digest,
    }))
  );

  // Set reasonable gas budget (0.1 SUI should be plenty)
  tx.setGasBudget(100_000_000);

  // Build final transaction
  const txBytes = await tx.build({ client });

  // Sponsor signs
  const sponsorSignature = await sponsorKeypair.signTransaction(txBytes);

  return {
    txBytes,
    sponsorSignature: sponsorSignature.signature,
  };
}

/**
 * Execute a sponsored transaction with both signatures
 */
export async function executeSponsoredTransaction(
  txBytes: Uint8Array,
  userSignature: string,
  sponsorSignature: string,
  network?: SuiNetwork
): Promise<ExecutionResult> {
  const client = getSuiClient(network);

  const result = await client.executeTransactionBlock({
    transactionBlock: txBytes,
    signature: [userSignature, sponsorSignature],
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return {
    digest: result.digest,
    effects: result.effects,
    events: result.events || [],
  };
}

/**
 * Check sponsor wallet has enough SUI for gas
 */
export async function checkSponsorBalance(
  sponsorAddress: string,
  network?: SuiNetwork
): Promise<{ hasSui: boolean; balance: number }> {
  const client = getSuiClient(network);
  const balance = await client.getBalance({ owner: sponsorAddress });
  const suiBalance = Number(balance.totalBalance) / 1_000_000_000;

  return {
    hasSui: suiBalance > 0.01, // Need at least 0.01 SUI for gas
    balance: suiBalance,
  };
}

/**
 * Estimate gas cost for a transaction
 */
export async function estimateGasCost(
  txBytes: Uint8Array,
  network?: SuiNetwork
): Promise<{ gasBudget: number; estimatedCost: number }> {
  const client = getSuiClient(network);

  try {
    const dryRun = await client.dryRunTransactionBlock({
      transactionBlock: Buffer.from(txBytes).toString('base64'),
    });

    const computationCost = Number(dryRun.effects.gasUsed.computationCost);
    const storageCost = Number(dryRun.effects.gasUsed.storageCost);
    const storageRebate = Number(dryRun.effects.gasUsed.storageRebate);

    const totalCost = computationCost + storageCost - storageRebate;
    const costInSui = totalCost / 1_000_000_000;

    return {
      gasBudget: Math.ceil(totalCost * 1.5), // Add 50% buffer
      estimatedCost: costInSui,
    };
  } catch (error) {
    console.error('Gas estimation failed:', error);
    return {
      gasBudget: 100_000_000, // Default 0.1 SUI
      estimatedCost: 0.001,   // Estimate ~$0.001
    };
  }
}
