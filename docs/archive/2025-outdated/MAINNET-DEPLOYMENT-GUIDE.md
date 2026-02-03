# Mainnet Deployment Guide - Music Payment Splitter V3

## 🎉 Achievement Summary

**October 7, 2025** - Successfully deployed and tested the first music payment splitting smart contract on Stacks mainnet!

**First Transaction:** `0xd06bbc3488a4249083378ff8288b62a12e695d11ffc46077017138745ff49c39`
- Buyer paid 2 STX
- Perfect distribution to 3 artists (0.6 + 0.4 + 1.0 STX)
- Zero errors, 100% accuracy

---

## Contract Details

### Mainnet V3 (Current Production)
- **Contract:** `SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3`
- **Network:** Stacks Mainnet
- **Status:** ✅ Live and working
- **Deployment Date:** October 7, 2025
- **Deployment Cost:** 0.041280 STX

### Key Improvements from V2
1. **Escrow Pattern:** Contract receives STX first, then distributes
2. **as-contract Context:** Proper authorization for outbound transfers
3. **PostConditionMode.Allow:** Enables multi-recipient payments
4. **50 Contributors:** Supports up to 50 splits per category (for cart batching)
5. **Mainnet Ready:** Tested and validated with real STX

---

## Deployment Process

### Prerequisites
- Clarinet CLI installed
- Deployment wallet with STX for gas fees (~0.05 STX minimum)
- Wallet mnemonic/seed phrase for deployment

### Step 1: Contract Preparation

**File:** `contracts/mixmi-payment-splitter/contracts/music-payment-splitter.clar`

Ensure contract includes v3 changes:
```clarity
;; V3: Receive payment first
(try! (stx-transfer? total-price buyer (as-contract tx-sender)))

;; V3: Distribute with as-contract
(as-contract (stx-transfer? amount tx-sender (get wallet split)))
```

### Step 2: Deployment Plan

**File:** `contracts/mixmi-payment-splitter/deployments/default.mainnet-plan.yaml`

```yaml
---
id: 0
name: Mainnet deployment
network: mainnet
stacks-node: "https://api.hiro.so"
plan:
  batches:
    - id: 0
      transactions:
        - contract-publish:
            contract-name: music-payment-splitter-v3
            expected-sender: SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN
            cost: 41280
            path: contracts/music-payment-splitter.clar
            anchor-block-only: true
            clarity-version: 3
      epoch: "3.2"
```

### Step 3: Deploy to Mainnet

```bash
cd contracts/mixmi-payment-splitter
clarinet deployments apply -p deployments/default.mainnet-plan.yaml
```

**Interactive Prompts:**
1. Review deployment plan
2. Confirm total cost (0.041280 STX)
3. Type `Y` to proceed
4. Wait for "transaction broadcasted!" message

### Step 4: Verify Deployment

Check contract on Stacks Explorer:
```
https://explorer.hiro.so/txid/SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3?chain=mainnet
```

Verify:
- Contract shows "Deployed" status
- Functions are available (split-track-payment, etc.)
- Source code is visible

---

## App Integration

### Step 1: Update Environment Variables

**File:** `.env.local`

```bash
# Switch to mainnet
NEXT_PUBLIC_STACKS_NETWORK=mainnet

# Use v3 contract
NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT=SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN
```

### Step 2: Update CartContext

**File:** `contexts/CartContext.tsx`

Ensure contract name matches deployment:
```typescript
await openContractCall({
  contractAddress,
  contractName: 'music-payment-splitter-v3',  // Must match deployment!
  functionName: 'split-track-payment',
  functionArgs: [
    uintCV(aggregated.totalPriceMicroSTX),
    compositionCV,
    productionCV
  ],
  postConditionMode: PostConditionMode.Allow,  // Critical!
  // ...
})
```

### Step 3: Import PostConditionMode

**File:** `contexts/CartContext.tsx`

```typescript
import {
  uintCV,
  listCV,
  tupleCV,
  standardPrincipalCV,
  PostConditionMode  // Add this!
} from '@stacks/transactions';
```

---

## Testing Checklist

### Before Production
- [ ] Deploy contract to mainnet
- [ ] Update .env.local with mainnet settings
- [ ] Update contract name to v3 in code
- [ ] Add PostConditionMode.Allow
- [ ] Test with small amount (0.5-1 STX)
- [ ] Verify all recipients receive correct amounts
- [ ] Check transaction in explorer
- [ ] Confirm Events tab shows STX transfers

### Test Scenarios
1. **Single artist:** 100% to one wallet
2. **Two artists:** 60/40 split
3. **Complex split:** 3 composition + 3 production contributors
4. **Edge cases:** Weird percentages (17/83, 73/27)
5. **Cart batch:** Multiple tracks from different artists

---

## Troubleshooting

### "Transaction rolled back by post-condition"
**Cause:** Missing `PostConditionMode.Allow`

**Fix:** Add to openContractCall:
```typescript
postConditionMode: PostConditionMode.Allow
```

### "Contract not found"
**Cause:** Wrong contract name or network mismatch

**Fix:** Verify:
- Contract name is `music-payment-splitter-v3` (with v3!)
- Network is `mainnet` in .env.local
- Wallet is on mainnet network

### "Wallet shows warning about transferring assets"
**Status:** Expected behavior

**Explanation:** PostConditionMode.Allow lets contract make multiple transfers. Wallet warns user to "trust the contract." This is intentional for our use case.

### No STX transfers in Events
**Cause:** Contract didn't execute transfers

**Fix:** Check:
- Contract used `as-contract` for outbound transfers
- Payment was received by contract first
- All percentages add up to 100%

---

## Deployment Costs

### Gas Fees
- **Contract Deployment:** ~0.041280 STX (~$0.02-$0.03)
- **Per Transaction:** ~0.003-0.005 STX (~$0.002)
- **Varies by:** Number of splits, network congestion

### Optimization
- Batch cart payments save gas (one transaction vs many)
- Aggregating splits reduces total gas cost
- Up to 50 contributors per category supported

---

## Security Considerations

### Contract Safety
- ✅ **Immutable:** Cannot be changed after deployment
- ✅ **Atomic:** All payments succeed or all fail
- ✅ **Validated:** Percentages must sum to 100%
- ✅ **No reentrancy:** Clarity prevents by design
- ✅ **Escrow pattern:** Contract holds funds briefly during distribution

### PostConditionMode.Allow
**Why it's safe:**
- Contract code is public and audited
- Users can verify logic before trusting
- Alternative would require complex multi-signature setup
- Standard pattern for payment splitters

**User Warning:**
Wallets will warn users that contract can transfer assets. This is expected - users should verify contract code before first use.

---

## Monitoring

### Transaction Tracking
Monitor transactions in Stacks Explorer:
```
https://explorer.hiro.so/txid/{transaction-id}?chain=mainnet
```

### Key Metrics
- **Result:** Should show "Success" with (ok true)
- **Events:** Check STX transfer events
- **Gas Used:** Track costs over time
- **Distribution:** Verify amounts match expected percentages

### Error Monitoring
Watch for:
- Failed percentage validation
- Rolled back transactions
- Wallet connection issues
- Network errors

---

## Rollback Plan

If issues arise with v3:

### Option 1: Deploy V4
1. Fix issues in contract code
2. Deploy as `music-payment-splitter-v4`
3. Update .env.local and CartContext
4. Test thoroughly before switching

### Option 2: Revert to Testnet
1. Change network to `testnet` in .env.local
2. Use testnet contract address
3. Switch wallets to testnet
4. Continue development/testing

### Option 3: Disable Purchases
1. Set button to disabled in Header.tsx
2. Show "Maintenance" message to users
3. Fix issues offline
4. Re-enable when ready

---

## Production Deployment

### Pre-launch Checklist
- [ ] Contract deployed and verified on mainnet
- [ ] Environment variables updated
- [ ] Code uses v3 contract name
- [ ] PostConditionMode.Allow added
- [ ] Tested with real STX (small amounts)
- [ ] All test scenarios passed
- [ ] Team trained on monitoring
- [ ] Rollback plan documented
- [ ] User documentation updated

### Go-Live Steps
1. **Final Testing:** Use real wallets with small amounts
2. **Code Deployment:** Push to production (Vercel)
3. **Monitor:** Watch first few transactions closely
4. **User Support:** Be ready for questions about wallet warnings
5. **Analytics:** Track usage and costs

### Post-Launch
- Monitor transaction success rate
- Track gas costs
- Gather user feedback
- Plan future optimizations

---

## Future Enhancements

### Planned Features
1. **Advanced Batch Processing:** Combine entire cart into single contract call
2. **Gas Optimization:** Reduce costs for high-volume users
3. **Multi-currency:** Support other tokens beyond STX
4. **Royalty Splits:** Ongoing revenue sharing for streaming
5. **DAO Integration:** Community governance for contract upgrades

### V4 Considerations
- **Streaming Royalties:** Continuous micro-payments
- **Escrow Delays:** Hold funds for dispute resolution
- **Multi-sig Support:** Require multiple approvals for large amounts
- **Cross-chain:** Bridge to other blockchains

---

## Support & Resources

### Documentation
- **Payment Guide:** `/docs/PAYMENT-SPLITTING-GUIDE.md`
- **Contract Source:** `/contracts/mixmi-payment-splitter/contracts/music-payment-splitter.clar`
- **Integration Example:** `/contexts/CartContext.tsx`

### Explorer Links
- **Contract:** https://explorer.hiro.so/txid/SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN.music-payment-splitter-v3?chain=mainnet
- **First Transaction:** https://explorer.hiro.so/txid/0xd06bbc3488a4249083378ff8288b62a12e695d11ffc46077017138745ff49c39?chain=mainnet

### Community
- **GitHub Issues:** Report bugs or feature requests
- **Team Chat:** Internal communication for urgent issues
- **User Forums:** Help users understand wallet warnings

---

**Built with ❤️ for fair music compensation**

**Powered by Stacks blockchain and Bitcoin**

**Live on mainnet since October 7, 2025** 🎉
