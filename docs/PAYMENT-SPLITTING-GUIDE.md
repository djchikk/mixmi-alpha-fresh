# Music Payment Splitting Smart Contract - Complete Guide

## Table of Contents
- [Overview](#overview)
- [Contract Details](#contract-details)
- [How It Works](#how-it-works)
- [Testing Results](#testing-results)
- [Integration Guide](#integration-guide)
- [API Reference](#api-reference)
- [Deployment Info](#deployment-info)

---

## Overview

The Mixmi payment splitting system ensures fair compensation for all music contributors by automatically distributing purchase funds between composition (idea) and sound recording (production) rights holders.

**Key Features:**
- ✅ 50/50 split between composition and production rights
- ✅ Up to 3 contributors per category
- ✅ Percentage-based distribution
- ✅ Handles all edge cases (thirds, dust, weird percentages)
- ✅ Atomic transactions (all succeed or all fail)
- ✅ Deployed and tested on Stacks testnet

---

## Contract Details

### Deployed Contract
- **Network:** Stacks Testnet (Testnet4)
- **Contract Address:** `ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB`
- **Contract Name:** `music-payment-splitter`
- **Full Identifier:** `ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB.music-payment-splitter`
- **Language:** Clarity v3
- **Deployment Date:** October 6, 2025

### Contract Location
- **Source Code:** `/contracts/mixmi-payment-splitter/contracts/music-payment-splitter.clar`
- **Clarinet Config:** `/contracts/mixmi-payment-splitter/Clarinet.toml`
- **Deployment Plan:** `/contracts/mixmi-payment-splitter/deployments/default.testnet-plan.yaml`

### Explorer Links
- **Testnet:** https://explorer.hiro.so/txid/ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB.music-payment-splitter?chain=testnet
- **Call Functions:** Scroll to "Available functions" → `split-track-payment`

---

## How It Works

### Payment Structure

Every music purchase is split into two equal pools:

```
Purchase Price (e.g., 2.5 STX)
├── 50% Composition Pool (1.25 STX)
│   └── Distributed among composition contributors by %
└── 50% Production Pool (1.25 STX)
    └── Distributed among production contributors by %
```

### Example Transaction

**Purchase:** 2.5 STX track

**Composition Rights (1.25 STX pool):**
- Alice: 60% → receives 0.75 STX
- Bob: 40% → receives 0.50 STX

**Sound Recording Rights (1.25 STX pool):**
- Charlie: 70% → receives 0.875 STX
- Dana: 30% → receives 0.375 STX

**Total distributed: 2.5 STX** ✅

### Rounding & Dust

The contract uses integer division, which can create small amounts of "dust" (< 0.01 STX) from rounding. This is standard blockchain practice and acceptable for micro-payments.

**Example:**
- 1.0 STX ÷ 3 = 333,333 + 333,333 + 333,333 = 999,999 microSTX
- Missing: 1 microSTX (0.000001 STX)

The contract accepts this minimal loss rather than complex tracking.

---

## Testing Results

All tests conducted on Stacks Testnet4 (October 6, 2025)

### Test 1: Three-Way Uneven Split (33/33/34)
**Amount:** 1.0 STX

**Composition:** Bob 33%, Charlie 33%, Dora 34%
**Production:** Eve 33%, Frank 33%, Grace 34%

**Result:** ✅ Perfect distribution
- Each 33% recipient: ~0.165 STX
- Each 34% recipient: ~0.17 STX

### Test 2: Maximum Contributors
**Amount:** 3.0 STX

**Composition:** Bob 50%, Charlie 30%, Dora 20%
**Production:** Eve 25%, Frank 25%, Grace 50%

**Result:** ✅ All percentages distributed correctly
- Bob: 0.75 STX
- Charlie: 0.45 STX
- Dora: 0.30 STX
- Eve: 0.375 STX
- Frank: 0.375 STX
- Grace: 0.75 STX

### Test 3: Weird Percentages
**Amount:** 2.0 STX

**Composition:** Bob 17%, Charlie 83%
**Production:** Eve 73%, Frank 27%

**Result:** ✅ Handled flawlessly
- Bob: 0.17 STX
- Charlie: 0.83 STX
- Eve: 0.73 STX
- Frank: 0.27 STX

### Test 4: Dust Test (Minimum Amount)
**Amount:** 0.01 STX (10,000 microSTX)

**Composition:** Bob 50%, Charlie 50%
**Production:** Eve 100%

**Result:** ✅ Micro-payments work perfectly
- Bob: 0.0025 STX
- Charlie: 0.0025 STX
- Eve: 0.005 STX

---

## Integration Guide

### Step 1: Backend API

The API fetches payment splits from the database and formats them for the smart contract.

**Endpoint:** `/api/calculate-payment-splits`

**Request:**
```
GET /api/calculate-payment-splits?trackId=abc123
```

**Response:**
```json
{
  "trackId": "abc123",
  "title": "My Track",
  "artist": "Artist Name",
  "totalPriceMicroSTX": 2500000,
  "compositionSplits": [
    { "wallet": "ST3C6XJR...", "percentage": 60 },
    { "wallet": "ST4V544T...", "percentage": 40 }
  ],
  "productionSplits": [
    { "wallet": "ST60C6T2...", "percentage": 100 }
  ]
}
```

### Step 2: Frontend Integration

Use the helper functions in `lib/payment-splitter-integration.ts`:

```typescript
import { purchaseTrack } from '@/lib/payment-splitter-integration';

// Complete purchase flow
await purchaseTrack({
  trackId: 'abc123',
  onFinish: (data) => {
    console.log('Purchase complete!', data.txId);
    // Clear cart, show success message
  },
  onCancel: () => {
    console.log('User cancelled');
  }
});
```

### Step 3: Preview Splits (Optional)

Show users where their money goes before purchase:

```typescript
import { previewPaymentSplits } from '@/lib/payment-splitter-integration';

const preview = await previewPaymentSplits('abc123');

console.log(preview);
// {
//   trackId: 'abc123',
//   title: 'My Track',
//   totalPrice: 2.5,
//   compositionPayments: [
//     { wallet: 'ST3C6...', percentage: 60, amountSTX: 0.75 }
//   ],
//   productionPayments: [
//     { wallet: 'ST60C...', percentage: 100, amountSTX: 1.25 }
//   ]
// }
```

---

## API Reference

### Smart Contract Functions

#### `split-track-payment`
Main payment distribution function.

**Parameters:**
- `total-price` (uint): Total purchase price in microSTX (1 STX = 1,000,000 microSTX)
- `composition-splits` (list): List of `{wallet: principal, percentage: uint}`
- `recording-splits` (list): List of `{wallet: principal, percentage: uint}`

**Example (Clarity):**
```clarity
(contract-call?
  'ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB.music-payment-splitter
  split-track-payment
  u2500000  ;; 2.5 STX
  (list
    {wallet: 'ST3C6XJR..., percentage: u60}
    {wallet: 'ST4V544T..., percentage: u40}
  )
  (list
    {wallet: 'ST60C6T2..., percentage: u100}
  )
)
```

#### `get-composition-pool`
Read-only function to calculate composition pool amount.

**Parameters:**
- `total-price` (uint): Total price in microSTX

**Returns:** `(ok uint)` - Amount in microSTX

#### `get-recording-pool`
Read-only function to calculate recording pool amount.

**Parameters:**
- `total-price` (uint): Total price in microSTX

**Returns:** `(ok uint)` - Amount in microSTX

#### `calculate-payment`
Read-only function to calculate individual payment amount.

**Parameters:**
- `pool-amount` (uint): Pool size in microSTX
- `percentage` (uint): Percentage (0-100)

**Returns:** `(ok uint)` - Payment amount in microSTX

#### `validate-percentages`
Read-only function to check if percentages add up to 100%.

**Parameters:**
- `splits` (list): List of `{wallet: principal, percentage: uint}`

**Returns:** `(ok bool)` - True if valid, false if not

### Frontend Helper Functions

#### `executePaymentSplit(params)`
Execute smart contract payment split.

**Parameters:**
```typescript
{
  trackId: string;
  totalPriceMicroSTX: number;
  compositionSplits: Array<{wallet: string, percentage: number}>;
  productionSplits: Array<{wallet: string, percentage: number}>;
  onFinish: (data: any) => void;
  onCancel: () => void;
}
```

#### `fetchPaymentSplits(trackId)`
Fetch payment splits from backend API.

**Returns:**
```typescript
{
  trackId: string;
  title: string;
  artist: string;
  totalPriceMicroSTX: number;
  compositionSplits: Array<{wallet: string, percentage: number}>;
  productionSplits: Array<{wallet: string, percentage: number}>;
}
```

#### `purchaseTrack(params)`
Complete purchase flow (API fetch + smart contract execution).

**Parameters:**
```typescript
{
  trackId: string;
  onFinish: (data: any) => void;
  onCancel: () => void;
}
```

#### `previewPaymentSplits(trackId)`
Preview payment distribution without executing.

**Returns:**
```typescript
{
  trackId: string;
  title: string;
  artist: string;
  totalPrice: number; // in STX
  compositionPayments: Array<{
    wallet: string;
    percentage: number;
    amountSTX: number;
  }>;
  productionPayments: Array<{
    wallet: string;
    percentage: number;
    amountSTX: number;
  }>;
}
```

---

## Deployment Info

### Environment Variables

Add to `.env.local`:

```bash
# Stacks Network ('testnet' or 'mainnet')
NEXT_PUBLIC_STACKS_NETWORK=testnet

# Contract address (testnet)
NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT=ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB
```

For mainnet deployment, change to:
```bash
NEXT_PUBLIC_STACKS_NETWORK=mainnet
NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT=<mainnet-contract-address>
```

### Deploy New Contract

If you need to deploy to mainnet or a new testnet:

1. **Setup Clarinet:**
   ```bash
   cd contracts/mixmi-payment-splitter
   ```

2. **Update settings/Testnet.toml (or Mainnet.toml):**
   ```toml
   [accounts.deployer]
   mnemonic = "your twelve or twenty four word seed phrase here"
   ```

3. **Generate deployment plan:**
   ```bash
   clarinet deployments generate --testnet --medium-cost
   # or for mainnet:
   clarinet deployments generate --mainnet --medium-cost
   ```

4. **Deploy:**
   ```bash
   clarinet deployments apply --testnet
   # or for mainnet:
   clarinet deployments apply --mainnet
   ```

5. **Update environment variables** with new contract address

### Testing New Deployment

Use the test page at `/test-payment-splitter` or test via Stacks Explorer:

1. Go to: `https://explorer.hiro.so/txid/YOUR-CONTRACT-ADDRESS.music-payment-splitter?chain=testnet`
2. Click "Available functions" → `split-track-payment`
3. Fill in test parameters
4. Approve in wallet
5. Verify recipients received correct amounts

---

## Database Schema

The `ip_tracks` table must have these fields for payment splitting:

```sql
-- Composition splits (up to 3 owners)
composition_split_1_wallet: varchar
composition_split_1_percentage: integer
composition_split_2_wallet: varchar (nullable)
composition_split_2_percentage: integer (nullable)
composition_split_3_wallet: varchar (nullable)
composition_split_3_percentage: integer (nullable)

-- Production splits (up to 3 owners)
production_split_1_wallet: varchar
production_split_1_percentage: integer
production_split_2_wallet: varchar (nullable)
production_split_2_percentage: integer (nullable)
production_split_3_wallet: varchar (nullable)
production_split_3_percentage: integer (nullable)

-- Track price
price_stx: decimal
```

**Validation Rules:**
- Composition percentages must add up to 100%
- Production percentages must add up to 100%
- At least 1 split required per category
- Maximum 3 splits per category

---

## Security Considerations

### Post-Conditions
Always use post-conditions when calling the contract to ensure:
- Exact STX amount is transferred
- Transaction fails if amounts don't match

**Example:**
```typescript
postConditions: [
  makeStandardSTXPostCondition(
    userAddress,
    FungibleConditionCode.Equal,
    totalPriceMicroSTX
  )
]
```

### Contract Safety Features
- ✅ **Atomic transactions** - All payments succeed or all fail
- ✅ **No reentrancy** - Clarity prevents this by design
- ✅ **Input validation** - Price and splits validated
- ✅ **Immutable** - Contract cannot be changed after deployment

### Gas Costs
- Typical transaction: ~5,000-15,000 microSTX (~$0.03-$0.10)
- Varies based on number of splits
- Post-conditions add minimal cost

---

## Troubleshooting

### "Not a valid contract"
- Check you're on the correct network (testnet vs mainnet)
- Verify contract address is correct
- Ensure wallet is connected to same network

### "Post condition failed"
- Verify post-condition amount matches total-price parameter
- Check user has sufficient balance (price + gas fees)

### "Checksum mismatch"
- One of the wallet addresses has a typo
- Copy addresses directly, don't type manually

### Percentages don't add up
- Backend API will return 400 error
- Check database: composition % and production % must each sum to 100

---

## Future Enhancements

### Phase 2: Batch Cart Payments
Support multiple tracks from different artists in a single transaction:
- Aggregate all splits across cart items
- Combine payments to same wallet
- Execute as one atomic transaction

**Benefits:**
- Lower gas fees (one transaction instead of many)
- Better UX (one wallet approval instead of multiple)
- Simplified accounting

---

## Support

**Documentation:**
- This guide: `/docs/PAYMENT-SPLITTING-GUIDE.md`
- Contract README: `/contracts/README.md`
- Integration example: `/lib/payment-splitter-integration.ts`

**Contract Code:**
- Source: `/contracts/mixmi-payment-splitter/contracts/music-payment-splitter.clar`
- Tests: Manual testing via `/test-payment-splitter` page

**Questions:**
- Check GitHub Issues
- Review test results in this document
- Test on testnet before mainnet

---

**Built with ❤️ for fair music compensation**
**Powered by Stacks blockchain and Bitcoin**
