# Remix System - Authoritative Guide (October 2025)

**This document is the single source of truth for how Mixmi's Gen 1 remix system works.**

---

## Core Principles

### 1. IP Attribution (What You Own)
**Each source loop contributes 50% to the remix's IP ownership.**

- Loop A creators own **50%** of the remix
- Loop B creators own **50%** of the remix
- **Remixer is NOT an IP owner** - they are a reseller/distributor

### 2. Payment Flow (How Money Flows)
**Two separate payment events:**

**A) Creating a Remix (Upfront Licensing):**
- Remixer pays **1 STX per loop** to loop creators
- Payment goes directly to original creators via smart contract
- This is a LICENSE FEE to create the derivative work

**B) Selling a Remix (Commission Split):**
- Remixer gets **20% commission** (distributor fee)
- Original creators get **80%** (IP holder revenue)
- Split according to their 50/50 IP ownership

---

## Detailed Example: Grace Remixes Two Loops

### The Source Loops

**Loop A - "Drums"**
- Composer: Alice (100%)
- Producer: Amy (100%)
- Price: 1 STX

**Loop B - "Bass"**
- Composer: Bob (100%)
- Producer: Betty (100%)
- Price: 1 STX

### Step 1: Grace Creates the Remix

**Action:** Grace loads both loops into the mixer and records an 8-bar remix

**Payment (Upfront Licensing):**
```
Grace pays 2 STX total →
├── 1 STX → Loop A creators
│   ├── Composition (0.5 STX): Alice 100% = 0.5 STX
│   └── Production (0.5 STX): Amy 100% = 0.5 STX
│
└── 1 STX → Loop B creators
    ├── Composition (0.5 STX): Bob 100% = 0.5 STX
    └── Production (0.5 STX): Betty 100% = 0.5 STX
```

**Result:** Grace has paid for the license to create a derivative work.

### Step 2: IP Attribution is Recorded

**The remix is now registered with these IP splits:**

**Composition Rights (100% pie):**
- Alice: 50% (from Loop A)
- Bob: 50% (from Loop B)

**Production Rights (100% pie):**
- Amy: 50% (from Loop A)
- Betty: 50% (from Loop B)

**Grace's Role:**
- NOT listed as IP holder
- Listed as "remixer" (creator/distributor)
- Will receive commission on sales

### Step 3: Someone Buys Grace's Remix

**Buyer pays 2 STX for the remix:**

```
2 STX purchase →
├── Grace (remixer commission): 20% × 2 = 0.4 STX
│
└── IP Holders (80% revenue): 80% × 2 = 1.6 STX
    ├── Alice (25% of total): 0.4 STX
    │   (50% comp × 50% weight = 25% of IP revenue)
    │
    ├── Amy (25% of total): 0.4 STX
    │   (50% prod × 50% weight = 25% of IP revenue)
    │
    ├── Bob (25% of total): 0.4 STX
    │   (50% comp × 50% weight = 25% of IP revenue)
    │
    └── Betty (25% of total): 0.4 STX
        (50% prod × 50% weight = 25% of IP revenue)
```

**Total Revenue Distribution:**
- Grace earned: 0.4 STX (20% commission)
- Original creators earned: 1.6 STX (80% split equally)

---

## Mathematical Formulas

### IP Attribution Formula

For a Gen 1 remix using Loop A and Loop B:

**Composition Split:**
```
For each composer in Loop A:
  Remix Composition % = (Loop A Composition %) × 50%

For each composer in Loop B:
  Remix Composition % = (Loop B Composition %) × 50%

Total must equal 100%
```

**Production Split:**
```
For each producer in Loop A:
  Remix Production % = (Loop A Production %) × 50%

For each producer in Loop B:
  Remix Production % = (Loop B Production %) × 50%

Total must equal 100%
```

### Sale Revenue Formula

When a remix sells for price P:

```
Remixer Commission = P × 20%
IP Holder Pool = P × 80%

For each IP holder:
  Payment = IP Holder Pool × (holder's IP percentage)
```

**Example:** 2 STX sale with 4 equal IP holders (25% each)
```
Remixer: 2 × 20% = 0.4 STX
Each IP holder: (2 × 80%) × 25% = 0.4 STX
```

---

## Complex Example: Multiple Collaborators

### Source Loops with Multiple Contributors

**Loop A - "Drums"**
- Composer 1: Alice (60%)
- Composer 2: Charlie (40%)
- Producer: Amy (100%)
- Price: 1 STX

**Loop B - "Bass"**
- Composer: Bob (100%)
- Producer 1: Betty (70%)
- Producer 2: Diana (30%)
- Price: 1 STX

### Remix IP Attribution

**Composition (100%):**
- Alice: 30% (60% of Loop A × 50%)
- Charlie: 20% (40% of Loop A × 50%)
- Bob: 50% (100% of Loop B × 50%)

**Production (100%):**
- Amy: 50% (100% of Loop A × 50%)
- Betty: 35% (70% of Loop B × 50%)
- Diana: 15% (30% of Loop B × 50%)

### When Remix Sells for 3 STX

**Remixer (Grace):**
- Commission: 3 × 20% = 0.6 STX

**IP Holders (2.4 STX pool):**

*Composition contributors (50% weight):*
- Alice: 2.4 × (30% ÷ 2) = 0.36 STX
- Charlie: 2.4 × (20% ÷ 2) = 0.24 STX
- Bob: 2.4 × (50% ÷ 2) = 0.6 STX

*Production contributors (50% weight):*
- Amy: 2.4 × (50% ÷ 2) = 0.6 STX
- Betty: 2.4 × (35% ÷ 2) = 0.42 STX
- Diana: 2.4 × (15% ÷ 2) = 0.18 STX

**Verification:**
0.6 (Grace) + 0.36 + 0.24 + 0.6 + 0.6 + 0.42 + 0.18 = 3 STX ✅

---

## Code Implementation

### Current Files (October 2025)

**IP Attribution Logic:**
- **File:** `lib/calculateRemixSplits.ts`
- **Function:** `calculateRemixSplits(loopA, loopB)`
- **Returns:** Composition and production splits for the remix
- **Status:** ✅ Fully implemented and tested

**Testing:**
- **File:** `scripts/test-remix-splits.ts`
- **Command:** `npm run test:remix-splits`
- **Coverage:** 4 scenarios including edge cases
- **Status:** ✅ All tests passing

**Display:**
- **File:** `components/modals/TrackDetailsModal.tsx`
- **Shows:** Grouped splits by source loop with scaling explanation
- **Example:** "Alice: 100% → 50% of remix"

---

## Payment Implementation Status

### ✅ Currently Working

**Creating Remixes (Upfront Payment):**
- Remixer pays 1 STX per loop
- Uses existing `music-payment-splitter-v3` smart contract
- Payments distributed to all composition/production contributors
- **Status:** Live on Stacks mainnet since October 7, 2025

**Remix Pricing:**
- `download_price_stx` = sum of both loop download prices
- If loops don't allow downloads, field is null
- Price displayed in UI when viewing remix

### 🚧 Not Yet Implemented

**Downstream Remix Sales:**
- When customer buys a remix download
- 20% commission to remixer
- 80% to IP holders via smart contract
- **Planned:** API-based implementation for alpha
- **Future:** Could move to dedicated smart contract

---

## Edge Cases & Rules

### Remixer Can Also Be a Contributor

**Scenario:** Grace remixes her own loop with someone else's loop

**IP Attribution:**
- If Grace created Loop A (100% comp, 100% prod)
- And remixes with Loop B (Bob 100% comp, Betty 100% prod)
- Grace appears in IP splits: 50% comp, 50% prod
- Grace ALSO gets 20% commission on sales

**Result:** Grace gets paid twice - as IP holder AND as remixer

### Wallet Consolidation

**Scenario:** Same person has multiple roles across loops

**Example:**
- Loop A: Alice composer, Alice producer
- Loop B: Alice composer, Bob producer

**Remix attribution:**
- Alice appears once with consolidated percentage
- Not listed twice even though in multiple roles

**Code handles this:** `calculateRemixSplits()` merges duplicate wallets

### Rounding Adjustments

**Issue:** Percentages may not sum to exactly 100% due to rounding

**Solution:** Code adjusts largest contributor to ensure 100% total

**Example:**
- Raw calculation: 33.33% + 33.33% + 33.33% = 99.99%
- Adjusted: 33.34% + 33.33% + 33.33% = 100% ✅

---

## Terminology Clarification

### ❌ Avoid Confusing Terms

**"80/20 Split"** - Too ambiguous! Could mean:
- IP ownership? (NO - it's 50/50 from each loop)
- Payment split? (YES - for sales revenue)

**Better terminology:**
- "50/50 IP contribution" (each loop contributes half)
- "20% remixer commission" (on sales)
- "80% IP holder revenue" (on sales)

### ✅ Clear Terms to Use

**IP Attribution:**
- Each loop contributes 50%
- Equal contribution model
- IP ownership by original creators

**Payment Flow:**
- Upfront licensing: 1 STX per loop
- Sales commission: 20% to remixer
- IP revenue: 80% to creators

**Roles:**
- IP Holder: Original loop creator
- Remixer: Derivative work creator/distributor
- Buyer: Customer purchasing the remix

---

## Future: Gen 2+ Remixes

**Current Status:** Gen 1 only (original loop + original loop)

**Future Challenge:** What happens when someone remixes a remix?

**Potential Approaches:**
1. **Heritage Pools** - Aggregate payments to avoid contributor explosion
2. **Depth Limits** - Only allow remixing up to certain generation
3. **Fixed Fees** - Flat payment instead of percentage-based splits

**Decision:** Not yet designed - focus on Gen 1 for alpha

---

## Quick Reference

### When Creating a Remix
- Pay: 1 STX per source loop
- Get: License to create derivative work
- Own: 0% IP (you're the remixer, not IP holder)
- Earn: 20% commission on future sales

### When Your Remix Sells
- Buyer pays: Full price you set
- You receive: 20% of sale price
- Creators receive: 80% of sale price (split by IP %)

### When Your Loop Gets Remixed
- You receive: 1 STX licensing fee immediately
- You own: 50% of the remix IP
- You earn: 40% of remix sales revenue (80% pool × 50% IP)

---

## Authority Hierarchy

**If there's ever confusion, trust this order:**

1. **Code:** `lib/calculateRemixSplits.ts` (the actual truth)
2. **Tests:** `scripts/test-remix-splits.ts` (validates the code)
3. **This Doc:** `REMIX-SYSTEM-AUTHORITATIVE.md` (human explanation)
4. **CLAUDE.md:** Section on Gen 1 Remix IP Splits (summary)

**Ignore:**
- Old planning docs in `/docs/archive/`
- Any document using confusing "80/20" terminology for IP

---

**Last Updated:** October 23, 2025
**Implementation Status:** Gen 1 creation and IP attribution ✅ | Downstream sales 🚧 Planned
**Smart Contract:** `music-payment-splitter-v3` (live on Stacks mainnet)
