/**
 * SUI Blockchain Integration
 *
 * Main export file for all SUI-related functionality.
 */

// Client utilities
export {
  getSuiClient,
  getCurrentNetwork,
  getUsdcType,
  getUsdcCoins,
  getUsdcBalance,
  getSuiBalance,
  hasEnoughUsdc,
  isValidSuiAddress,
  usdcToUnits,
  unitsToUsdc,
  formatUsdc,
  USDC_TYPE,
  type SuiNetwork,
} from './client';

// Payment splitting
export {
  buildSplitPaymentTransaction,
  buildSplitPaymentForSponsorship,
  buildSimpleTransfer,
  aggregatedPaymentToRecipients,
  type PaymentRecipient,
  type SplitPaymentParams,
  type SplitPaymentResult,
  type AggregatedPayment,
} from './payment-splitter';

// Gas sponsorship
export {
  sponsorTransaction,
  executeSponsoredTransaction,
  checkSponsorBalance,
  estimateGasCost,
  type SponsorshipResult,
  type ExecutionResult,
} from './gas-sponsor';

// Keypair management for persona wallets
export {
  generateKeypair,
  getAddressFromKeypair,
  encryptKeypair,
  decryptKeypair,
  generateEncryptedKeypair,
  verifyKeypairAddress,
  signWithKeypair,
  type EncryptedKeypair,
} from './keypair-manager';
