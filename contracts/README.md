# mixmi Music Payment Splitter Smart Contract

## Overview

This Clarity smart contract handles payment splitting for music purchases on the mixmi platform. It divides payments between **composition rights** (idea) and **sound recording rights** (implementation), ensuring fair compensation for all contributors.

## How It Works

### Payment Structure

Each music purchase is split into two equal pools:
- **50% Composition Pool** - Distributed among composition rights holders
- **50% Sound Recording Pool** - Distributed among recording rights holders

Each pool is then distributed to contributors based on their percentage ownership (stored in database).

### Example

**Purchase: 2.5 STX track**

**Composition Rights:**
- Alice: 60% → receives 0.75 STX
- Bob: 40% → receives 0.50 STX

**Sound Recording Rights:**
- Charlie: 70% → receives 0.875 STX
- Dana: 30% → receives 0.375 STX

**Total distributed: 2.5 STX** ✅

## Rounding & Dust Handling

When percentages don't divide evenly, small amounts of "dust" can be created due to integer division.

**Example:**
- 1.0 STX split 3 ways: 333,333 + 333,333 + 333,333 = 999,999 microSTX
- **Missing: 1 microSTX**

**Solution:** Any remainder is automatically added to the first recipient's payment. This follows industry standard practice (used by Stripe, PayPal, etc.).

## Contract Functions

### Public Functions

#### `split-track-payment`
Main payment distribution function.

**Parameters:**
- `total-price` (uint): Total purchase price in microSTX
- `composition-splits` (list): Composition contributors and percentages
- `recording-splits` (list): Recording contributors and percentages

**Example:**
```clarity
(split-track-payment
  u2500000  ;; 2.5 STX
  (list
    {wallet: 'SP123..., percentage: u60}
    {wallet: 'SP456..., percentage: u40}
  )
  (list
    {wallet: 'SP789..., percentage: u70}
    {wallet: 'SPABC..., percentage: u30}
  )
)
```

### Read-Only Functions

#### `preview-split`
Calculate payment distribution without executing transfers.

**Use case:** Show users exactly how much each contributor will receive before purchase.

**Returns:**
```clarity
{
  composition-payments: (list {wallet: principal, amount: uint}),
  recording-payments: (list {wallet: principal, amount: uint}),
  total: uint
}
```

#### `validate-percentages`
Check if split percentages add up to 100%.

**Parameters:**
- `splits` (list): Contributors and percentages

**Returns:** `(ok true)` if valid, `(ok false)` if not

## Integration

### Frontend Flow

1. User adds track to cart
2. User clicks "Purchase All"
3. Frontend calls `/api/calculate-splits` with track IDs
4. Backend queries database for all contributors and percentages
5. Backend returns formatted splits for smart contract
6. Frontend calls smart contract via `@stacks/connect`
7. User approves transaction in wallet
8. Contract distributes payments atomically
9. All contributors receive payment simultaneously

### Backend API (to be implemented)

```typescript
// GET /api/calculate-splits?trackIds=abc,xyz
{
  trackId: "abc",
  totalPrice: 2500000, // microSTX
  compositionSplits: [
    { wallet: "SP123...", percentage: 60 },
    { wallet: "SP456...", percentage: 40 }
  ],
  recordingSplits: [
    { wallet: "SP789...", percentage: 70 },
    { wallet: "SPABC...", percentage: 30 }
  ]
}
```

## Security Features

✅ **Atomic Transactions** - All payments succeed or all fail
✅ **No Reentrancy** - Clarity prevents this by design
✅ **Input Validation** - Price and splits validated
✅ **Dust Handling** - No microSTX lost to rounding
✅ **Gas Optimization** - Efficient list operations

## Testing

### Manual Testing (Testnet)

1. Deploy contract to Stacks testnet
2. Create test wallet addresses
3. Call `preview-split` to verify calculations
4. Execute `split-track-payment` with test STX
5. Verify all recipients received correct amounts

### Test Cases

- ✅ Single contributor (100%)
- ✅ Even split (50/50)
- ✅ Uneven split (60/40)
- ✅ Three-way split (rounding test)
- ✅ Maximum contributors (10 per category)
- ✅ Dust handling verification

## Future Enhancements

### Phase 2: Batch Cart Payments
Support multiple tracks from different artists in single transaction:
- Aggregate all splits across cart items
- Combine payments to same wallet
- Execute as one atomic transaction

**Example:**
```
Cart: Track A + Track B + Track C
Result: 8 unique recipients receive payments
Total: 6.5 STX distributed in one transaction
```

## Deployment

### Prerequisites
- Clarinet CLI installed
- Testnet STX for deployment
- Stacks wallet with deployment keys

### Deploy to Testnet
```bash
clarinet deploy --testnet
```

### Deploy to Mainnet
```bash
clarinet deploy --mainnet
```

## Contract Details

- **Language:** Clarity 2.0
- **Max Contributors per Category:** 10
- **Minimum Payment:** 1 microSTX (0.000001 STX)
- **Gas Cost:** ~5,000-15,000 microSTX depending on split count

## Support

For questions or issues:
- GitHub Issues: [mixmi-alpha-fresh repository]
- Documentation: `/docs/STX-PAYMENT-INTEGRATION.md`

---

**Built with ❤️ for the mixmi music platform**
**Powered by Stacks blockchain and Bitcoin**
