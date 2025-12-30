# SUI Payment Implementation Guide

Technical implementation plan for USDC payments on SUI blockchain.
**Created:** December 29, 2025

---

## Architecture Overview

### Design Principles

1. **Pure On-Chain**: Every payment is a real SUI transaction - no off-chain credits
2. **Direct to Recipients**: Payments go straight to creators, no platform escrow
3. **Gas Sponsorship**: Platform pays gas fees so users only need USDC
4. **Immediate Settlement**: Creators receive funds instantly, even micro-payments

### Transaction Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CART CHECKOUT FLOW                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User clicks "Purchase"                                               │
│     │                                                                    │
│     ▼                                                                    │
│  2. Frontend builds transaction (onlyTransactionKind: true)              │
│     │                                                                    │
│     ▼                                                                    │
│  3. User signs transaction intent (proves they want to pay)              │
│     │                                                                    │
│     ▼                                                                    │
│  4. Backend receives signed intent, adds gas sponsorship                 │
│     │                                                                    │
│     ▼                                                                    │
│  5. Platform wallet signs as gas sponsor                                 │
│     │                                                                    │
│     ▼                                                                    │
│  6. Dual-signed transaction submitted to SUI                             │
│     │                                                                    │
│     ▼                                                                    │
│  7. Smart contract splits USDC to all recipients atomically              │
│     │                                                                    │
│     ▼                                                                    │
│  8. Creators receive USDC instantly in their wallets                     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Token Addresses

### USDC on SUI

| Network | Package ID | Type |
|---------|-----------|------|
| **Mainnet** | `0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7` | `::usdc::USDC` |
| **Testnet** | `0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29` | `::usdc::USDC` |

**Full Type String (Mainnet):**
```
0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
```

**Note:** USDC has 6 decimal places. $1.00 = 1,000,000 units.

---

## Smart Contract Design

### Option A: No Custom Contract (Recommended for MVP)

SUI's Programmable Transaction Blocks (PTBs) can handle payment splitting WITHOUT a custom smart contract!

```typescript
// PTB can do coin splitting natively:
const tx = new Transaction();

// Split the user's USDC coin into amounts for each recipient
const [coin1, coin2, coin3] = tx.splitCoins(userUsdcCoin, [
  tx.pure.u64(2_000_000),  // $2.00 to Alice
  tx.pure.u64(500_000),    // $0.50 to Bob
  tx.pure.u64(500_000),    // $0.50 to Charlie
]);

// Transfer to each recipient
tx.transferObjects([coin1], tx.pure.address(aliceAddress));
tx.transferObjects([coin2], tx.pure.address(bobAddress));
tx.transferObjects([coin3], tx.pure.address(charlieAddress));
```

**Pros:**
- No contract deployment needed
- Simpler, faster to implement
- Native SUI functionality
- Easy to audit

**Cons:**
- Less structured
- No on-chain validation of percentages

### Option B: Custom Move Contract

For future-proofing and cleaner separation:

```move
// contracts/sui/payment_splitter/sources/payment_splitter.move

module mixmi::payment_splitter {
    use sui::coin::{Self, Coin};
    use sui::transfer;
    use sui::tx_context::TxContext;

    /// Error codes
    const E_INVALID_AMOUNTS: u64 = 1;
    const E_MISMATCHED_LENGTHS: u64 = 2;

    /// Split a coin payment among multiple recipients
    /// Each recipient receives the specified amount
    public entry fun split_payment<CoinType>(
        payment: Coin<CoinType>,
        recipients: vector<address>,
        amounts: vector<u64>,
        ctx: &mut TxContext
    ) {
        let len = vector::length(&recipients);
        assert!(len == vector::length(&amounts), E_MISMATCHED_LENGTHS);

        let mut remaining = payment;
        let mut i = 0;

        while (i < len) {
            let recipient = *vector::borrow(&recipients, i);
            let amount = *vector::borrow(&amounts, i);

            // Split off the amount for this recipient
            let split_coin = coin::split(&mut remaining, amount, ctx);
            transfer::public_transfer(split_coin, recipient);

            i = i + 1;
        };

        // Transfer any dust to the last recipient (or could go to platform)
        let last_recipient = *vector::borrow(&recipients, len - 1);
        transfer::public_transfer(remaining, last_recipient);
    }
}
```

---

## TypeScript Integration

### File: `lib/sui/sui-client.ts`

```typescript
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

// USDC type strings
export const USDC_TYPE = {
  mainnet: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC',
  testnet: '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
} as const;

// Initialize SUI client
export function getSuiClient(network: 'mainnet' | 'testnet' = 'testnet') {
  return new SuiClient({ url: getFullnodeUrl(network) });
}

// Get USDC coins for an address
export async function getUsdcCoins(
  client: SuiClient,
  address: string,
  network: 'mainnet' | 'testnet' = 'testnet'
) {
  const coins = await client.getCoins({
    owner: address,
    coinType: USDC_TYPE[network],
  });
  return coins.data;
}
```

### File: `lib/sui/payment-splitter.ts`

```typescript
import { Transaction } from '@mysten/sui/transactions';
import { getSuiClient, USDC_TYPE, getUsdcCoins } from './sui-client';

interface PaymentRecipient {
  address: string;      // SUI address
  amountUsdc: number;   // Amount in USDC (e.g., 2.50 for $2.50)
}

interface SplitPaymentParams {
  senderAddress: string;
  recipients: PaymentRecipient[];
  network?: 'mainnet' | 'testnet';
}

/**
 * Build a transaction to split USDC payment among multiple recipients
 * Returns transaction bytes for user signing
 */
export async function buildSplitPaymentTransaction({
  senderAddress,
  recipients,
  network = 'testnet',
}: SplitPaymentParams): Promise<Uint8Array> {
  const client = getSuiClient(network);

  // Get sender's USDC coins
  const usdcCoins = await getUsdcCoins(client, senderAddress, network);

  if (usdcCoins.length === 0) {
    throw new Error('No USDC found in wallet');
  }

  // Calculate total needed (USDC has 6 decimals)
  const totalNeeded = recipients.reduce(
    (sum, r) => sum + Math.floor(r.amountUsdc * 1_000_000),
    0
  );

  // Build transaction
  const tx = new Transaction();
  tx.setSender(senderAddress);

  // If multiple USDC coins, merge them first
  let primaryCoin;
  if (usdcCoins.length > 1) {
    const [first, ...rest] = usdcCoins;
    primaryCoin = tx.object(first.coinObjectId);
    tx.mergeCoins(
      primaryCoin,
      rest.map(c => tx.object(c.coinObjectId))
    );
  } else {
    primaryCoin = tx.object(usdcCoins[0].coinObjectId);
  }

  // Split coins for each recipient
  const amounts = recipients.map(r =>
    tx.pure.u64(Math.floor(r.amountUsdc * 1_000_000))
  );

  const splitCoins = tx.splitCoins(primaryCoin, amounts);

  // Transfer to each recipient
  recipients.forEach((recipient, index) => {
    tx.transferObjects(
      [splitCoins[index]],
      tx.pure.address(recipient.address)
    );
  });

  // Build as transaction kind only (for sponsorship)
  const kindBytes = await tx.build({
    client,
    onlyTransactionKind: true
  });

  return kindBytes;
}

/**
 * Convert cart items with splits to recipient list
 */
export function cartToRecipients(
  aggregatedPayment: {
    compositionSplits: { wallet: string; percentage: number }[];
    productionSplits: { wallet: string; percentage: number }[];
    totalPriceUsdc: number;
  }
): PaymentRecipient[] {
  const recipients: PaymentRecipient[] = [];
  const compPool = aggregatedPayment.totalPriceUsdc / 2;
  const prodPool = aggregatedPayment.totalPriceUsdc / 2;

  // Add composition recipients
  aggregatedPayment.compositionSplits.forEach(split => {
    const amount = (compPool * split.percentage) / 100;
    const existing = recipients.find(r => r.address === split.wallet);
    if (existing) {
      existing.amountUsdc += amount;
    } else {
      recipients.push({ address: split.wallet, amountUsdc: amount });
    }
  });

  // Add production recipients
  aggregatedPayment.productionSplits.forEach(split => {
    const amount = (prodPool * split.percentage) / 100;
    const existing = recipients.find(r => r.address === split.wallet);
    if (existing) {
      existing.amountUsdc += amount;
    } else {
      recipients.push({ address: split.wallet, amountUsdc: amount });
    }
  });

  return recipients;
}
```

### File: `lib/sui/gas-sponsor.ts`

```typescript
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getSuiClient } from './sui-client';

/**
 * Sponsor a transaction by adding gas payment
 * Called from backend API route (keeps sponsor key secure)
 */
export async function sponsorTransaction(
  kindBytes: Uint8Array,
  senderAddress: string,
  sponsorKeypair: Ed25519Keypair,
  network: 'mainnet' | 'testnet' = 'testnet'
) {
  const client = getSuiClient(network);
  const sponsorAddress = sponsorKeypair.toSuiAddress();

  // Reconstruct transaction from kind bytes
  const tx = Transaction.fromKind(kindBytes);

  // Set sender and sponsor
  tx.setSender(senderAddress);
  tx.setGasOwner(sponsorAddress);

  // Get sponsor's gas coins
  const gasCoins = await client.getCoins({
    owner: sponsorAddress,
    coinType: '0x2::sui::SUI',
  });

  if (gasCoins.data.length === 0) {
    throw new Error('Sponsor has no SUI for gas');
  }

  // Set gas payment
  tx.setGasPayment(gasCoins.data.slice(0, 1).map(c => ({
    objectId: c.coinObjectId,
    version: c.version,
    digest: c.digest,
  })));

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
 * Execute a sponsored transaction after user signs
 */
export async function executeSponsored(
  txBytes: Uint8Array,
  userSignature: string,
  sponsorSignature: string,
  network: 'mainnet' | 'testnet' = 'testnet'
) {
  const client = getSuiClient(network);

  const result = await client.executeTransactionBlock({
    transactionBlock: txBytes,
    signature: [userSignature, sponsorSignature],
    options: {
      showEffects: true,
      showEvents: true,
    },
  });

  return result;
}
```

---

## API Routes

### File: `app/api/sui/sponsor-transaction/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { sponsorTransaction } from '@/lib/sui/gas-sponsor';

// Platform's gas sponsor keypair (from env)
function getSponsorKeypair(): Ed25519Keypair {
  const privateKey = process.env.SUI_SPONSOR_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SUI_SPONSOR_PRIVATE_KEY not configured');
  }
  return Ed25519Keypair.fromSecretKey(Buffer.from(privateKey, 'hex'));
}

export async function POST(request: NextRequest) {
  try {
    const { kindBytes, senderAddress } = await request.json();

    if (!kindBytes || !senderAddress) {
      return NextResponse.json(
        { error: 'Missing kindBytes or senderAddress' },
        { status: 400 }
      );
    }

    const sponsorKeypair = getSponsorKeypair();
    const network = process.env.SUI_NETWORK as 'mainnet' | 'testnet' || 'testnet';

    const { txBytes, sponsorSignature } = await sponsorTransaction(
      new Uint8Array(Buffer.from(kindBytes, 'base64')),
      senderAddress,
      sponsorKeypair,
      network
    );

    return NextResponse.json({
      txBytes: Buffer.from(txBytes).toString('base64'),
      sponsorSignature,
    });
  } catch (error) {
    console.error('Sponsor error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sponsorship failed' },
      { status: 500 }
    );
  }
}
```

### File: `app/api/sui/execute-transaction/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { executeSponsored } from '@/lib/sui/gas-sponsor';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const {
      txBytes,
      userSignature,
      sponsorSignature,
      purchaseData  // { cartItems, buyerAddress }
    } = await request.json();

    const network = process.env.SUI_NETWORK as 'mainnet' | 'testnet' || 'testnet';

    const result = await executeSponsored(
      new Uint8Array(Buffer.from(txBytes, 'base64')),
      userSignature,
      sponsorSignature,
      network
    );

    // Record purchase in database
    if (purchaseData?.cartItems) {
      for (const item of purchaseData.cartItems) {
        await supabase.from('purchases').insert({
          buyer_wallet: purchaseData.buyerAddress,
          track_id: item.id,
          price_usdc: parseFloat(item.price_usdc),
          tx_hash: result.digest,
        });
      }
    }

    return NextResponse.json({
      success: true,
      txHash: result.digest,
      effects: result.effects,
    });
  } catch (error) {
    console.error('Execute error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Execution failed' },
      { status: 500 }
    );
  }
}
```

---

## Frontend Integration

### Updated `CartContext.tsx` (key changes)

```typescript
// Replace Stacks imports with SUI
import { buildSplitPaymentTransaction, cartToRecipients } from '@/lib/sui/payment-splitter';

const purchaseAll = async () => {
  if (!isAuthenticated || !suiAddress) {
    setPurchaseError('Please connect your wallet first');
    return;
  }

  try {
    setPurchaseStatus('pending');

    // 1. Fetch splits for all cart items
    const tracksWithSplits = await Promise.all(
      cart.map(async (item) => {
        const response = await fetch(`/api/calculate-payment-splits?trackId=${item.id}`);
        return response.json();
      })
    );

    // 2. Aggregate payments (reuse existing logic)
    const aggregated = aggregateCartPayments(tracksWithSplits);

    // 3. Convert to SUI recipients (with SUI addresses)
    const recipients = cartToRecipients({
      ...aggregated,
      totalPriceUsdc: aggregated.totalPriceMicroSTX / 1_000_000, // Convert
    });

    // 4. Build transaction
    const kindBytes = await buildSplitPaymentTransaction({
      senderAddress: suiAddress,
      recipients,
      network: process.env.NEXT_PUBLIC_SUI_NETWORK as 'mainnet' | 'testnet',
    });

    // 5. Get sponsorship from backend
    const sponsorRes = await fetch('/api/sui/sponsor-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kindBytes: Buffer.from(kindBytes).toString('base64'),
        senderAddress: suiAddress,
      }),
    });
    const { txBytes, sponsorSignature } = await sponsorRes.json();

    // 6. User signs (using zkLogin or wallet)
    const userSignature = await signTransaction(txBytes); // From wallet

    // 7. Execute sponsored transaction
    const executeRes = await fetch('/api/sui/execute-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txBytes,
        userSignature,
        sponsorSignature,
        purchaseData: { cartItems: cart, buyerAddress: suiAddress },
      }),
    });

    const { txHash } = await executeRes.json();

    setPurchaseStatus('success');
    clearCart();

  } catch (error) {
    setPurchaseError(error.message);
    setPurchaseStatus('error');
  }
};
```

---

## Environment Variables

Add to `.env.local`:

```bash
# SUI Network Configuration
SUI_NETWORK=testnet
NEXT_PUBLIC_SUI_NETWORK=testnet

# Gas Sponsor Wallet (KEEP SECRET - server-side only)
SUI_SPONSOR_PRIVATE_KEY=your_hex_encoded_private_key_here

# USDC Token Type
NEXT_PUBLIC_USDC_TYPE_TESTNET=0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC
NEXT_PUBLIC_USDC_TYPE_MAINNET=0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC
```

---

## Setup Instructions

### 1. Install SUI CLI

```bash
# macOS
brew install sui

# Or cargo
cargo install --locked --git https://github.com/MystenLabs/sui.git sui
```

### 2. Create Sponsor Wallet

```bash
# Generate new keypair
sui client new-address ed25519

# Or import existing
sui keytool import <mnemonic> ed25519

# Get address
sui client active-address

# Export private key (for .env)
sui keytool export --key-identity <address>
```

### 3. Fund Sponsor Wallet (Testnet)

```bash
# Request testnet SUI from faucet
sui client faucet
```

### 4. Get Testnet USDC

- Use Circle's testnet faucet or
- Bridge from another testnet

### 5. Install NPM Packages

```bash
npm install @mysten/sui @mysten/zklogin
```

---

## Critical Considerations

### 1. Address Mapping Problem

**Issue:** Tracks have STX wallet addresses in `ip_tracks.composition_split_1_wallet`, but we need SUI addresses for payments.

**Solutions:**
- A) Add `sui_address` column to `personas` (already exists as `payout_address`)
- B) Create lookup table `wallet_mappings (stx_address, sui_address)`
- C) Require all recipients to have linked SUI addresses before purchasing

**Recommendation:** Use `personas.payout_address` for SUI addresses. Update split calculation to look up SUI addresses.

### 2. TBD Wallets

For recipients without SUI addresses:
- Skip in on-chain split
- Record debt in `tbd_wallets` table
- Pay out when they create account and add SUI address

### 3. Dust Handling

With integer math, small amounts may round to 0. Options:
- Send dust to platform address
- Send dust to last recipient
- Minimum payment threshold ($0.01)

### 4. zkLogin Signing

zkLogin users need special signing flow:
```typescript
// zkLogin signature generation
import { getZkLoginSignature } from '@mysten/zklogin';

const zkLoginSignature = await getZkLoginSignature({
  inputs: zkLoginInputs,
  maxEpoch,
  userSignature: userSignature,
});
```

---

## Testing Checklist

- [ ] Sponsor wallet has SUI balance
- [ ] Test wallet has testnet USDC
- [ ] Single recipient payment works
- [ ] Multi-recipient split works
- [ ] Dust handling works correctly
- [ ] Gas sponsorship works
- [ ] zkLogin signing works
- [ ] Database records created correctly
- [ ] Error handling for insufficient USDC
- [ ] Error handling for missing recipients

---

## Migration Plan

### Phase 1: Testnet (Week 1)
1. Set up SUI dev environment
2. Create sponsor wallet
3. Implement SUI SDK integration
4. Test with hardcoded addresses

### Phase 2: Integration (Week 2)
1. Add address mapping logic
2. Update CartContext
3. Test full checkout flow
4. Handle edge cases

### Phase 3: Mainnet (Week 3)
1. Deploy to mainnet
2. Fund mainnet sponsor wallet
3. Update environment configs
4. Gradual rollout

---

## Sources

- [Circle USDC on SUI Quickstart](https://developers.circle.com/stablecoins/quickstart-setup-transfer-usdc-sui)
- [SUI Sponsored Transactions](https://docs.sui.io/concepts/transactions/sponsored-transactions)
- [Mysten TypeScript SDK - Sponsored Transactions](https://sdk.mystenlabs.com/typescript/transaction-building/sponsored-transactions)
- [Shinami Gas Station](https://docs.shinami.com/docs/gas-station-guide)
- [SUI Move Examples - USDC](https://github.com/MystenLabs/sui/blob/main/examples/move/usdc_usage/sources/example.move)

---

*Last updated: December 29, 2025*
