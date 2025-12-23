/**
 * ZkLogin Session Management
 *
 * Handles secure storage of zkLogin session data in sessionStorage.
 * Uses sessionStorage (not localStorage) for security - data cleared when browser closes.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { deserializeKeyPair, serializeKeyPair } from './index';

const ZKLOGIN_SESSION_KEY = 'zklogin_session';
const ZKLOGIN_PENDING_KEY = 'zklogin_pending'; // For OAuth flow state

/**
 * Serialized session data for storage
 */
interface StoredSession {
  ephemeralSecretKey: string;
  maxEpoch: number;
  randomness: string;
  jwt: string;
  salt: string;
  suiAddress: string;
  googleEmail: string;
  inviteCode: string;
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
  createdAt: number;
}

/**
 * Active session with deserialized keypair
 */
export interface ZkLoginSession {
  ephemeralKeyPair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
  jwt: string;
  salt: string;
  suiAddress: string;
  googleEmail: string;
  inviteCode: string;
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
  createdAt: number;
}

/**
 * Pending OAuth flow state (stored before redirect)
 */
export interface PendingZkLogin {
  ephemeralSecretKey: string;
  maxEpoch: number;
  randomness: string;
  inviteCode: string;
  createdAt: number;
}

/**
 * Store pending zkLogin state before OAuth redirect
 */
export function storePendingZkLogin(
  ephemeralKeyPair: Ed25519Keypair,
  maxEpoch: number,
  randomness: string,
  inviteCode: string
): void {
  if (typeof window === 'undefined') return;

  const pending: PendingZkLogin = {
    ephemeralSecretKey: serializeKeyPair(ephemeralKeyPair),
    maxEpoch,
    randomness,
    inviteCode,
    createdAt: Date.now(),
  };

  sessionStorage.setItem(ZKLOGIN_PENDING_KEY, JSON.stringify(pending));
}

/**
 * Get pending zkLogin state after OAuth callback
 */
export function getPendingZkLogin(): PendingZkLogin | null {
  if (typeof window === 'undefined') return null;

  const data = sessionStorage.getItem(ZKLOGIN_PENDING_KEY);
  if (!data) return null;

  try {
    const pending = JSON.parse(data) as PendingZkLogin;

    // Check if pending state is too old (15 minutes max)
    const maxAge = 15 * 60 * 1000;
    if (Date.now() - pending.createdAt > maxAge) {
      clearPendingZkLogin();
      return null;
    }

    return pending;
  } catch {
    clearPendingZkLogin();
    return null;
  }
}

/**
 * Clear pending zkLogin state
 */
export function clearPendingZkLogin(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ZKLOGIN_PENDING_KEY);
}

/**
 * Store complete zkLogin session after successful authentication
 */
export function storeZkLoginSession(
  ephemeralKeyPair: Ed25519Keypair,
  maxEpoch: number,
  randomness: string,
  jwt: string,
  salt: string,
  suiAddress: string,
  googleEmail: string,
  inviteCode: string,
  zkProof: StoredSession['zkProof']
): void {
  if (typeof window === 'undefined') return;

  const session: StoredSession = {
    ephemeralSecretKey: serializeKeyPair(ephemeralKeyPair),
    maxEpoch,
    randomness,
    jwt,
    salt,
    suiAddress,
    googleEmail,
    inviteCode,
    zkProof,
    createdAt: Date.now(),
  };

  sessionStorage.setItem(ZKLOGIN_SESSION_KEY, JSON.stringify(session));

  // Clear pending state since we now have a complete session
  clearPendingZkLogin();
}

/**
 * Get current zkLogin session
 */
export function getZkLoginSession(): ZkLoginSession | null {
  if (typeof window === 'undefined') return null;

  const data = sessionStorage.getItem(ZKLOGIN_SESSION_KEY);
  if (!data) return null;

  try {
    const stored = JSON.parse(data) as StoredSession;

    // Reconstruct keypair from secret key
    const ephemeralKeyPair = deserializeKeyPair(stored.ephemeralSecretKey);

    return {
      ephemeralKeyPair,
      maxEpoch: stored.maxEpoch,
      randomness: stored.randomness,
      jwt: stored.jwt,
      salt: stored.salt,
      suiAddress: stored.suiAddress,
      googleEmail: stored.googleEmail,
      inviteCode: stored.inviteCode,
      zkProof: stored.zkProof,
      createdAt: stored.createdAt,
    };
  } catch (error) {
    console.error('Failed to restore zkLogin session:', error);
    clearZkLoginSession();
    return null;
  }
}

/**
 * Clear zkLogin session (logout)
 */
export function clearZkLoginSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ZKLOGIN_SESSION_KEY);
  clearPendingZkLogin();
}

/**
 * Check if zkLogin session is still valid (not expired)
 */
export async function isSessionValid(session: ZkLoginSession): Promise<boolean> {
  try {
    // Import dynamically to avoid circular deps
    const { getCurrentEpoch, EPOCH_BUFFER } = await import('./index');
    const currentEpoch = await getCurrentEpoch();

    // Session is valid if we're still before maxEpoch - buffer
    return currentEpoch < session.maxEpoch - EPOCH_BUFFER;
  } catch {
    return false;
  }
}

/**
 * Get SUI address from current session (convenience function)
 */
export function getSuiAddressFromSession(): string | null {
  const session = getZkLoginSession();
  return session?.suiAddress || null;
}
