---
name: mixmi-payment-flow
description: Payment processing, attribution calculation, and blockchain integration for the mixmi platform including smart contracts, splits, and distribution logic
metadata:
  status: Active - Considering SUI Migration
  implementation: Stacks - Alpha
  last_updated: 2025-10-26
---

# mixmi Payment Flow

> Documentation of payment processing, attribution calculation, and value distribution in the mixmi platform.

## Overview

The payment system handles:
- Attribution calculation (50/50 for remixes, 20/80 for curation)
- Smart contract execution
- Multi-recipient distribution
- TBD wallet management
- Transaction tracking

## Core Payment Models

### 1. Gen 1 Remix Payments

**Model:** IP inheritance with commission
- **Upfront Cost:** 2 STX (1 STX per source loop)
- **Revenue Split:** 20% remixer, 80% original creators
- **IP Attribution:** Each source contributes 50% to both composition and production

#### Payment Flow
```
User creates remix from 2 loops
    ↓
Pays 2 STX upfront (licensing fee)
    ↓
Smart contract distributes to original creators
    ↓
Remix is created with inherited attribution
    ↓
Future sales: 20% to remixer, 80% split among originals
```

#### Example Calculation
```javascript
// Source Loop A: Alice (100% comp), Amy (100% prod)
// Source Loop B: Bob (100% comp), Betty (100% prod)
// Remix by Charlie

// When remix sells for 10 STX:
- Charlie (remixer): 2 STX (20% commission)
- Alice: 2 STX (25% of remaining 80%)
- Amy: 2 STX (25% of remaining 80%)
- Bob: 2 STX (25% of remaining 80%)
- Betty: 2 STX (25% of remaining 80%)
```

### 2. Curation Payments (Planned)

**Model:** Discovery commission without IP inheritance
- **Upfront Cost:** None
- **Revenue Split:** 20% curator, 80% original creators
- **IP Attribution:** None - originals retain 100%

#### Difference from Remix
- No IP inheritance
- No upfront payment
- Discovery rewards for ongoing sales
- Simpler payment structure

### 3. Direct Purchase/Download

**Model:** Simple sale with attribution splits
- **Price:** Set by uploader
- **Distribution:** According to attribution percentages
- **Platform Fee:** 10% (future)

## Smart Contract Implementation

### Current Contract (Stacks)

**Contract:** `music-payment-splitter-v3`  
**Address:** `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN`  
**Network:** Stacks mainnet

#### Core Function
```clarity
(define-public (split-track-payment 
    (total-amount uint)
    (composition-splits (list 50 {wallet: principal, percentage: uint}))
    (production-splits (list 50 {wallet: principal, percentage: uint})))
```

#### Constraints
- Maximum ~50 total recipients
- Minimum payment: 1 STX
- Gas optimization for multiple recipients
- Automatic percentage validation

### Payment Processing Steps

1. **Frontend Calculation**
```javascript
// lib/calculateRemixSplits.ts
function calculateRemixSplits(source1, source2) {
  // Merge composition splits (50% each source)
  // Merge production splits (50% each source)
  // Consolidate duplicate wallets
  // Return formatted for smart contract
}
```

2. **Wallet Connection**
```javascript
// Check wallet connection
if (!userWallet.connected) {
  await connectWallet();
}

// Check balance
if (balance < requiredAmount) {
  throw new Error('Insufficient funds');
}
```

3. **Contract Execution**
```javascript
// Call smart contract
const tx = await callContract({
  contractAddress: CONTRACT_ADDRESS,
  contractName: 'music-payment-splitter-v3',
  functionName: 'split-track-payment',
  functionArgs: [amount, compSplits, prodSplits]
});
```

4. **Transaction Confirmation**
```javascript
// Wait for confirmation
await waitForConfirmation(tx.txId);

// Update database
await updateTransactionStatus(tx.txId, 'confirmed');
```

## Attribution Calculation

### Composition vs Production Splits

**Composition (Who wrote it):**
- Melody
- Lyrics
- Arrangement
- Concept

**Production (Who recorded it):**
- Performance
- Recording
- Mixing
- Engineering

Each category sums to 100% independently, then combined 50/50 for final payment.

### Split Consolidation

When multiple works combine:
```javascript
// Example: Two loops with overlapping contributors
Loop1: Alice 60%, Bob 40% (composition)
Loop2: Alice 30%, Charlie 70% (composition)

// After 50/50 merge:
Alice: (60% × 50%) + (30% × 50%) = 45%
Bob: 40% × 50% = 20%
Charlie: 70% × 50% = 35%
Total: 100%
```

## TBD Wallet System

### Purpose
Allow attribution to entities not yet on platform:
- Restaurants, venues, places
- Collaborators without wallets
- Future participants
- Community organizations

### Implementation
```javascript
// Create TBD wallet
const tbdWallet = generateTBDWallet({
  description: "Indian Kitchen Restaurant",
  createdBy: userWallet,
  timestamp: Date.now()
});

// Payments accumulate
// Can be claimed later with proof
```

### Claiming Process
1. Entity joins platform
2. Provides proof of identity
3. TBD wallet transfers to real wallet
4. Historical attribution maintained

## Payment Routing

### Immediate Payments
- Amount ≥ 10 STX
- Direct blockchain transaction
- Real-time distribution

### Batched Payments
- Amount 1-10 STX
- Accumulated for gas efficiency
- Daily/weekly distribution

### Micro Payments
- Amount < 1 STX
- Held in pool
- Distributed when threshold reached

## Database Schema

### transactions Table
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  track_id UUID REFERENCES ip_tracks(id),
  transaction_type VARCHAR, -- 'purchase' | 'remix' | 'download'
  from_wallet VARCHAR,
  to_wallets JSONB, -- Array of recipients
  amounts JSONB, -- Array of amounts
  total_amount DECIMAL,
  stacks_tx_id VARCHAR,
  status VARCHAR, -- 'pending' | 'confirmed' | 'failed'
  created_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  error_message TEXT
);
```

### payment_queue Table
```sql
CREATE TABLE payment_queue (
  id UUID PRIMARY KEY,
  recipient_wallet VARCHAR,
  pending_amount DECIMAL,
  track_ids UUID[], -- Tracks contributing to payment
  scheduled_for TIMESTAMP,
  batch_id UUID,
  status VARCHAR -- 'pending' | 'processing' | 'completed'
);
```

## API Endpoints

### Payment Initiation
```
POST /api/payment/initiate
Body: {
  trackId: string,
  paymentType: 'remix' | 'purchase' | 'download',
  amount: number
}
Response: {
  transactionId: string,
  splits: PaymentSplit[],
  contractCall: ContractCallParams
}
```

### Transaction Confirmation
```
POST /api/payment/confirm
Body: {
  transactionId: string,
  stacksTxId: string
}
Response: {
  status: 'confirmed' | 'failed',
  timestamp: string
}
```

### Payment Status
```
GET /api/payment/status/:txId
Response: {
  status: string,
  confirmations: number,
  recipients: Recipient[],
  amounts: number[]
}
```

## Error Handling

### Common Errors
- **Insufficient Balance:** Check before transaction
- **Network Congestion:** Retry with higher fee
- **Invalid Splits:** Validate percentages sum to 100%
- **Wallet Connection Lost:** Re-prompt connection
- **Transaction Timeout:** Check status and retry

### Fallback Mechanisms
1. Store transaction intent locally
2. Retry failed transactions
3. Manual reconciliation process
4. Support ticket system

## Migration Considerations (Stacks → SUI)

### What Changes
- Smart contract language (Clarity → Move)
- Transaction format
- Wallet integration
- Gas token (STX → SUI)

### What Stays Same
- Attribution logic
- Payment percentages
- TBD wallet concept
- UI/UX flow

### Migration Strategy
1. Deploy parallel SUI contracts
2. Dual network support period
3. Gradual migration of users
4. Legacy transaction support

## Testing Scenarios

### Critical Paths to Test
1. **Simple Purchase:** Single recipient
2. **Complex Remix:** 7+ recipients each side
3. **TBD Wallet:** Attribution without wallet
4. **Failed Transaction:** Recovery flow
5. **Batch Processing:** Multiple small payments
6. **Edge Cases:** 
   - Exactly 100 STX (round numbers)
   - 0.000001 STX (minimum amounts)
   - 49 recipients (near maximum)

---

*Note: This documentation reflects current Stacks implementation. See migration docs for SUI planning.*