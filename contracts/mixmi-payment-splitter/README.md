# Music Payment Splitter Smart Contract

## 🎉 Live on Mainnet!

**Contract:** `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3`

**First successful transaction:** October 7, 2025
- Buyer paid 2 STX
- Perfect distribution to 3 artists
- 100% accuracy, zero errors

[View on Explorer](https://explorer.hiro.so/txid/SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3?chain=mainnet)

---

## Overview

Automatically splits music purchase payments between composition (idea) and sound recording (production) rights holders with mathematical precision.

### Key Features
- ✅ **50/50 Split:** Composition vs Production rights
- ✅ **Up to 50 Contributors:** Per category (supports cart batching)
- ✅ **Percentage Validation:** Automatic 100% total verification
- ✅ **Escrow Pattern:** Secure receive-then-distribute flow
- ✅ **Atomic Transactions:** All succeed or all fail
- ✅ **Production Ready:** Live on mainnet with real transactions

---

## Contract Versions

### V3 (Mainnet - Current)
- **Address:** `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3`
- **Network:** Mainnet
- **Status:** ✅ Production
- **Deployed:** October 7, 2025

**Key Changes:**
- Escrow pattern: receives payment before distributing
- `as-contract` for proper outbound transfer authorization
- Supports up to 50 contributors per category

### V2 (Testnet - Development)
- **Address:** `ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB.music-payment-splitter`
- **Network:** Testnet4
- **Status:** Testing only

### V1 (Deprecated)
- Original testnet version with transfer authorization issues

---

## How It Works

### Payment Flow

```
1. Buyer approves transaction (2 STX)
   ↓
2. Contract receives 2 STX (escrow)
   ↓
3. Split 50/50: 1 STX composition, 1 STX production
   ↓
4. Distribute composition (60% + 40%)
   - Artist A: 0.6 STX
   - Artist B: 0.4 STX
   ↓
5. Distribute production (100%)
   - Artist C: 1.0 STX
```

### Contract Logic

```clarity
;; Main function signature
(define-public (split-track-payment
  (total-price uint)
  (composition-splits (list 50 {wallet: principal, percentage: uint}))
  (recording-splits (list 50 {wallet: principal, percentage: uint})))

  ;; Step 1: Receive payment (CRITICAL for v3)
  (try! (stx-transfer? total-price buyer (as-contract tx-sender)))

  ;; Step 2: Validate percentages sum to 100
  (asserts! (unwrap! (validate-percentages composition-splits) ...))
  (asserts! (unwrap! (validate-percentages recording-splits) ...))

  ;; Step 3: Distribute 50% to composition rights holders
  (try! (distribute-splits (/ total-price u2) composition-splits))

  ;; Step 4: Distribute 50% to production rights holders
  (try! (distribute-splits (/ total-price u2) recording-splits))

  (ok true)
)
```

---

## Usage

### From JavaScript/TypeScript

```typescript
import { openContractCall } from '@stacks/connect';
import {
  uintCV,
  listCV,
  tupleCV,
  standardPrincipalCV,
  PostConditionMode
} from '@stacks/transactions';

await openContractCall({
  contractAddress: 'SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN',
  contractName: 'music-payment-splitter-v3',
  functionName: 'split-track-payment',
  functionArgs: [
    uintCV(2000000), // 2 STX in microSTX
    listCV([
      tupleCV({
        wallet: standardPrincipalCV('SP4V544...'),
        percentage: uintCV(60)
      }),
      tupleCV({
        wallet: standardPrincipalCV('SP60C6T...'),
        percentage: uintCV(40)
      })
    ]),
    listCV([
      tupleCV({
        wallet: standardPrincipalCV('SPNYMNZ...'),
        percentage: uintCV(100)
      })
    ])
  ],
  postConditionMode: PostConditionMode.Allow, // CRITICAL!
  onFinish: (data) => console.log('Success!', data),
  onCancel: () => console.log('Cancelled')
});
```

### From Clarity

```clarity
(contract-call?
  'SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3
  split-track-payment
  u2000000 ;; 2 STX
  (list
    {wallet: 'SP4V544TMFQBX2VH0D9VEA3AZ8A9WVB97RQKDM3F, percentage: u60}
    {wallet: 'SP60C6T2VN2CN0T8BVR008J5B12ZMX2CF09NEK5T, percentage: u40}
  )
  (list
    {wallet: 'SPNYMNZY9XM0RJ7NKG76653YMJRKM5WSDM68RSZH, percentage: u100}
  )
)
```

---

## API Reference

### Public Functions

#### `split-track-payment`
Main payment distribution function.

**Parameters:**
- `total-price` (uint): Total amount in microSTX (1 STX = 1,000,000 microSTX)
- `composition-splits` (list 50): Composition rights holders with percentages
- `recording-splits` (list 50): Production rights holders with percentages

**Returns:** `(response bool uint)`

**Errors:**
- `err-invalid-amount` (u101): Total price must be > 0
- `err-empty-splits` (u104): At least one split required per category
- `err-invalid-percentage` (u103): Percentages don't sum to 100

### Read-Only Functions

#### `get-composition-pool`
Calculate composition pool amount (50% of total).

**Parameters:** `total-price` (uint)
**Returns:** `(ok uint)`

#### `get-recording-pool`
Calculate recording pool amount (50% of total).

**Parameters:** `total-price` (uint)
**Returns:** `(ok uint)`

#### `calculate-payment`
Calculate individual payment from pool and percentage.

**Parameters:**
- `pool-amount` (uint)
- `percentage` (uint)

**Returns:** `(ok uint)`

#### `validate-percentages`
Check if percentages sum to 100.

**Parameters:** `splits` (list)
**Returns:** `(ok bool)`

---

## Testing

### Test on Mainnet (Carefully!)

1. Use small amounts first (0.5-1 STX)
2. Verify splits in Stacks Explorer Events tab
3. Check all recipients received correct amounts
4. Review transaction fees

### Example Test Cases

**Simple Split:**
```clarity
;; 1 STX, two equal composition, one production
total-price: u1000000
composition: [
  {wallet: Alice, percentage: u50},
  {wallet: Bob, percentage: u50}
]
recording: [
  {wallet: Charlie, percentage: u100}
]
```

**Complex Split:**
```clarity
;; 3 STX, uneven splits
total-price: u3000000
composition: [
  {wallet: Alice, percentage: u60},
  {wallet: Bob, percentage: u30},
  {wallet: Charlie, percentage: u10}
]
recording: [
  {wallet: Dana, percentage: u70},
  {wallet: Eve, percentage: u30}
]
```

---

## Deployment

### Prerequisites
- Clarinet CLI
- STX for gas fees (~0.05 STX)
- Deployment wallet mnemonic

### Deploy to Mainnet

```bash
cd contracts/mixmi-payment-splitter
clarinet deployments apply -p deployments/default.mainnet-plan.yaml
```

See [MAINNET-DEPLOYMENT-GUIDE.md](/docs/MAINNET-DEPLOYMENT-GUIDE.md) for complete instructions.

---

## Security

### Contract Safety
- ✅ **Immutable:** Cannot be changed after deployment
- ✅ **Atomic:** All payments succeed or all fail
- ✅ **Validated:** Percentages must sum to 100%
- ✅ **No reentrancy:** Clarity prevents by design
- ✅ **Escrow pattern:** Brief custody during distribution

### PostConditionMode.Allow

The contract requires `PostConditionMode.Allow` because it makes multiple STX transfers:
1. Buyer → Contract (escrow)
2. Contract → Each artist (distribution)

Wallets will warn users to "trust the contract" - this is expected. Users should verify contract code before first use.

### Auditing
- Source code is public on-chain
- Can be verified in Stacks Explorer
- Mathematical logic is transparent
- Distribution pattern is provable

---

## Gas Costs

- **Deployment:** ~0.041280 STX
- **Per Transaction:** ~0.003-0.005 STX
- **Varies by:** Number of splits, network congestion

**Optimization:** Batch cart payments save gas (one tx vs many)

---

## Known Limitations

### Rounding ("Dust")
Integer division can create sub-microSTX dust:
- 1 STX ÷ 3 = 333,333 + 333,333 + 333,333 = 999,999 microSTX
- Missing: 1 microSTX (0.000001 STX ≈ $0.0000006)

This is acceptable and standard practice for blockchain payment splitting.

### Maximum Contributors
- 50 per category (composition + recording)
- Supports most use cases including cart batching
- Can be increased in future versions if needed

### Minimum Amounts
- Theoretical minimum: 1 microSTX
- Practical minimum: ~10,000 microSTX (0.01 STX)
- Below practical minimum, percentages may round to zero

---

## Troubleshooting

### "Transaction rolled back by post-condition"
**Solution:** Add `postConditionMode: PostConditionMode.Allow` to your contract call.

### "Percentages must sum to 100"
**Solution:** Verify composition splits and recording splits each total exactly 100.

### "Contract not found"
**Solution:** Check network (mainnet vs testnet) and contract name (`music-payment-splitter-v3`).

### No STX transfers in Events
**Solution:** Verify contract used v3 architecture (escrow pattern with `as-contract`).

---

## File Structure

```
contracts/mixmi-payment-splitter/
├── contracts/
│   ├── music-payment-splitter.clar        # V3 source (mainnet)
│   └── music-payment-splitter-v3.clar     # V3 copy
├── deployments/
│   ├── default.mainnet-plan.yaml          # Mainnet deployment config
│   └── default.testnet-plan.yaml          # Testnet deployment config
├── Clarinet.toml                          # Clarinet configuration
├── settings/
│   ├── Mainnet.toml                       # Mainnet wallet settings
│   └── Testnet.toml                       # Testnet wallet settings
└── README.md                              # This file
```

---

## Resources

### Documentation
- **Payment Guide:** `/docs/PAYMENT-SPLITTING-GUIDE.md`
- **Deployment Guide:** `/docs/MAINNET-DEPLOYMENT-GUIDE.md`
- **Integration Example:** `/contexts/CartContext.tsx`

### Links
- **Mainnet Contract:** https://explorer.hiro.so/txid/SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3?chain=mainnet
- **First Transaction:** https://explorer.hiro.so/txid/0xd06bbc3488a4249083378ff8288b62a12e695d11ffc46077017138745ff49c39?chain=mainnet
- **Stacks Docs:** https://docs.stacks.co
- **Clarity Docs:** https://book.clarity-lang.org

---

## Contributing

### Reporting Issues
- Test on testnet first
- Include transaction ID
- Provide exact error messages
- Share contract call parameters

### Proposing Changes
- Fork and create feature branch
- Test thoroughly on testnet
- Document changes
- Submit PR with test results

---

## License

MIT License - See LICENSE file for details

---

**Built with ❤️ for fair music compensation**

**Powered by Stacks blockchain and Bitcoin**

**Live on mainnet since October 7, 2025** 🎉
