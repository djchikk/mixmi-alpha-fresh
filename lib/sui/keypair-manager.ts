/**
 * Keypair Manager for Persona Wallets
 *
 * Generates and manages SUI keypairs for each persona, with encryption
 * tied to the manager's zkLogin credentials.
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import * as crypto from 'crypto';

// Server-side secret for key derivation (set in env)
const SERVER_SECRET = process.env.KEYPAIR_ENCRYPTION_SECRET || 'mixmi-default-secret-change-in-production';

/**
 * Encrypted keypair data stored in database
 */
export interface EncryptedKeypair {
  encryptedKey: string;  // Base64 encoded encrypted private key
  nonce: string;         // Base64 encoded nonce/IV
  suiAddress: string;    // Derived SUI address (public, not encrypted)
}

/**
 * Generate a new Ed25519 keypair for a persona
 */
export function generateKeypair(): Ed25519Keypair {
  return Ed25519Keypair.generate();
}

/**
 * Get the SUI address from a keypair
 */
export function getAddressFromKeypair(keypair: Ed25519Keypair): string {
  return keypair.getPublicKey().toSuiAddress();
}

/**
 * Derive an encryption key from the user's zkLogin salt and server secret
 *
 * @param userSalt - The user's zkLogin salt (unique to their OAuth identity)
 * @returns 32-byte encryption key
 */
export function deriveEncryptionKey(userSalt: string): Buffer {
  // Use HKDF to derive a strong encryption key
  return crypto.hkdfSync(
    'sha256',
    Buffer.from(userSalt, 'utf-8'),
    Buffer.from(SERVER_SECRET, 'utf-8'),
    Buffer.from('persona-keypair-encryption', 'utf-8'),
    32 // 256 bits for AES-256
  );
}

/**
 * Encrypt a keypair's private key for storage
 *
 * @param keypair - The keypair to encrypt
 * @param userSalt - The user's zkLogin salt
 * @returns Encrypted data for database storage
 */
export function encryptKeypair(
  keypair: Ed25519Keypair,
  userSalt: string
): EncryptedKeypair {
  const encryptionKey = deriveEncryptionKey(userSalt);

  // Get the private key bytes
  const privateKey = keypair.getSecretKey();

  // Generate a random nonce (12 bytes for GCM)
  const nonce = crypto.randomBytes(12);

  // Encrypt with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, nonce);
  const encrypted = Buffer.concat([
    cipher.update(privateKey, 'utf-8'),
    cipher.final(),
    cipher.getAuthTag() // 16 bytes
  ]);

  return {
    encryptedKey: encrypted.toString('base64'),
    nonce: nonce.toString('base64'),
    suiAddress: getAddressFromKeypair(keypair),
  };
}

/**
 * Decrypt a keypair from stored encrypted data
 *
 * @param encrypted - The encrypted data from database
 * @param userSalt - The user's zkLogin salt
 * @returns The decrypted keypair
 */
export function decryptKeypair(
  encrypted: EncryptedKeypair,
  userSalt: string
): Ed25519Keypair {
  const encryptionKey = deriveEncryptionKey(userSalt);

  const encryptedBuffer = Buffer.from(encrypted.encryptedKey, 'base64');
  const nonce = Buffer.from(encrypted.nonce, 'base64');

  // Extract auth tag (last 16 bytes)
  const authTag = encryptedBuffer.slice(-16);
  const ciphertext = encryptedBuffer.slice(0, -16);

  // Decrypt
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, nonce);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  // Reconstruct keypair from secret key
  return Ed25519Keypair.fromSecretKey(decrypted.toString('utf-8'));
}

/**
 * Generate a new encrypted keypair for a persona
 *
 * @param userSalt - The user's zkLogin salt
 * @returns Encrypted keypair data ready for database storage
 */
export function generateEncryptedKeypair(userSalt: string): EncryptedKeypair {
  const keypair = generateKeypair();
  return encryptKeypair(keypair, userSalt);
}

/**
 * Verify that a decrypted keypair matches the expected address
 *
 * @param keypair - The decrypted keypair
 * @param expectedAddress - The address stored in the database
 * @returns True if the keypair matches the address
 */
export function verifyKeypairAddress(
  keypair: Ed25519Keypair,
  expectedAddress: string
): boolean {
  return getAddressFromKeypair(keypair) === expectedAddress;
}

/**
 * Sign arbitrary bytes with a decrypted keypair
 *
 * @param keypair - The decrypted keypair
 * @param bytes - The bytes to sign
 * @returns The signature as base64 string
 */
export async function signWithKeypair(
  keypair: Ed25519Keypair,
  bytes: Uint8Array
): Promise<string> {
  const signature = await keypair.sign(bytes);
  return Buffer.from(signature).toString('base64');
}
