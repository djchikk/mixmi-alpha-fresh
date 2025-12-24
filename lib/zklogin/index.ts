/**
 * SUI zkLogin Core Utilities
 *
 * Handles the cryptographic operations for zkLogin authentication:
 * - Ephemeral keypair generation
 * - Nonce generation for OAuth
 * - ZK proof retrieval from Mysten Labs prover
 * - SUI address derivation
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import {
  generateNonce as zkGenerateNonce,
  generateRandomness,
  getZkLoginSignature,
  jwtToAddress
} from '@mysten/sui/zklogin';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';

// Network configuration
const SUI_NETWORK = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet' | 'devnet';
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID!;

// Mysten Labs prover endpoints
const PROVER_URL = SUI_NETWORK === 'mainnet'
  ? 'https://prover.mystenlabs.com/v1'
  : 'https://prover-dev.mystenlabs.com/v1';

// Salt service (we'll use our own API)
const SALT_SERVICE_URL = '/api/auth/zklogin/salt';

/**
 * Get SUI client for the configured network
 */
export function getSuiClient(): SuiClient {
  return new SuiClient({ url: getFullnodeUrl(SUI_NETWORK) });
}

/**
 * Get the current epoch from the SUI network
 */
export async function getCurrentEpoch(): Promise<number> {
  const client = getSuiClient();
  const { epoch } = await client.getLatestSuiSystemState();
  return Number(epoch);
}

/**
 * Generate a new ephemeral Ed25519 keypair for zkLogin
 * This keypair is temporary and used for a single session
 */
export function generateEphemeralKeyPair(): Ed25519Keypair {
  return Ed25519Keypair.generate();
}

/**
 * Serialize ephemeral keypair for storage
 */
export function serializeKeyPair(keypair: Ed25519Keypair): string {
  return keypair.getSecretKey();
}

/**
 * Deserialize ephemeral keypair from storage
 */
export function deserializeKeyPair(secretKey: string): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(secretKey);
}

/**
 * Generate nonce for OAuth flow
 * The nonce binds the OAuth JWT to the ephemeral keypair
 */
export async function generateNonce(
  ephemeralKeyPair: Ed25519Keypair,
  maxEpoch: number
): Promise<{ nonce: string; randomness: string }> {
  const randomness = generateRandomness();
  const nonce = zkGenerateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness
  );
  return { nonce, randomness };
}

/**
 * Build Google OAuth URL with zkLogin nonce
 */
export function buildGoogleAuthUrl(nonce: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Build Apple OAuth URL with zkLogin nonce
 * Apple uses response_mode=fragment to return id_token in URL hash
 */
export function buildAppleAuthUrl(nonce: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: APPLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    response_mode: 'fragment',
    scope: 'openid email',
    nonce: nonce,
  });

  return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
}

/**
 * Extract JWT from OAuth callback URL fragment
 */
export function extractJwtFromUrl(url: string): string | null {
  const hash = url.split('#')[1];
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  return params.get('id_token');
}

/**
 * Decode JWT payload (without verification - server will verify)
 */
export function decodeJwtPayload(jwt: string): {
  sub: string;
  email: string;
  aud: string;
  iss: string;
  nonce: string;
  exp: number;
} {
  const [, payload] = jwt.split('.');
  const decoded = JSON.parse(atob(payload));
  return decoded;
}

/**
 * Get user salt from our salt service
 * Creates new salt for first-time users, retrieves existing for returning users
 */
export async function getUserSalt(
  googleSub: string,
  email: string,
  inviteCode: string
): Promise<string> {
  const response = await fetch(SALT_SERVICE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ googleSub, email, inviteCode }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get salt');
  }

  const { salt } = await response.json();
  return salt;
}

/**
 * Get ZK proof from Mysten Labs prover
 */
export async function getZkProof(
  jwt: string,
  ephemeralPublicKey: string,
  maxEpoch: number,
  randomness: string,
  salt: string
): Promise<{
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}> {
  const response = await fetch(PROVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jwt,
      extendedEphemeralPublicKey: ephemeralPublicKey,
      maxEpoch,
      jwtRandomness: randomness,
      salt,
      keyClaimName: 'sub',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Prover error:', errorText);
    throw new Error(`Failed to get ZK proof: ${response.status}`);
  }

  return response.json();
}

/**
 * Derive SUI address from JWT and salt
 */
export function deriveSuiAddress(jwt: string, salt: string): string {
  return jwtToAddress(jwt, salt);
}

/**
 * Complete zkLogin flow data structure
 */
export interface ZkLoginData {
  ephemeralKeyPair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
  jwt: string;
  salt: string;
  suiAddress: string;
  zkProof: {
    proofPoints: {
      a: string[];
      b: string[][];
      c: string[];
    };
    issBase64Details: {
      value: string;
      indexMod4: number;
    };
    headerBase64: string;
  };
}

/**
 * Session expiry buffer (sessions expire 1 epoch before max)
 */
export const EPOCH_BUFFER = 1;

/**
 * Calculate max epoch for session (current + 2 epochs, minus buffer)
 */
export async function getMaxEpoch(): Promise<number> {
  const currentEpoch = await getCurrentEpoch();
  // Sessions valid for ~2 epochs (~48 hours on testnet)
  return currentEpoch + 2;
}
