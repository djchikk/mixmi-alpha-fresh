/**
 * Generate a new Ed25519 keypair for SUI transaction sponsorship
 *
 * Run with: node scripts/generate-sponsor-wallet.js
 *
 * IMPORTANT: Save the output securely! The private key is needed for
 * the SUI_SPONSOR_PRIVATE_KEY environment variable.
 */

const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');

function toHexString(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSponsorWallet() {
  // Generate a new random Ed25519 keypair
  const keypair = new Ed25519Keypair();

  // Get the public address
  const address = keypair.getPublicKey().toSuiAddress();

  // Get the private key as hex (this is what you'll use for SUI_SPONSOR_PRIVATE_KEY)
  const privateKeyBytes = keypair.getSecretKey();
  const privateKeyHex = '0x' + toHexString(privateKeyBytes);

  console.log('\n========================================');
  console.log('   NEW SUI SPONSOR WALLET GENERATED');
  console.log('========================================\n');

  console.log('PUBLIC ADDRESS (for NEXT_PUBLIC_SUI_PLATFORM_ADDRESS):');
  console.log(`  ${address}\n`);

  console.log('PRIVATE KEY (for SUI_SPONSOR_PRIVATE_KEY):');
  console.log(`  ${privateKeyHex}\n`);

  console.log('========================================');
  console.log('           NEXT STEPS');
  console.log('========================================\n');

  console.log('1. Copy the PUBLIC ADDRESS above');
  console.log('2. Fund it with testnet SUI using one of these methods:\n');
  console.log('   curl -X POST https://faucet.testnet.sui.io/v2/gas \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log(`     -d '{"FixedAmountRequest":{"recipient":"${address}"}}'\n`);
  console.log('   Or visit: https://suiet.app/faucet\n');

  console.log('3. Add to Vercel environment variables:');
  console.log('   - NEXT_PUBLIC_SUI_NETWORK = testnet');
  console.log(`   - NEXT_PUBLIC_SUI_PLATFORM_ADDRESS = ${address}`);
  console.log('   - SUI_SPONSOR_PRIVATE_KEY = [the private key above]\n');

  console.log('4. SAVE THIS OUTPUT SECURELY - you cannot recover the private key!\n');

  console.log('========================================\n');
}

generateSponsorWallet();
