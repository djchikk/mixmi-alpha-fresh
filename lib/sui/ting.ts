/**
 * TING Token Utilities
 *
 * Backend utilities for minting and managing TING tokens.
 * The token contract is simple; the logic lives here.
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

// Configuration - set these after deployment
const TING_CONFIG = {
  packageId: process.env.TING_PACKAGE_ID || '',
  treasuryCapId: process.env.TING_TREASURY_CAP_ID || '',
  mintCapId: process.env.TING_MINT_CAP_ID || '',
  agentRegistryId: process.env.TING_AGENT_REGISTRY_ID || '',
  agentAdminCapId: process.env.TING_AGENT_ADMIN_CAP_ID || '',
  network: (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet',
};

// TING has 9 decimals (SUI standard)
export const TING_DECIMALS = 9;
export const TING_UNIT = 10 ** TING_DECIMALS; // 1 TING = 1_000_000_000 smallest units

/**
 * Convert human-readable TING amount to smallest units
 * @param amount - Human readable amount (e.g., 100 for 100 TING)
 * @returns Amount in smallest units
 */
export function toTingUnits(amount: number): bigint {
  return BigInt(Math.floor(amount * TING_UNIT));
}

/**
 * Convert smallest units to human-readable TING
 * @param units - Amount in smallest units
 * @returns Human readable amount
 */
export function fromTingUnits(units: bigint | number): number {
  return Number(units) / TING_UNIT;
}

/**
 * Get SUI client for the configured network
 */
export function getSuiClient(): SuiClient {
  return new SuiClient({ url: getFullnodeUrl(TING_CONFIG.network) });
}

/**
 * Build a mint transaction
 *
 * @param recipient - SUI address to receive TING
 * @param amount - Amount of TING to mint (human readable, e.g., 100 for 100 TING)
 * @returns Transaction block ready to be signed and executed
 */
export function buildMintTransaction(
  recipient: string,
  amount: number
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${TING_CONFIG.packageId}::ting::mint`,
    arguments: [
      tx.object(TING_CONFIG.treasuryCapId),
      tx.pure.u64(toTingUnits(amount)),
      tx.pure.address(recipient),
    ],
  });

  return tx;
}

/**
 * Build a burn transaction
 *
 * @param tingCoinId - Object ID of the TING coin to burn
 * @returns Transaction block ready to be signed and executed
 */
export function buildBurnTransaction(tingCoinId: string): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${TING_CONFIG.packageId}::ting::burn`,
    arguments: [
      tx.object(TING_CONFIG.treasuryCapId),
      tx.object(tingCoinId),
    ],
  });

  return tx;
}

/**
 * Get TING balance for an address
 *
 * @param address - SUI address to check
 * @returns Balance in human-readable TING
 */
export async function getTingBalance(address: string): Promise<number> {
  const client = getSuiClient();

  const tingType = `${TING_CONFIG.packageId}::ting::TING`;

  const balance = await client.getBalance({
    owner: address,
    coinType: tingType,
  });

  return fromTingUnits(BigInt(balance.totalBalance));
}

/**
 * Get all TING coin objects for an address
 *
 * @param address - SUI address to check
 * @returns Array of coin objects with IDs and balances
 */
export async function getTingCoins(address: string): Promise<Array<{
  coinObjectId: string;
  balance: number;
}>> {
  const client = getSuiClient();

  const tingType = `${TING_CONFIG.packageId}::ting::TING`;

  const coins = await client.getCoins({
    owner: address,
    coinType: tingType,
  });

  return coins.data.map(coin => ({
    coinObjectId: coin.coinObjectId,
    balance: fromTingUnits(BigInt(coin.balance)),
  }));
}

/**
 * Check if TING is configured
 */
export function isTingConfigured(): boolean {
  return !!(
    TING_CONFIG.packageId &&
    TING_CONFIG.treasuryCapId &&
    TING_CONFIG.packageId !== '0x...'
  );
}

/**
 * Get TING configuration (for debugging)
 */
export function getTingConfig() {
  return {
    ...TING_CONFIG,
    configured: isTingConfigured(),
  };
}

// ========== AI AGENT TING ALLOCATION ==========

/**
 * Default TING allocation for new AI agents
 * This is the "starter pack" each user's AI gets
 */
export const DEFAULT_AGENT_TING_ALLOCATION = 100; // 100 TING

/**
 * Build transaction to mint TING for a new AI agent
 * Called when creating agent wallets for new users
 *
 * @param agentWalletAddress - The AI agent's SUI wallet address
 * @param allocation - Amount of TING to give (defaults to 100)
 */
export function buildAgentInitializationTransaction(
  agentWalletAddress: string,
  allocation: number = DEFAULT_AGENT_TING_ALLOCATION
): Transaction {
  return buildMintTransaction(agentWalletAddress, allocation);
}

// ========== FUTURE: REWARD TRIGGERS ==========

/**
 * Reward amounts for various AI contributions
 * These can be adjusted based on platform needs
 */
export const TING_REWARDS = {
  // Curation rewards
  playlistCuration: 5,        // AI curates a playlist
  trackRecommendation: 1,     // AI recommends a track that gets played

  // Creation assistance
  implementationHelp: 10,     // AI helps implement a feature
  compilationCreation: 20,    // AI creates a compilation

  // Community
  helpfulAnswer: 2,           // AI provides helpful answer
  qualityCuration: 15,        // High-quality curation (requires human approval)
};

/**
 * Build a reward mint transaction
 *
 * @param agentAddress - AI agent wallet to reward
 * @param rewardType - Type of reward from TING_REWARDS
 */
export function buildRewardTransaction(
  agentAddress: string,
  rewardType: keyof typeof TING_REWARDS
): Transaction {
  const amount = TING_REWARDS[rewardType];
  return buildMintTransaction(agentAddress, amount);
}

// ========== AGENT REGISTRY FUNCTIONS ==========

/**
 * Build transaction to register a new AI agent
 * This registers the agent AND mints initial TING allocation
 *
 * @param agentAddress - The AI agent's SUI wallet address
 * @param ownerAddress - The human owner's wallet address
 * @param agentName - Display name for the agent
 */
export function buildRegisterAgentTransaction(
  agentAddress: string,
  ownerAddress: string,
  agentName: string = 'AI Agent'
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${TING_CONFIG.packageId}::agent_registry::register_agent`,
    arguments: [
      tx.object(TING_CONFIG.agentAdminCapId),
      tx.object(TING_CONFIG.agentRegistryId),
      tx.object(TING_CONFIG.treasuryCapId),
      tx.pure.address(agentAddress),
      tx.pure.address(ownerAddress),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(agentName))),
    ],
  });

  return tx;
}

/**
 * Build transaction to register agent with custom TING allocation
 */
export function buildRegisterAgentWithAllocationTransaction(
  agentAddress: string,
  ownerAddress: string,
  agentName: string,
  tingAllocation: number
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${TING_CONFIG.packageId}::agent_registry::register_agent_with_allocation`,
    arguments: [
      tx.object(TING_CONFIG.agentAdminCapId),
      tx.object(TING_CONFIG.agentRegistryId),
      tx.object(TING_CONFIG.treasuryCapId),
      tx.pure.address(agentAddress),
      tx.pure.address(ownerAddress),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(agentName))),
      tx.pure.u64(toTingUnits(tingAllocation)),
    ],
  });

  return tx;
}

/**
 * Build transaction to reward an existing agent
 */
export function buildRewardAgentTransaction(
  agentAddress: string,
  amount: number
): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${TING_CONFIG.packageId}::agent_registry::reward_agent`,
    arguments: [
      tx.object(TING_CONFIG.agentAdminCapId),
      tx.object(TING_CONFIG.agentRegistryId),
      tx.object(TING_CONFIG.treasuryCapId),
      tx.pure.address(agentAddress),
      tx.pure.u64(toTingUnits(amount)),
    ],
  });

  return tx;
}

// ========== AGENT WALLET GENERATION ==========

/**
 * Generate a new keypair for an AI agent
 * Returns the keypair and derived SUI address
 */
export function generateAgentKeypair(): {
  keypair: Ed25519Keypair;
  address: string;
  privateKeyBase64: string;
} {
  const keypair = new Ed25519Keypair();
  const address = keypair.getPublicKey().toSuiAddress();

  // Get private key for secure storage
  const privateKeyBytes = keypair.getSecretKey();
  const privateKeyBase64 = Buffer.from(privateKeyBytes).toString('base64');

  return {
    keypair,
    address,
    privateKeyBase64,
  };
}

/**
 * Restore a keypair from stored private key
 * Supports both bech32 format (suiprivkey1...) and base64 format
 */
export function restoreKeypair(privateKey: string): Ed25519Keypair {
  // Check if it's bech32 format (starts with 'suiprivkey')
  if (privateKey.startsWith('suiprivkey')) {
    const { schema, secretKey } = decodeSuiPrivateKey(privateKey);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }

  // Otherwise assume base64 format
  const privateKeyBytes = Buffer.from(privateKey, 'base64');
  return Ed25519Keypair.fromSecretKey(privateKeyBytes);
}

// ========== SPONSORED TRANSACTIONS ==========

/**
 * Sponsor wallet configuration
 * The sponsor pays gas fees on behalf of users
 */
const SPONSOR_CONFIG = {
  privateKey: process.env.SUI_SPONSOR_PRIVATE_KEY || '',
};

/**
 * Get the sponsor keypair
 * Used for paying gas on behalf of users
 */
export function getSponsorKeypair(): Ed25519Keypair | null {
  if (!SPONSOR_CONFIG.privateKey) {
    return null;
  }
  return restoreKeypair(SPONSOR_CONFIG.privateKey);
}

/**
 * Execute a transaction with sponsor paying gas
 *
 * @param tx - The transaction to execute
 * @param signer - The keypair that will sign the transaction (for auth)
 * @returns Transaction result
 */
export async function executeWithSponsor(
  tx: Transaction,
  signer: Ed25519Keypair
): Promise<{ digest: string; effects: any }> {
  const client = getSuiClient();
  const sponsor = getSponsorKeypair();

  if (!sponsor) {
    throw new Error('Sponsor wallet not configured');
  }

  // Set the gas owner to the sponsor
  tx.setSender(signer.getPublicKey().toSuiAddress());
  tx.setGasOwner(sponsor.getPublicKey().toSuiAddress());

  // Build the transaction
  const txBytes = await tx.build({ client });

  // Sign with both signer and sponsor
  const signerSignature = await signer.signTransaction(txBytes);
  const sponsorSignature = await sponsor.signTransaction(txBytes);

  // Execute with both signatures
  const result = await client.executeTransactionBlock({
    transactionBlock: txBytes,
    signature: [signerSignature.signature, sponsorSignature.signature],
    options: {
      showEffects: true,
    },
  });

  return {
    digest: result.digest,
    effects: result.effects,
  };
}

/**
 * Execute a transaction with the admin/treasury keypair
 * Used for minting, registering agents, etc.
 */
export async function executeAsAdmin(
  tx: Transaction
): Promise<{ digest: string; effects: any }> {
  const client = getSuiClient();
  const adminKey = process.env.TING_ADMIN_PRIVATE_KEY;

  if (!adminKey) {
    throw new Error('Admin private key not configured');
  }

  const adminKeypair = restoreKeypair(adminKey);

  const result = await client.signAndExecuteTransaction({
    signer: adminKeypair,
    transaction: tx,
    options: {
      showEffects: true,
    },
  });

  return {
    digest: result.digest,
    effects: result.effects,
  };
}
