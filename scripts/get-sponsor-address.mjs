/**
 * Quick script to derive SUI address from private key
 * Usage: node scripts/get-sponsor-address.mjs YOUR_64_HEX_CHARS
 */

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

const privateKeyHex = process.argv[2];

if (!privateKeyHex) {
  console.error('Usage: node scripts/get-sponsor-address.mjs YOUR_64_HEX_CHARS');
  process.exit(1);
}

// Remove 0x prefix if present
const cleanKey = privateKeyHex.replace(/^0x/, '');

if (cleanKey.length !== 64) {
  console.error(`Error: Expected 64 hex characters, got ${cleanKey.length}`);
  process.exit(1);
}

const keypair = Ed25519Keypair.fromSecretKey(Buffer.from(cleanKey, 'hex'));
console.log('SUI Address:', keypair.toSuiAddress());
