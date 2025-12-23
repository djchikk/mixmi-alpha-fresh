---
name: mixmi-payment-flow
description: Complete guide to mixmi's payment system including smart contracts, split calculations, and blockchain transactions
---

# mixmi Payment Flow

Complete reference for the payment system, smart contracts, and revenue distribution.

---

## Table of Contents

1. [Smart Contract Overview](#smart-contract-overview)
2. [Payment Split Calculations](#payment-split-calculations)
3. [Gen 1 Remix Payments](#gen-1-remix-payments)
4. [Transaction Flow](#transaction-flow)
5. [API Endpoints](#api-endpoints)
6. [Code Integration Points](#code-integration-points)

---

## Smart Contract Overview

### Deployed Contract: `music-payment-splitter-v3`

**Network:** Stacks Mainnet (Bitcoin Layer 2)
**Contract Address:** `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3`
**Language:** Clarity 2.0
**Deployment Date:** October 7, 2025
**Deployment Cost:** 0.041280 STX (~$0.50)
**Status:** ✅ Live and tested with real transactions

**Location:** `contracts/mixmi-payment-splitter/contracts/music-payment-splitter.clar`

**Explorer:** [View on Stacks Explorer](https://explorer.hiro.so/txid/0xd06bbc3488a4249083378ff8288b62a12e695d11ffc46077017138745ff49c39?chain=mainnet)

---

## Core Contract Function: `split-track-payment`

### Purpose
Automatically distribute STX payments to multiple contributors based on their composition and production ownership percentages.

### Function Signature

```clarity
(define-public (split-track-payment
  (total-price-microstx uint)
  (composition-splits (list 50 {wallet: principal, percentage: uint}))
  (production-splits (list 50 {wallet: principal, percentage: uint}))
))
```

### Input Parameters

1. **total-price-microstx** (uint)
   - Total payment amount in microSTX (1 STX = 1,000,000 microSTX)
   - Example: 2.5 STX = 2,500,000 microSTX

2. **composition-splits** (list)
   - Array of up to 50 contributors
   - Each entry: `{wallet: principal, percentage: uint}`
   - Percentages must total 100
   - Example: `[{wallet: SP123..., percentage: 50}, {wallet: SP456..., percentage: 50}]`

3. **production-splits** (list)
   - Same structure as composition-splits
   - Separate 100% pie from composition
   - Can have different contributors

### Output

```clarity
(ok {
  total-paid: uint,
  composition-count: uint,
  production-count: uint
})
```

### Distribution Logic

**Step 1: Split 50/50**
```
Total Payment = X STX

Composition Pool = X × 50% = X/2 STX
Production Pool = X × 50% = X/2 STX
```

**Step 2: Distribute Within Each Pool**
```
Each contributor receives:
  Pool Amount × Their Percentage

Example:
  Composition Pool: 1.25 STX
  Alice (50%): 1.25 × 50% = 0.625 STX
  Bob (50%): 1.25 × 50% = 0.625 STX
```

**Step 3: Handle Dust (Rounding)**
- Dust (rounding errors) added to first recipient in each category
- Ensures total distributed = total paid
- Example: 1.333333 STX → First person gets +0.000001 STX

---

## Payment Split Calculations

### The 50/50 Model

**Fundamental Principle:**
> Every track has TWO separate 100% pies:
> - Composition Rights (50% weight of revenue)
> - Production Rights (50% weight of revenue)

### Example 1: Simple Track (2 Contributors)

**Track:** Original loop created by Alice (composer) and Amy (producer)

**Attribution:**
- Composition: Alice 100%
- Production: Amy 100%

**Sale:** 2 STX

**Distribution:**
```
Composition Pool: 2 STX × 50% = 1 STX
  Alice: 1 STX × 100% = 1.0 STX

Production Pool: 2 STX × 50% = 1 STX
  Amy: 1 STX × 100% = 1.0 STX

Total: 2.0 STX ✅
```

---

### Example 2: Collaborative Track (4 Contributors)

**Track:** Loop with multiple contributors

**Attribution:**
- Composition: Alice 60%, Charlie 40%
- Production: Amy 70%, Betty 30%

**Sale:** 5 STX

**Distribution:**
```
Composition Pool: 5 STX × 50% = 2.5 STX
  Alice: 2.5 × 60% = 1.50 STX
  Charlie: 2.5 × 40% = 1.00 STX

Production Pool: 5 STX × 50% = 2.5 STX
  Amy: 2.5 × 70% = 1.75 STX
  Betty: 2.5 × 30% = 0.75 STX

Total: 1.50 + 1.00 + 1.75 + 0.75 = 5.0 STX ✅
```

---

## Gen 1 Remix Payments

### Two Payment Events

#### Event 1: Creating the Remix (Upfront Licensing)

**When:** Remixer loads 2 loops into mixer and clicks "Record"
**Amount:** 1 STX per loop (total: 2 STX)
**Recipients:** Original loop creators
**Purpose:** License fee to create derivative work

**Flow:**
```
Remixer (Grace) pays 2 STX →

Loop A (1 STX):
  Composition (0.5 STX):
    Alice 100% = 0.5 STX
  Production (0.5 STX):
    Amy 100% = 0.5 STX

Loop B (1 STX):
  Composition (0.5 STX):
    Bob 100% = 0.5 STX
  Production (0.5 STX):
    Betty 100% = 0.5 STX

Total distributed: 2 STX ✅
```

**Contract Used:** `music-payment-splitter-v3`
**Status:** ✅ Implemented and working

---

#### Event 2: Selling the Remix (Revenue Split)

**When:** Customer purchases the remix download from Grace's store
**Amount:** Whatever price Grace set (e.g., 3 STX)
**Recipients:** Grace (remixer) + original loop creators
**Purpose:** Revenue distribution

**The 20/80 Split:**
```
Sale Price: 3 STX

Remixer Commission: 3 × 20% = 0.6 STX → Grace
IP Holder Pool: 3 × 80% = 2.4 STX → Loop creators

IP Distribution (2.4 STX):
  Composition (50% = 1.2 STX):
    Alice (50% of remix comp): 0.6 STX
    Bob (50% of remix comp): 0.6 STX

  Production (50% = 1.2 STX):
    Amy (50% of remix prod): 0.6 STX
    Betty (50% of remix prod): 0.6 STX

Total: 0.6 + 0.6 + 0.6 + 0.6 + 0.6 = 3.0 STX ✅
```

**Status:** ❌ Not yet implemented (planned via API-based approach)

---

### Remix IP Attribution Formula

**For a Gen 1 remix using Loop A and Loop B:**

**Composition Attribution:**
```
For each composer in Loop A:
  Remix Composition % = (Loop A Composition %) × 50%

For each composer in Loop B:
  Remix Composition % = (Loop B Composition %) × 50%

Total must equal 100%
```

**Example:**
```
Loop A: Alice 100% composer
Loop B: Bob 100% composer

Remix composition:
  Alice: 100% × 50% = 50%
  Bob: 100% × 50% = 50%
  Total: 100% ✅
```

**Production Attribution:**
```
Same formula as composition, but for producers
```

**Implementation:** `lib/calculateRemixSplits.ts` (10.9KB)

---

## Transaction Flow

### End-to-End Purchase Flow

#### Step 1: User Adds Tracks to Cart

**Location:** Track cards (Globe, Store, Search)
**Action:** Click shopping cart icon
**State:** `CartContext` adds item to `cart` array
**Persistence:** LocalStorage (`mixmi-cart`)

**Cart Item Structure:**
```typescript
{
  id: string;              // Track UUID
  title: string;
  artist: string;
  price_stx: string;       // Uses download_price_stx (or legacy price_stx)
  license?: string;
  primary_uploader_wallet?: string;
}
```

---

#### Step 2: User Clicks "Purchase All"

**Location:** Cart dropdown in Header
**Validation:**
- Check wallet connected (`isAuthenticated`)
- Check cart not empty
- Check wallet has sufficient STX balance (future)

**Error States:**
- Not authenticated → "Please connect your wallet"
- Cart empty → No action
- Insufficient funds → Transaction fails at wallet level

---

#### Step 3: Fetch Payment Splits

**For each track in cart:**

**API Call:**
```javascript
const response = await fetch(
  `/api/calculate-payment-splits?trackId=${item.id}`
);
const data = await response.json();
```

**Response:**
```json
{
  "compositionSplits": [
    {"wallet": "SP...", "percentage": 50},
    {"wallet": "SP...", "percentage": 50}
  ],
  "productionSplits": [
    {"wallet": "SP...", "percentage": 50},
    {"wallet": "SP...", "percentage": 50}
  ]
}
```

**Code:** `contexts/CartContext.tsx` lines 130-145

---

#### Step 4: Aggregate Cart Payments

**Purpose:** Combine all tracks into single contract call

**Function:** `aggregateCartPayments(tracksWithSplits)`
**Location:** `lib/batch-payment-aggregator.ts`

**Input:**
```typescript
[
  {
    trackId: string,
    title: string,
    totalPriceMicroSTX: number,
    compositionSplits: [{wallet, percentage}],
    productionSplits: [{wallet, percentage}]
  },
  // ... more tracks
]
```

**Output:**
```typescript
{
  totalPriceMicroSTX: number,          // Sum of all track prices
  compositionSplits: [{wallet, percentage}],  // Consolidated
  productionSplits: [{wallet, percentage}]    // Consolidated
}
```

**Logic:**
- Combines duplicate wallets
- Recalculates percentages based on total
- Ensures 100% totals for each category

---

#### Step 5: Build Contract Call

**Library:** `@stacks/connect`

**Function:** `openContractCall(options)`

**Options:**
```javascript
{
  contractAddress: 'SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN',
  contractName: 'music-payment-splitter-v3',
  functionName: 'split-track-payment',
  functionArgs: [
    uintCV(totalPriceMicroSTX),
    listCV(compositionSplits.map(s =>
      tupleCV({
        wallet: standardPrincipalCV(s.wallet),
        percentage: uintCV(s.percentage)
      })
    )),
    listCV(productionSplits.map(s =>
      tupleCV({
        wallet: standardPrincipalCV(s.wallet),
        percentage: uintCV(s.percentage)
      })
    ))
  ],
  postConditionMode: PostConditionMode.Allow, // Critical!
  network: new StacksMainnet(),
  onFinish: (data) => {
    // Transaction submitted
    console.log('Transaction ID:', data.txId);
  },
  onCancel: () => {
    // User cancelled
  }
}
```

**Code:** `contexts/CartContext.tsx` lines 150-220

---

#### Step 6: Wallet Popup & Signature

**What Happens:**
1. Stacks wallet popup appears (Hiro, Xverse, Leather, etc.)
2. User sees:
   - Total STX amount to send
   - Contract being called
   - Function name
   - Network (Mainnet)
3. User confirms or cancels
4. If confirmed: Transaction signed and broadcast

**User Experience:**
- Clear confirmation of amount
- Network fee displayed (~0.001 STX)
- Estimated confirmation time
- Option to cancel

---

#### Step 7: Smart Contract Execution

**On-Chain Process:**

1. **Contract Receives STX** (Escrow)
   - Total amount transferred to contract address
   - Held temporarily

2. **Contract Validates**
   - Percentages total 100%
   - Wallet addresses valid
   - Amount matches splits

3. **Contract Distributes**
   - Loops through composition splits
   - Transfers STX to each wallet
   - Loops through production splits
   - Transfers STX to each wallet
   - Adds dust to first recipient if needed

4. **Transaction Confirmed**
   - Block mined on Stacks blockchain
   - Anchored to Bitcoin
   - Immutable record

**Time:** ~10 minutes (block time on Stacks)

---

#### Step 8: Post-Purchase

**Current Implementation:**
```javascript
onFinish: (data) => {
  // Transaction submitted (not yet confirmed)
  setPurchaseStatus('success');
  clearCart(); // Empty cart immediately
  // TODO: Add tracks to user's vault
  // TODO: Enable download links
}
```

**Future Implementation:**
- Wait for transaction confirmation
- Create download links
- Add to user's vault/library
- Generate on-chain certificate
- Send confirmation email (optional)

**Status:** ✅ Payment works, ❌ Download delivery pending

---

## Pricing Model

### Track Pricing (Database Fields)

**Current Schema:**
```sql
-- New separate pricing (Sept 2025)
remix_price_stx DECIMAL(10,2) DEFAULT 1.0
  -- Price to use in a remix (per loop)

download_price_stx DECIMAL(10,2) DEFAULT NULL
  -- Price to download the file (NULL = not available)

allow_downloads BOOLEAN DEFAULT false
  -- Whether downloads are enabled

-- Legacy field (kept for backward compatibility)
price_stx DECIMAL(10,2)
  -- Combined price (being phased out)
```

**Migration:** `supabase/migrations/separate_remix_download_pricing.sql`

---

### Pricing Scenarios

#### Scenario 1: Loop (Remix Only)
```
remix_price_stx = 1.0 STX
download_price_stx = NULL
allow_downloads = false
```
**User can:** Use in remix (pay 1 STX)
**User cannot:** Download the file

---

#### Scenario 2: Loop (Remix + Download)
```
remix_price_stx = 1.0 STX
download_price_stx = 1.5 STX
allow_downloads = true
```
**User can:** Use in remix (pay 1 STX) OR download (pay 1.5 STX)
**Note:** Separate transactions, separate purposes

---

#### Scenario 3: Full Song (Download Only)
```
remix_price_stx = 0 STX
download_price_stx = 2.5 STX
allow_downloads = true
```
**User can:** Download the file (pay 2.5 STX)
**User cannot:** Use in remix (songs not allowed in mixer)

---

#### Scenario 4: Free Loop (Community Contribution)
```
remix_price_stx = 0 STX
download_price_stx = NULL
allow_downloads = false
```
**User can:** Use in remix (free)
**User cannot:** Download the file

---

## API Endpoints

### 1. Calculate Payment Splits

**Endpoint:** `GET /api/calculate-payment-splits`
**Query:** `?trackId={uuid}`

**Purpose:** Calculate composition and production splits for a track

**Returns:**
```json
{
  "compositionSplits": [
    {
      "wallet": "SP1ABC...",
      "percentage": 50,
      "sourceLoop": "Loop A" // Only for remixes
    },
    {
      "wallet": "SP2DEF...",
      "percentage": 50,
      "sourceLoop": "Loop B"
    }
  ],
  "productionSplits": [
    {
      "wallet": "SP3GHI...",
      "percentage": 50,
      "sourceLoop": "Loop A"
    },
    {
      "wallet": "SP4JKL...",
      "percentage": 50,
      "sourceLoop": "Loop B"
    }
  ]
}
```

**Used By:**
- Cart purchase flow
- TrackDetailsModal (preview)
- Remix creation (planned)

**Code:** `app/api/calculate-payment-splits/route.ts`

---

### 2. Verify Remix Payments

**Endpoint:** `POST /api/verify-remix-payments`
**Body:**
```json
{
  "txId": "0xabc123...",
  "remixId": "uuid",
  "sourceTrackIds": ["uuid1", "uuid2"]
}
```

**Purpose:** Verify payment was made for remix creation

**Returns:**
```json
{
  "verified": true,
  "amount": 2000000, // microSTX
  "recipients": ["SP1...", "SP2..."]
}
```

**Status:** Planned (not yet implemented)

---

## Code Integration Points

### Frontend

#### 1. CartContext (`contexts/CartContext.tsx`)

**Responsibilities:**
- Cart state management
- Add/remove items
- Purchase orchestration
- Smart contract interaction

**Key Functions:**
```typescript
addToCart(track: any): void
removeFromCart(trackId: string): void
clearCart(): void
purchaseAll(): Promise<void>
```

**Purchase Flow:**
```typescript
const purchaseAll = async () => {
  // 1. Fetch splits for all tracks
  const tracksWithSplits = await Promise.all(
    cart.map(fetchSplits)
  );

  // 2. Aggregate payments
  const aggregated = aggregateCartPayments(tracksWithSplits);

  // 3. Build contract call
  await openContractCall({
    contractAddress: PAYMENT_SPLITTER_ADDRESS,
    functionName: 'split-track-payment',
    functionArgs: [
      uintCV(aggregated.totalPriceMicroSTX),
      listCV(aggregated.compositionSplits),
      listCV(aggregated.productionSplits)
    ]
  });
};
```

---

#### 2. calculateRemixSplits (`lib/calculateRemixSplits.ts`)

**Purpose:** Calculate IP attribution for Gen 1 remixes

**Function:**
```typescript
function calculateRemixSplits(
  loopA: IPTrack,
  loopB: IPTrack
): {
  compositionSplits: IPSplit[],
  productionSplits: IPSplit[]
}
```

**Logic:**
1. Extract composition splits from Loop A, scale by 0.5
2. Extract composition splits from Loop B, scale by 0.5
3. Combine into single array
4. Repeat for production splits
5. Consolidate duplicate wallets
6. Adjust for rounding to ensure 100% total

**Example:**
```typescript
// Loop A: Alice 100% comp, Amy 100% prod
// Loop B: Bob 100% comp, Betty 100% prod

const result = calculateRemixSplits(loopA, loopB);

// result.compositionSplits:
// [
//   {wallet: "SP_Alice", percentage: 50},
//   {wallet: "SP_Bob", percentage: 50}
// ]

// result.productionSplits:
// [
//   {wallet: "SP_Amy", percentage: 50},
//   {wallet: "SP_Betty", percentage: 50}
// ]
```

---

#### 3. Batch Payment Aggregator (`lib/batch-payment-aggregator.ts`)

**Purpose:** Combine multiple track purchases into single contract call

**Function:**
```typescript
function aggregateCartPayments(
  tracks: TrackPayment[]
): AggregatedPayment
```

**Logic:**
1. Sum all track prices
2. Collect all unique wallets
3. Calculate weighted percentages for each wallet
4. Ensure 100% totals

**Example:**
```typescript
// Cart: 2 tracks, 3 STX total
// Track 1 (1 STX): Alice 50% comp, Bob 50% comp
// Track 2 (2 STX): Alice 50% comp, Charlie 50% comp

const result = aggregateCartPayments([track1, track2]);

// result.compositionSplits:
// [
//   {wallet: "Alice", percentage: 50},  // (0.5 + 1.0) / 3 = 50%
//   {wallet: "Bob", percentage: 16.67}, // 0.5 / 3 = 16.67%
//   {wallet: "Charlie", percentage: 33.33} // 1.0 / 3 = 33.33%
// ]
```

---

### Backend

#### API Route: `app/api/calculate-payment-splits/route.ts`

**Purpose:** Server-side split calculation

**Flow:**
```typescript
export async function GET(request: Request) {
  // 1. Extract trackId from query
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId');

  // 2. Fetch track from database
  const { data: track } = await supabase
    .from('ip_tracks')
    .select('*')
    .eq('id', trackId)
    .single();

  // 3. Check if remix
  if (track.remix_depth > 0) {
    // Fetch source loops
    const sourceLoops = await fetchSourceLoops(track.source_track_ids);

    // Calculate remix splits
    const splits = calculateRemixSplits(sourceLoops[0], sourceLoops[1]);

    return Response.json(splits);
  } else {
    // Original track - return direct splits
    return Response.json({
      compositionSplits: extractCompositionSplits(track),
      productionSplits: extractProductionSplits(track)
    });
  }
}
```

---

## Testing

### Test Suite

**File:** `scripts/test-remix-splits.ts`
**Command:** `npm run test:remix-splits`

**Scenarios:**

1. **Simple Baseline** - 1 composer + 1 producer per loop
2. **Multiple Contributors** - 3 composers + 2 producers
3. **Wallet Consolidation** - Same person in multiple roles
4. **Rounding Edge Cases** - 33%, 51% splits

**Validation:**
- ✅ Totals equal 100%
- ✅ Proper scaling (50% from each loop)
- ✅ Consolidation works
- ✅ Rounding adjusts correctly

---

## Environment Configuration

**Required Variables:**
```bash
# Stacks Network
NEXT_PUBLIC_STACKS_NETWORK=mainnet

# Smart Contract
NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT=SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN
```

**Networks:**
- **Production:** Stacks Mainnet
- **Testing:** Stacks Testnet
- **Local:** Devnet (not used)

---

## Known Limitations

**What Works:**
- ✅ Cart-based purchases
- ✅ Smart contract payment splitting
- ✅ Multi-contributor distribution
- ✅ Upfront licensing for remix creation
- ✅ IP attribution calculation

**What's Missing:**
- ❌ Download delivery after purchase
- ❌ Downstream remix sales (20% commission)
- ❌ Gen 2+ remix payments
- ❌ Refunds (blockchain limitation)
- ❌ Transaction confirmation waiting
- ❌ Payment history/receipts
- ❌ Vault/library system

**Constraints:**
- Maximum 50 contributors per category (contract limit)
- No refunds once transaction confirmed
- ~10 minute confirmation time (Stacks block time)
- Requires sufficient STX balance + network fee

---

## Security Considerations

**Smart Contract:**
- ✅ Deployed and tested on mainnet (Oct 7, 2025)
- ✅ Escrow pattern (receives then distributes)
- ✅ Dust handling prevents lost microSTX
- ⚠️ PostConditionMode.Allow (necessary for multi-recipient)
- ❌ No formal third-party audit

**Frontend:**
- ✅ No wallet addresses hardcoded
- ✅ Alpha code → wallet conversion server-side
- ✅ Row Level Security on database
- ⚠️ No rate limiting on API routes
- ⚠️ No transaction replay protection (blockchain handles)

---

## Resources

**Documentation:**
- `docs/REMIX-SYSTEM-AUTHORITATIVE.md` - Complete remix logic
- `docs/MAINNET-DEPLOYMENT-GUIDE.md` - Contract deployment
- `docs/PAYMENT-SPLITTING-GUIDE.md` - Payment architecture
- `contracts/mixmi-payment-splitter/README.md` - Contract details

**Code:**
- `contexts/CartContext.tsx` - Purchase flow
- `lib/calculateRemixSplits.ts` - IP attribution
- `lib/batch-payment-aggregator.ts` - Cart aggregation
- `app/api/calculate-payment-splits/route.ts` - Backend API

**Explorer:**
- [First Mainnet Transaction](https://explorer.hiro.so/txid/0xd06bbc3488a4249083378ff8288b62a12e695d11ffc46077017138745ff49c39?chain=mainnet)
