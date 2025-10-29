# Remix Payment System - Collaborative Music Economy

## Overview

The mixmi remix system creates a **compounding collaborative economy** where artists can mix existing loops together, paying the original creators and earning ownership of the new creation. This builds on the proven v3 payment splitter contract already live on mainnet.

**Key Principle:** When you remix two loops together, you pay for both originals, and the resulting 8-bar mix is owned 80% by original creators + 20% by you (the remixer).

---

## How It Works

### Step 1: Load Loops into Mixer

**Remixer (Grace)** loads two loops:
- **Deck 1:** Loop A (created by Alice, Bob, Charlie) - costs 1 STX
- **Deck 2:** Loop B (created by Dana, Eve, Frank) - costs 1 STX

**Total Cost to Remix:** 2 STX

### Step 2: Payment Distribution

When Grace pays the 2 STX remix fee:

```
Grace pays 2 STX →
├── 1 STX → Loop A original creators
│   ├── Composition (0.5 STX): Alice 60%, Bob 40%
│   └── Production (0.5 STX): Charlie 100%
│
└── 1 STX → Loop B original creators
    ├── Composition (0.5 STX): Dana 50%, Eve 50%
    └── Production (0.5 STX): Frank 100%
```

**Result:** All original creators get paid immediately via the v3 smart contract.

### Step 3: Record 8-Bar Mix

Grace records 8 bars from the mix. The **new loop** is now a derivative work with these ownership splits:

#### New Loop Ownership (80/20 Rule)

**80% to Original Creators + 20% to Remixer**

**Composition Rights:**
- Alice: 24% (60% of Loop A × 40% pool share)
- Bob: 16% (40% of Loop A × 40% pool share)
- Dana: 20% (50% of Loop B × 40% pool share)
- Eve: 20% (50% of Loop B × 40% pool share)
- **Grace (remixer): 20%**
- **Total: 100%** ✅

**Production Rights:**
- Charlie: 40% (100% of Loop A × 40% pool share)
- Frank: 40% (100% of Loop B × 40% pool share)
- **Grace (remixer): 20%**
- **Total: 100%** ✅

### Step 4: New Loop Goes on Sale

The new 8-bar remix is saved with these splits and can be:
- Listed for sale (Grace sets the price)
- Remixed by someone else (creating another generation)
- Used in the mixer by other artists

When someone **buys** the remix, payments are automatically distributed using the v3 contract.

When someone **remixes** the remix, the cycle continues with 80/20 splits propagating value!

---

## Mathematical Formula

### Original Loop Purchase Split (Already Working)

```
Purchase Price = P
Composition Pool = P ÷ 2
Production Pool = P ÷ 2

Each contributor receives: (Pool × Percentage) ÷ 100
```

### Remix Ownership Calculation (New Logic Needed)

For a 2-loop remix:

```
Remix Fee = Loop A Price + Loop B Price = R

Original Creators Pool = 80% of new loop ownership
Remixer Ownership = 20% of new loop ownership

For Composition Rights:
- Loop A contributors × (50% × 80%) = share of composition
- Loop B contributors × (50% × 80%) = share of composition
- Remixer gets remaining 20%

For Production Rights:
- Loop A contributors × (50% × 80%) = share of production
- Loop B contributors × (50% × 80%) = share of production
- Remixer gets remaining 20%
```

**Generalized for N loops:**
```
Each original loop's share = (1/N) × 80%
Remixer always gets = 20%
```

---

## Example Scenarios

### Scenario 1: Simple Two-Loop Remix

**Loop A (1 STX):**
- Alice: 100% composition, 100% production

**Loop B (1 STX):**
- Bob: 100% composition, 100% production

**Grace remixes both:**
- Pays 2 STX (1 to Alice, 1 to Bob)
- New loop ownership:
  - **Composition:** Alice 40%, Bob 40%, Grace 20%
  - **Production:** Alice 40%, Bob 40%, Grace 20%

### Scenario 2: Complex Multi-Contributor Remix

**Loop A (1 STX):**
- Composition: Alice 60%, Bob 40%
- Production: Charlie 70%, Dana 30%

**Loop B (1 STX):**
- Composition: Eve 100%
- Production: Frank 50%, Grace 50%

**Henry remixes both:**
- Pays 2 STX → distributed to A's and B's contributors
- New loop ownership:
  - **Composition:**
    - From Loop A: Alice 24% (60% × 40%), Bob 16% (40% × 40%)
    - From Loop B: Eve 40% (100% × 40%)
    - Henry (remixer): 20%
  - **Production:**
    - From Loop A: Charlie 28% (70% × 40%), Dana 12% (30% × 40%)
    - From Loop B: Frank 20% (50% × 40%), Grace 20% (50% × 40%)
    - Henry (remixer): 20%

### Scenario 3: Remix of a Remix (Generational)

**Original Loop (created by Alice):**
- Alice: 100% composition, 100% production

**First Remix by Bob:**
- Bob pays 1 STX to Alice
- New ownership: Alice 80%, Bob 20%

**Second Remix by Charlie (remixes Bob's remix):**
- Charlie pays price set by Bob/Alice's remix
- Payment distributed: Alice 80%, Bob 20%
- New ownership: Alice 64% (80% × 80%), Bob 16% (20% × 80%), Charlie 20%

**Result:** Alice's ownership dilutes with each generation, but she continues earning!

---

## Technical Implementation

### Database Schema Updates

**New table: `remix_sessions`**
```sql
CREATE TABLE remix_sessions (
  id UUID PRIMARY KEY,
  remixer_wallet VARCHAR NOT NULL,
  deck_1_loop_id UUID REFERENCES ip_tracks(id),
  deck_2_loop_id UUID REFERENCES ip_tracks(id),
  total_cost_stx DECIMAL NOT NULL,
  payment_tx_id VARCHAR, -- Blockchain transaction ID
  created_at TIMESTAMP DEFAULT NOW()
);
```

**New table: `remix_splits_calculation`**
```sql
CREATE TABLE remix_splits_calculation (
  remix_session_id UUID REFERENCES remix_sessions(id),
  contributor_wallet VARCHAR NOT NULL,
  composition_percentage INTEGER,
  production_percentage INTEGER,
  source_loop_id UUID REFERENCES ip_tracks(id) -- Which loop they came from
);
```

### Payment Flow

**Step 1: Calculate Total Cost**
```typescript
const totalCost = deck1Loop.price_stx + deck2Loop.price_stx;
```

**Step 2: Pay Original Creators (Existing v3 Contract)**
```typescript
// Aggregate splits from both loops
const aggregatedPayment = aggregateLoopPayments([
  {
    trackId: deck1Loop.id,
    totalPriceMicroSTX: deck1Loop.price_stx * 1000000,
    compositionSplits: deck1Loop.compositionSplits,
    productionSplits: deck1Loop.productionSplits
  },
  {
    trackId: deck2Loop.id,
    totalPriceMicroSTX: deck2Loop.price_stx * 1000000,
    compositionSplits: deck2Loop.compositionSplits,
    productionSplits: deck2Loop.productionSplits
  }
]);

// Pay via v3 contract (already working!)
await openContractCall({
  contractAddress: 'SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN',
  contractName: 'music-payment-splitter-v3',
  functionName: 'split-track-payment',
  functionArgs: [...],
  postConditionMode: PostConditionMode.Allow
});
```

**Step 3: Calculate New Loop Ownership**
```typescript
function calculateRemixSplits(
  loop1Splits: SplitData,
  loop2Splits: SplitData,
  remixerWallet: string
): NewLoopSplits {

  const ORIGINAL_SHARE = 0.8; // 80%
  const REMIXER_SHARE = 0.2; // 20%
  const POOL_PER_LOOP = 0.5; // Each loop contributes 50% to the 80% pool

  const newCompositionSplits = [];
  const newProductionSplits = [];

  // Add Loop 1 composition contributors (scaled to 40% of total)
  for (const split of loop1Splits.composition) {
    newCompositionSplits.push({
      wallet: split.wallet,
      percentage: Math.floor(split.percentage * POOL_PER_LOOP * ORIGINAL_SHARE)
    });
  }

  // Add Loop 2 composition contributors (scaled to 40% of total)
  for (const split of loop2Splits.composition) {
    newCompositionSplits.push({
      wallet: split.wallet,
      percentage: Math.floor(split.percentage * POOL_PER_LOOP * ORIGINAL_SHARE)
    });
  }

  // Add remixer (20%)
  newCompositionSplits.push({
    wallet: remixerWallet,
    percentage: Math.floor(REMIXER_SHARE * 100)
  });

  // Same logic for production splits...

  return {
    composition: newCompositionSplits,
    production: newProductionSplits
  };
}
```

**Step 4: Save New Loop with Calculated Splits**
```typescript
await supabase.from('ip_tracks').insert({
  title: `${deck1Loop.title} × ${deck2Loop.title} Remix`,
  artist: remixerWallet,
  is_remix: true,
  parent_loop_1_id: deck1Loop.id,
  parent_loop_2_id: deck2Loop.id,
  remix_session_id: sessionId,
  price_stx: remixerSetPrice,
  composition_split_1_wallet: newSplits.composition[0].wallet,
  composition_split_1_percentage: newSplits.composition[0].percentage,
  // ... all other splits
});
```

---

## Smart Contract Integration

**Good News:** The v3 contract already supports everything we need!

✅ **Escrow pattern** - Receives payment, then distributes
✅ **Multi-recipient** - Handles up to 50 contributors
✅ **Percentage-based** - Perfect for remix calculations
✅ **PostConditionMode.Allow** - Handles complex flows
✅ **Cart aggregation** - Can batch multiple loop purchases

**No contract changes needed!** The remix payment is just another cart purchase with aggregated splits.

---

## User Experience Flow

### In the Mixer

1. **Load Loops:**
   - User drags Loop A to Deck 1
   - User drags Loop B to Deck 2
   - UI shows: "Remix cost: X STX (Loop A) + Y STX (Loop B) = Total STX"

2. **Mix & Record:**
   - User mixes the loops together
   - User records 8 bars they want to save
   - UI shows preview waveform of the 8-bar selection

3. **Save Remix (All-in-One Modal):**
   - Click "Save Remix" button
   - Single modal with ALL information (no multiple steps!):

   **User Inputs (Minimal):**
   - Name: [Auto-filled: "Loop A × Loop B Remix"] (editable)
   - Description: [Optional]
   - BPM: [Auto-detected] (editable)
   - Tags: [Auto-suggested from source loops] (optional)
   - Price: [User sets selling price]

   **Auto-Displayed Info:**
   - Cost: 2 STX (1 STX to Loop A creators + 1 STX to Loop B creators)
   - Ownership: "You'll own 20%, original creators own 80%"
   - Ownership breakdown preview (which wallets get what %)

   - [Cancel] [Save & Pay 2 STX] button

4. **Payment & Auto-Registration:**
   - Wallet opens with remix fee payment
   - Smart contract distributes to original creators
   - **Backend automatically:**
     - Calculates all splits (user never enters them!)
     - Saves new loop to `ip_tracks` with:
       - User's name, description, BPM, tags, price
       - Auto-calculated composition splits
       - Auto-calculated production splits
       - Links to parent loops (remix genealogy)
       - Uploaded audio file
   - Success message: "Remix saved! You own 20%, creators own 80%"

5. **Instant Availability:**
   - New loop immediately appears on globe
   - Listed in your store/crate
   - Available for purchase by others
   - Available to be remixed again!

### Why Direct Payment (No Cart)?

**Creation Mode vs Shopping Mode:**
- 🎨 **Remix (Creation):** You know exactly what you're paying for (the mix you just made). Pay immediately, own immediately.
- 🛒 **Purchase (Shopping):** Browse multiple tracks, compare, add to cart, batch checkout.

**This is the same pattern as:**
- Buying coffee: Order → Pay → Receive (no cart)
- vs
- Grocery shopping: Browse → Cart → Checkout (batch purchase)

---

## Business Model Benefits

### For Original Creators
- **Passive income** from remixes of their work
- **Generational royalties** that compound over time
- **Value appreciation** as loops get remixed into popular tracks
- **No middleman** - direct blockchain payments

### For Remixers
- **Instant ownership** of new creations
- **Fair 20% share** for creative work
- **Build on others** without complex licensing
- **Earn from future remixes** of their work

### For the Platform
- **Network effects** - More remixes = more value for everyone
- **Transparent payments** - All on-chain and verifiable
- **Reduced friction** - No contracts, no negotiations
- **Viral growth** - Each remix expands the ecosystem

---

## Edge Cases & Solutions

### Edge Case 1: Same Contributor in Both Loops
**Scenario:** Alice owns Loop A and Loop B. Bob remixes both.

**Solution:**
- Alice receives payment for both loops (2 STX)
- In new loop, Alice's percentages from both loops are combined
- If Alice had 50% comp in Loop A and 30% comp in Loop B:
  - New loop: Alice gets (50% × 40%) + (30% × 40%) = 32% composition

### Edge Case 2: Remixer Already Owns One Loop
**Scenario:** Grace owns Loop A (100%). She remixes it with Loop B.

**Solution:**
- Grace pays for both loops (including her own!)
- She receives back the payment for Loop A (already owns it)
- Net cost: Just Loop B price
- New ownership: Grace gets 40% (from Loop A) + 20% (remixer) = 60% total

### Edge Case 3: Percentage Rounding
**Scenario:** Splits create decimals (e.g., 33.33%)

**Solution:**
- Round down for all contributors
- Give remainder to remixer (or largest contributor)
- Ensure total always equals 100%

### Edge Case 4: Loop Has Many Contributors Already
**Scenario:** Loop A has 6 contributors, Loop B has 6 contributors

**Solution:**
- All 12 contributors get proportional shares of the 80%
- Contract supports up to 50 contributors (plenty of headroom!)
- If nearing limit, UI warns before allowing remix

---

## Future Enhancements

### Multi-Loop Remixes (3+ loops)
**Formula adjustment:**
```
Each loop's share = (1/N) × 80%
Remixer still gets 20%

For 3 loops: Each loop contributes 26.67% to the 80% pool
For 4 loops: Each loop contributes 20% to the 80% pool
```

### Dynamic Remixer Share
**Allow remixer to set their share:**
- Minimum: 10% (more generous to originals)
- Maximum: 30% (more reward for remix work)
- Default: 20% (fair split)

### Remix Chains & Genealogy
**Track remix lineage:**
- Show "family tree" of remixes
- Display generational value flow
- Highlight most remixed loops (viral content)

### Collaborative Remixes
**Multiple remixers working together:**
- Split the 20% remixer share among co-remixers
- All pay proportionally for the source loops
- Ownership distributed by contribution percentage

---

## Implementation Checklist

### Phase 1: Core Remix Payment
- [ ] Create `remix_sessions` and `remix_splits_calculation` tables
- [ ] Build `calculateRemixSplits()` function
- [ ] Integrate with existing v3 payment contract
- [ ] Test with 2-loop remix scenarios
- [ ] Add remix payment UI to mixer

### Phase 2: 8-Bar Recording & Saving
- [ ] Implement audio recording from mixer output
- [ ] Build waveform selection UI (choose 8 bars)
- [ ] Save recorded audio to Supabase storage
- [ ] Create new `ip_tracks` entry with calculated splits
- [ ] Display new remix on globe

### Phase 3: UX Polish
- [ ] Preview ownership breakdown before payment
- [ ] Show "Remix cost" calculator in mixer
- [ ] Success modal with ownership summary
- [ ] Remix genealogy visualization
- [ ] Set price & list new remix flow

### Phase 4: Advanced Features
- [ ] Support 3+ loop remixes
- [ ] Dynamic remixer share slider
- [ ] Collaborative remix mode
- [ ] Remix analytics dashboard

---

## Success Metrics

### Technical Metrics
- Remix payment success rate (target: 99%+)
- Average remix creation time (target: <30 seconds)
- Contract gas costs per remix (monitor trends)
- Database query performance for split calculations

### Business Metrics
- Number of remixes created per month
- Average remixer earnings
- Average original creator passive income
- Remix-to-purchase conversion rate
- Generational remix depth (how many layers)

### User Engagement
- % of users who try remixing
- Average remixes per active user
- Most remixed loops (viral content)
- Creator retention (earning from remixes)

---

## Conclusion

The remix payment system leverages the proven v3 smart contract to create a **compounding collaborative economy**. By ensuring original creators always earn 80% and remixers earn 20%, we create sustainable incentives for both creation and innovation.

**Key Advantages:**
- ✅ **Fair compensation** for all contributors
- ✅ **No contract changes** needed (uses existing v3)
- ✅ **Transparent & verifiable** (all on-chain)
- ✅ **Scales infinitely** (supports generational remixes)
- ✅ **Network effects** (every remix increases ecosystem value)

This system transforms music creation into a **collaborative value network** where everyone benefits from shared success.

---

**Built on the foundation of:**
- Music Payment Splitter v3 (Mainnet: `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3`)
- Proven with real STX transactions
- Live since October 7, 2025

**Next Steps:**
1. Review and approve this design
2. Begin Phase 1 implementation
3. Test on mainnet with small amounts
4. Launch to alpha users

🎵 **Building the future of collaborative music creation** 🎵
