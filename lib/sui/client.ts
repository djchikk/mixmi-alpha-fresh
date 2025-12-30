/**
 * SUI Blockchain Client
 *
 * Provides SUI network connection and utility functions.
 * Uses @mysten/sui SDK for all blockchain interactions.
 */

import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// USDC token type identifiers
export const USDC_TYPE = {
  mainnet: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  testnet: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
} as const;

export type SuiNetwork = 'mainnet' | 'testnet' | 'devnet';

/**
 * Get the current network from environment
 */
export function getCurrentNetwork(): SuiNetwork {
  const network = process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet';
  if (network !== 'mainnet' && network !== 'testnet' && network !== 'devnet') {
    console.warn(`Invalid SUI_NETWORK: ${network}, defaulting to testnet`);
    return 'testnet';
  }
  return network;
}

/**
 * Get SUI client for the specified network
 */
export function getSuiClient(network?: SuiNetwork): SuiClient {
  const targetNetwork = network || getCurrentNetwork();
  return new SuiClient({ url: getFullnodeUrl(targetNetwork) });
}

/**
 * Get USDC type string for the current network
 */
export function getUsdcType(network?: SuiNetwork): string {
  const targetNetwork = network || getCurrentNetwork();
  if (targetNetwork === 'mainnet') {
    return USDC_TYPE.mainnet;
  }
  return USDC_TYPE.testnet;
}

/**
 * Convert USDC amount to smallest units (6 decimals)
 * $1.00 = 1_000_000 units
 */
export function usdcToUnits(amount: number): bigint {
  return BigInt(Math.floor(amount * 1_000_000));
}

/**
 * Convert USDC units back to decimal
 */
export function unitsToUsdc(units: bigint): number {
  return Number(units) / 1_000_000;
}

/**
 * Format USDC amount for display
 */
export function formatUsdc(amount: number): string {
  return `$${amount.toFixed(2)} USDC`;
}

/**
 * Get USDC coins owned by an address
 */
export async function getUsdcCoins(
  address: string,
  network?: SuiNetwork
) {
  const client = getSuiClient(network);
  const usdcType = getUsdcType(network);

  const coins = await client.getCoins({
    owner: address,
    coinType: usdcType,
  });

  return coins.data;
}

/**
 * Get total USDC balance for an address
 */
export async function getUsdcBalance(
  address: string,
  network?: SuiNetwork
): Promise<number> {
  const coins = await getUsdcCoins(address, network);
  const totalUnits = coins.reduce(
    (sum, coin) => sum + BigInt(coin.balance),
    BigInt(0)
  );
  return unitsToUsdc(totalUnits);
}

/**
 * Get SUI balance for an address (for gas)
 */
export async function getSuiBalance(
  address: string,
  network?: SuiNetwork
): Promise<number> {
  const client = getSuiClient(network);
  const balance = await client.getBalance({ owner: address });
  return Number(balance.totalBalance) / 1_000_000_000; // SUI has 9 decimals
}

/**
 * Check if an address has enough USDC for a payment
 */
export async function hasEnoughUsdc(
  address: string,
  requiredAmount: number,
  network?: SuiNetwork
): Promise<boolean> {
  const balance = await getUsdcBalance(address, network);
  return balance >= requiredAmount;
}

/**
 * Validate a SUI address format
 */
export function isValidSuiAddress(address: string): boolean {
  // SUI addresses are 64 hex characters with 0x prefix
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}
