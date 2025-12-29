# Payment System Summary for SUI Migration

**Created:** December 28, 2025
**Purpose:** Reference for next Claude session on smart contracts and shopping cart

---

## Current State: Stacks/Clarity Payment System

### What's Working

**Clarity Smart Contract v3 (LIVE ON MAINNET)**
- **Contract:** `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3`
- **Location:** `/contracts/mixmi-payment-splitter/contracts/music-payment-splitter-v3.clar`
- **Status:** Production-ready, tested with real STX transactions
- **First successful transaction:** October 7, 2025

**Key Features:**
- 50/50 split between composition pool and production pool
- **Up to 50 contributors per category** (designed for batch cart payments!)
- Escrow pattern: receives STX first, then distributes to all recipients
- Uses `PostConditionMode.Allow` to enable multiple transfers
- Validated with real money on mainnet

### Shopping Cart (Implemented, Payments Disabled)

**Files:**
- `contexts/CartContext.tsx` - Global cart state
- `components/layout/Header.tsx` - Cart UI in header

**Current State:**
- Cart functionality works (add/remove/persist)
- "Payments Coming Soon" button (disabled)
- Stores `primary_uploader_wallet` for each item
- localStorage persistence across sessions

**Why Disabled:**
- Discovery in October 2025: Original implementation only sent payment to first artist
- Needs proper payment splitting for multi-artist carts
- The smart contract can handle this, but frontend integration was incomplete

---

## Architecture Details

### Payment Flow (Stacks/Clarity)

```
1. User adds tracks to cart (from multiple artists)
2. Cart groups items by artist wallet
3. On purchase:
   - Calculate composition splits for each track
   - Calculate production splits for each track
   - Call smart contract with all splits (up to 50 per category)
   - Contract receives total STX from buyer
   - Contract distributes to all recipients atomically
```

### Database Schema for Splits

```sql
-- In ip_tracks table
composition_split_1_wallet: varchar
composition_split_1_percentage: integer
composition_split_2_wallet: varchar (nullable)
composition_split_2_percentage: integer (nullable)
composition_split_3_wallet: varchar (nullable)
composition_split_3_percentage: integer (nullable)

production_split_1_wallet: varchar
production_split_1_percentage: integer
-- ... same pattern up to 3

price_stx: decimal
```

**Note:** Database schema limits to 3 contributors per category, but the smart contract supports 50. This was the "limitation" - it's a schema limitation, not a Clarity limitation.

### Smart Contract Interface

```clarity
(define-public (split-track-payment
  (total-price uint)
  (composition-splits (list 50 {wallet: principal, percentage: uint}))
  (recording-splits (list 50 {wallet: principal, percentage: uint})))
```

### API Endpoint

```
GET /api/calculate-payment-splits?trackId=abc123

Response:
{
  "trackId": "abc123",
  "title": "My Track",
  "totalPriceMicroSTX": 2500000,
  "compositionSplits": [
    { "wallet": "SP...", "percentage": 60 },
    { "wallet": "SP...", "percentage": 40 }
  ],
  "productionSplits": [
    { "wallet": "SP...", "percentage": 100 }
  ]
}
```

---

## Relevant Files

### Smart Contracts
```
contracts/mixmi-payment-splitter/
├── contracts/
│   ├── music-payment-splitter-v3.clar  # MAINNET (current)
│   └── music-payment-splitter.clar     # TESTNET (legacy)
├── Clarinet.toml
└── deployments/
```

### Frontend Integration
```
lib/payment-splitter-integration.ts    # Helper functions
contexts/CartContext.tsx               # Cart state management
components/layout/Header.tsx           # Cart UI
```

### Documentation
```
docs/PAYMENT-SPLITTING-GUIDE.md        # Comprehensive guide
docs/STX-PAYMENT-INTEGRATION.md        # Shopping cart docs
docs/MAINNET-DEPLOYMENT-GUIDE.md       # Deployment instructions
```

---

## What the "Workarounds" Likely Were

Based on the documentation, the limitations mentioned were:

1. **Database schema limit:** Only 3 contributors per category (composition/production)
   - Workaround: Track with more collaborators would need to aggregate somehow

2. **Single transaction complexity:** Original v2 contract couldn't pull STX from user
   - Solved in v3 with escrow pattern

3. **Cart with multiple artists:** Original implementation only paid first artist
   - Solved by disabling payments until proper integration

**The 50-contributor limit in v3 was designed specifically for batch cart scenarios** where you might buy 10 tracks from 10 different artists in one transaction.

---

## For SUI Migration

### What Needs to Be Built

1. **Move Smart Contract** for payment splitting on SUI
   - Similar escrow pattern
   - USDC instead of STX
   - Handle composition/production pools
   - Support multiple recipients

2. **New Frontend Integration**
   - Replace `@stacks/connect` with SUI wallet SDK
   - Update CartContext to handle SUI transactions
   - New API endpoints for SUI payment calculations

3. **Pricing System**
   - Already defined in `config/pricing.ts` with USDC values
   - Already have `usdc_balance` on personas

### What Can Be Reused

- Cart UI and state management pattern
- Database split structure (expand from 3 to more if needed)
- API pattern for calculating splits
- Frontend purchase flow UX
- Composition/production 50/50 split model

### SUI Advantages

- **More contributors:** No Clarity-specific list limits
- **USDC:** Stable pricing (not volatile like STX)
- **Lower fees:** SUI transactions are cheaper
- **Faster:** Near-instant finality

---

## Test Pages

- `/test-payment-splitter` - Test payment splitting
- Explorer links in documentation for mainnet verification

---

## Questions for Next Session

1. Should we keep the 50/50 composition/production split model?
2. How many contributors per category should we support in the new schema?
3. Do we want batch purchases (multiple tracks in one transaction) or individual?
4. Should remix royalties (80/20 split) be handled in same contract or separate?
5. How do we handle TBD wallets for collaborators without mixmi accounts?

---

## Related Context

- **Persona System:** See `docs/2025-12-28-persona-system.md`
- **Pricing Config:** `config/pricing.ts` has all USDC prices
- **Accounting Tables:** `personas.usdc_balance`, `tbd_wallets`, `earnings`
