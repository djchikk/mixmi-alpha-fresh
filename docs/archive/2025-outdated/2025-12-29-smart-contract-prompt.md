# Smart Contract Development Prompt

**For new Claude Code instance working on SUI payment infrastructure**

---

## Project Context

mixmi is a music collaboration platform transitioning from Stacks (STX) to SUI blockchain. The frontend is built, UI shows USDC pricing, but **actual SUI payment transactions are not yet implemented**.

**Your mission:** Build the SUI smart contracts and integration code for two distinct payment flows.

---

## Two Payment Flows (Important Distinction!)

### Flow A: Shopping Cart Purchases

**When it happens:** User checks out cart containing downloadable content (loops, songs, videos, packs)

**The challenge:**
1. Cart may contain items from DIFFERENT creators
2. Each item has its own price (e.g., Loop A = $2.00, Song B = $1.00)
3. Each item has IP ownership splits (composition + production contributors)
4. Need to aggregate all payments and distribute to all recipients in one transaction

**Example:**
```
Cart contains:
- Loop by Alice ($2.00) - Alice gets 100% composition, 100% production
- Song by Bob & Charlie ($1.00) - Bob 60% comp, Charlie 40% comp; Bob 100% prod

Total: $3.00 USDC

Distribution:
- Alice: $2.00 (from her loop)
- Bob: $0.30 (60% of $0.50 comp) + $0.50 (100% of $0.50 prod) = $0.80
- Charlie: $0.20 (40% of $0.50 comp)
```

**Key files:**
- `contexts/CartContext.tsx` - Shopping cart state
- `components/layout/Header.tsx` - Cart UI (currently shows "Payments Coming Soon")
- `config/pricing.ts` - Centralized pricing config

---

### Flow B: Mixer Recording Payments

**When it happens:** User records output from the mixer, which used content from multiple creators

**The challenge:**
1. Mixer has two decks, each can have a loop/song loaded
2. Each deck's content has its own IP ownership splits
3. Recording fee: $0.10 USDC per content piece used
4. Split: 90% to content creators, 10% platform fee
5. Future: Generational royalties when remixes are remixed (Gen 1 → Gen 2 → Gen 3)

**Example:**
```
Mixer recording using:
- Deck A: Loop by Alice (100% comp, 100% prod)
- Deck B: Loop by Bob & Eve (Bob 50% comp, Eve 50% comp; Bob 100% prod)

Total recording fee: $0.20 USDC (2 loops × $0.10)

Distribution after 10% platform fee ($0.18 to creators):
- Deck A ($0.09): Alice gets $0.09
- Deck B ($0.09):
  - Bob: $0.0225 (50% of $0.045 comp) + $0.045 (100% prod) = $0.0675
  - Eve: $0.0225 (50% of $0.045 comp)
```

**Key files:**
- `components/mixer/UniversalMixer.tsx` - Main mixer
- `components/modals/PaymentModal.tsx` - Recording payment UI
- `lib/calculateRemixSplits.ts` - Existing split calculation logic

---

## Current Infrastructure

### Database Tables (Supabase)

**Already created:**
- `accounts` - Parent account container
- `personas` - User identities (up to 5 per account), each has `balance_usdc`
- `tbd_wallets` - Hold earnings for collaborators without accounts yet
- `earnings` - Transaction log for all earnings
- `zklogin_users` - Links SUI addresses to accounts

**See:** `docs/sui-accounting-system.md` for full schema

### IP Attribution (ip_tracks table)

Each track has composition and production splits:
```sql
composition_split_1_wallet, composition_split_1_percentage
composition_split_2_wallet, composition_split_2_percentage
composition_split_3_wallet, composition_split_3_percentage
production_split_1_wallet, production_split_1_percentage
production_split_2_wallet, production_split_2_percentage
production_split_3_wallet, production_split_3_percentage
```

Each category sums to 100%. Combined 50/50 for final distribution.

### Pricing Config

```typescript
// config/pricing.ts
export const PRICING = {
  mixer: {
    loopRecording: 0.10,    // $0.10 USDC per loop
    songSection: 0.10,
    videoClip: 0.10,
  },
  download: {
    loop: 2.00,             // $2.00 USDC default
    song: 1.00,
    videoClip: 2.00,
  },
  platform: {
    platformCutPercent: 10, // 10% of recording fees
    creatorCutPercent: 90,
  },
}
```

### Previous Stacks Implementation (Reference)

The old system used Clarity smart contracts on Stacks:
- Contract: `music-payment-splitter-v3`
- Worked with STX tokens
- Successfully tested on mainnet

**See:** `docs/PAYMENT-SPLITTING-GUIDE.md` for architecture reference

---

## What Needs Building

### 1. SUI Smart Contract(s)

**Option A: Single contract handling both flows**
- `purchase_cart(items, recipients, amounts)`
- `record_mixer(content_used, recipients, amounts)`

**Option B: Separate contracts**
- `cart-payment-splitter` - For shopping cart
- `mixer-payment-splitter` - For recordings

**Requirements:**
- Accept USDC (SUI's native USDC, not wrapped)
- Handle multiple recipients in single transaction
- Validate percentages sum to 100%
- Atomic - all succeed or all fail
- Gas-efficient for many recipients

### 2. Frontend Integration

**Cart checkout:**
```typescript
// When user clicks "Purchase" in cart
async function checkoutCart(cartItems) {
  // 1. Calculate all recipients and amounts
  // 2. Call SUI contract
  // 3. On success: clear cart, update balances, show receipt
}
```

**Mixer recording:**
```typescript
// When user confirms recording payment
async function payForRecording(deckAContent, deckBContent) {
  // 1. Calculate fees and splits
  // 2. Call SUI contract
  // 3. On success: proceed with recording
}
```

### 3. Balance Management

**Options to consider:**
- Direct on-chain payments to SUI addresses
- OR: Credits system (deposit USDC → platform balance → spend internally)
- OR: Hybrid (small amounts accumulate in DB, withdraw when threshold reached)

### 4. TBD Wallet Support

When a contributor doesn't have a SUI address yet:
- Earnings accumulate in `tbd_wallets` table
- When they join and link account, transfer accumulated balance

---

## Technology Stack

- **Blockchain:** SUI
- **Smart Contract Language:** Move
- **Token:** USDC (native SUI USDC)
- **Frontend:** Next.js 14, TypeScript
- **Database:** Supabase (PostgreSQL)
- **Auth:** zkLogin (Google OAuth → SUI address)

---

## Key Questions to Resolve

1. **On-chain vs off-chain accounting?**
   - Pure on-chain: Every payment is a SUI transaction
   - Hybrid: Accumulate small amounts in DB, settle on-chain periodically
   - Credits: Deposit USDC to platform, internal transfers, withdraw

2. **Gas fees - who pays?**
   - Buyer pays all gas?
   - Platform subsidizes?
   - Factor into pricing?

3. **Minimum payment thresholds?**
   - $0.01 payments aren't practical on-chain
   - Accumulate until threshold?

4. **Contract upgrade strategy?**
   - Immutable contracts?
   - Upgradeable proxy pattern?

---

## Files to Review

1. `docs/sui-accounting-system.md` - Database schema, personas, earnings
2. `docs/PAYMENT-SPLITTING-GUIDE.md` - Previous Stacks implementation
3. `config/pricing.ts` - Centralized pricing
4. `contexts/CartContext.tsx` - Cart state management
5. `components/modals/PaymentModal.tsx` - Recording payment UI
6. `lib/calculateRemixSplits.ts` - Split calculation logic
7. `CLAUDE.md` - Project overview and patterns

---

## Success Criteria

1. **Cart checkout works:** User can purchase multiple items, all creators receive correct amounts
2. **Mixer recording works:** User can pay for recordings, loop creators receive splits
3. **Atomic transactions:** No partial payments
4. **TBD wallet support:** Non-members can receive earnings
5. **Gas-efficient:** Batch payments don't cost excessive gas
6. **Clean integration:** Minimal changes to existing frontend code

---

## Getting Started

1. Review the docs listed above
2. Explore existing cart and payment code
3. Research SUI Move contract patterns for payment splitting
4. Propose architecture (on-chain vs hybrid)
5. Build incrementally - cart first, then mixer

**Ask questions early!** The product owner can clarify business logic.

---

*Created: December 29, 2025*
*For: New Claude Code instance working on payment infrastructure*
