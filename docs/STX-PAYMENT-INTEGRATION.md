# STX Payment Integration Documentation

## Overview

The STX Payment Integration enables users to purchase music content (loops, stems, full songs) using STX cryptocurrency via the Stacks blockchain. This integration leverages the `@stacks/connect` library to facilitate secure, decentralized transactions directly from the browser.

## Features

- **Shopping Cart**: Add multiple tracks to cart from Globe, Big Mixer, Store, or Search
- **Cart in Header**: Global cart icon in top-right corner (moved from Crate - Oct 2025)
- **Cart Persistence**: Cart contents persist in localStorage across sessions and pages
- **Cross-Page Consistency**: Cart state syncs seamlessly across all pages via CartContext
- **Wallet Integration**: Connect Stacks wallet (Hiro, Xverse) via header button
- **Transaction Flow**: ~~Seamless STX transfer with real-time status updates~~ **DISABLED** (Oct 2025)
- **Payment Status**: "Payments Coming Soon" button (disabled until smart contracts ready)
- **Multi-Artist Support**: Cart stores artist wallet addresses for future payment splitting
- **Unified Card System**: Consolidated card components ensure consistent price handling across all pages

## Technical Stack

### Dependencies
```json
{
  "@stacks/connect": "^8.1.7"
}
```

### Key Files

1. **`contexts/CartContext.tsx`** - Global cart state management (NEW - Oct 2025)
   - Cart state and localStorage persistence
   - Payment state management (currently disabled)
   - Cart functions (add, remove, clear)
   - `purchaseAll` async function (disabled until smart contracts ready)
   - Stores `primary_uploader_wallet` for future payment splitting

2. **`components/layout/Header.tsx`** - Shopping cart UI + wallet connect
   - Cart icon in top-right corner with item count badge
   - Cart dropdown showing items, prices, and total
   - "Payments Coming Soon" disabled button
   - Wallet connection UI in app header
   - Shows connected address or "Connect Wallet" prompt

3. **`components/shared/Crate.tsx`** - DJ crate (cart removed Oct 2025)
   - Shopping cart functionality moved to Header component
   - Now focused purely on DJ workflow (track staging for mixer)

4. **`contexts/AuthContext.tsx`** - Wallet authentication
   - Provides `isAuthenticated` and `walletAddress` state
   - Manages Stacks wallet connection via `@stacks/connect`

5. **`app/providers.tsx`** - Context providers
   - Wraps app with CartProvider for global cart access

## Implementation Details

### Cart State Management

```typescript
// Cart item interface (contexts/CartContext.tsx)
export interface CartItem {
  id: string;
  title: string;
  artist: string;
  price_stx: string;
  license?: string;
  primary_uploader_wallet?: string; // NEW - stores artist wallet for payment splitting
}

// Cart state with localStorage persistence
const [cart, setCart] = useState<CartItem[]>([]);

// Load from localStorage on mount
useEffect(() => {
  const savedCart = localStorage.getItem('mixmi-cart');
  if (savedCart) {
    setCart(JSON.parse(savedCart));
  }
}, []);

// Save to localStorage on change (skip initial mount)
useEffect(() => {
  if (isInitialMount.current) {
    isInitialMount.current = false;
    return;
  }
  localStorage.setItem('mixmi-cart', JSON.stringify(cart));
}, [cart]);

// Add to cart with artist wallet
const addToCart = (track: any) => {
  const cartItem: CartItem = {
    id: track.id,
    title: track.title || track.name,
    artist: track.artist || 'Unknown Artist',
    price_stx: track.price_stx?.toString() || '2.5',
    license: track.license || 'Standard',
    primary_uploader_wallet: track.primary_uploader_wallet // Store for future splitting
  };
  setCart([...cart, cartItem]);
};
```

### Payment Flow (CURRENTLY DISABLED - Oct 2025)

**Status**: Payment functionality disabled until smart contracts are implemented for multi-artist revenue splitting.

**The Issue**: Current implementation only sends payment to first artist in cart:
```typescript
const recipientAddress = cart[0]?.primary_uploader_wallet; // ❌ Only first artist gets paid!
```

**Why It's Disabled**: If cart contains tracks from multiple artists, only the first artist would receive payment for all tracks. This is unacceptable for a fair marketplace.

**Solution Required**: Smart contracts (Clarity) to automatically split payments:
- Cart with 3 tracks from 3 artists → 3 separate payments
- Each artist receives only payment for their tracks
- Revenue splits honor collaborator percentages
- Atomic transaction (all or nothing)

**Future Implementation** (when smart contracts ready):

```typescript
const purchaseAll = async () => {
  // 1. Validate wallet connection
  if (!isAuthenticated || !walletAddress) {
    setPurchaseError('Please connect your wallet first');
    setPurchaseStatus('error');
    setShowPurchaseModal(true);
    return;
  }

  // 2. Validate cart contents
  if (cart.length === 0) return;

  // 3. Group by artist and calculate splits
  const paymentsByArtist = cart.reduce((acc, item) => {
    const wallet = item.primary_uploader_wallet;
    if (!acc[wallet]) acc[wallet] = 0;
    acc[wallet] += parseFloat(item.price_stx);
    return acc;
  }, {});

  // 4. Execute smart contract for payment splitting
  try {
    setPurchaseStatus('pending');
    setShowPurchaseModal(true);

    // TODO: Call Clarity smart contract
    await executePaymentSplitContract({
      buyer: walletAddress,
      payments: paymentsByArtist, // { wallet1: 2.5, wallet2: 1.0, etc. }
      memo: `Purchase: ${cart.map(item => item.title).join(', ')}`,
      onFinish: (data) => {
        setPurchaseStatus('success');
        setTimeout(() => {
          clearCart();
          setShowPurchaseModal(false);
          setPurchaseStatus('idle');
        }, 3000);
      },
      onCancel: () => {
        setPurchaseStatus('idle');
        setShowPurchaseModal(false);
      }
    });
  } catch (error) {
    setPurchaseError(error.message);
    setPurchaseStatus('error');
  }
};
```

### Currency Conversion

**Important**: STX amounts must be converted to microSTX for blockchain transactions.

```typescript
// 1 STX = 1,000,000 microSTX
const amountInMicroSTX = Math.floor(cartTotal * 1000000);
```

Example:
- Cart total: 5 STX
- Converted: 5,000,000 microSTX
- Sent to blockchain: "5000000" (as string)

### Modal States

The purchase modal displays different UI based on transaction status:

1. **Pending**
   - Loading spinner
   - "Please confirm in wallet..." message
   - Transaction amount and item count
   - Cannot dismiss (prevents accidental cancellation)

2. **Success**
   - Green checkmark icon
   - "Payment Successful!" message
   - Auto-dismisses after 3 seconds
   - Cart clears automatically
   - Can dismiss via backdrop click

3. **Error**
   - Red X icon
   - Error message from wallet/blockchain
   - Manual dismiss via button or backdrop click
   - Cart remains intact for retry

## User Flow

1. **Browse Content**
   - Navigate Globe, Big Mixer, Store, or Search pages
   - Preview tracks by clicking thumbnails
   - Explore professional DJ mixer interface

2. **Add to Cart**
   - Hover over track → click cart icon
   - OR drag track to cart drop zone
   - Cart badge updates with item count

3. **Connect Wallet** (if not already connected)
   - Click "Connect Wallet" in header
   - Choose wallet (Hiro, Xverse, etc.)
   - Approve connection

4. **Review Cart**
   - Click cart icon in Crate to expand
   - Review items and total price
   - Remove items if needed

5. **Purchase**
   - Click "Purchase All" button
   - Modal appears with pending status
   - Wallet extension prompts for confirmation
   - Approve transaction in wallet

6. **Confirmation**
   - Modal shows success state
   - Cart clears after 3 seconds
   - Transaction submitted to blockchain

## Testing Guide

### Prerequisites
- Stacks wallet extension installed (Hiro or Xverse)
- Testnet STX for testing (get from faucet)
- Dev server running on http://localhost:3001

### Test Cases

#### ✅ 1. Add to Cart from Globe
```
1. Navigate to Globe (homepage)
2. Hover over any track card
3. Click shopping cart icon
4. Verify cart badge increments
5. Click cart to view contents
6. Verify track appears with correct price
```

#### ✅ 2. Add to Cart from Search
```
1. Use search bar to find tracks
2. Hover over search result
3. Click cart icon
4. Verify item added with correct metadata
```

#### ✅ 3. Cart Persistence
```
1. Add items to cart
2. Refresh page
3. Verify cart still contains items
4. Close tab and reopen
5. Verify cart persists across sessions
```

#### ✅ 4. Wallet Connection
```
1. Click "Connect Wallet" in header
2. Choose wallet extension
3. Approve connection
4. Verify header shows connected address
```

#### ✅ 5. Purchase Flow - Success
```
1. Add items to cart
2. Connect wallet
3. Click "Purchase All"
4. Verify modal appears with pending state
5. Approve transaction in wallet
6. Verify modal shows success
7. Verify cart clears after 3 seconds
```

#### ✅ 6. Purchase Flow - Cancel
```
1. Add items to cart
2. Click "Purchase All"
3. Reject transaction in wallet
4. Verify modal dismisses
5. Verify cart remains intact
```

#### ✅ 7. Purchase Flow - Error
```
1. Add items to cart (disconnect wallet)
2. Click "Purchase All"
3. Verify error modal appears
4. Verify helpful error message
5. Click backdrop or button to dismiss
```

#### ⚠️ 8. Drag to Cart (Known Issue)
```
1. Navigate to Globe
2. Drag track to mixer
3. From mixer crate, add to cart
4. Verify price_stx preserved (may default to 2.5)
```

## Default Values

### Price Fallback
If a track lacks `price_stx` metadata, the cart defaults to **2.5 STX**:

```typescript
price_stx: track.price_stx?.toString() || '2.5'
```

### Recipient Address
Currently uses placeholder address. **TODO**: Implement dynamic artist wallet routing.

```typescript
const recipientAddress = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';
```

## Known Issues

### 1. ~~Inconsistent `price_stx` Handling~~ ✅ RESOLVED
**Status**: ✅ **FIXED - September 2025**

**Previous Problem**: 13 different card components with varying price metadata handling

**Resolution**:
- Card components have been successfully consolidated
- All entry points (Globe, Big Mixer, Search, Store) correctly pass `price_stx`
- Cart persistence works perfectly across all pages
- Drag operations preserve all metadata including price
- **Result**: Prices display accurately from any source ✅

**Achievement**: Unified card system eliminates previous inconsistencies

### 2. Single Recipient Address
**Status**: 🚧 Future work

**Current**: All payments go to one placeholder address
**Needed**: Route payments to individual artist wallets

**Implementation path**:
1. Add `artist_wallet_address` to track metadata
2. Batch payments or split if cart has multiple artists
3. Handle multi-recipient transactions

### 3. No Receipt/Download System
**Status**: 📋 Phase 2 planned

**Current**: Payment completes but no download access granted
**Needed**:
- Record purchases in Supabase
- Generate secure download links
- Track ownership for future access

**Estimated effort**: 4-6 hours

## Troubleshooting

### Payment Modal Not Appearing

**Symptoms**: Click "Purchase All" but nothing happens

**Causes**:
1. Dev server not running
2. Browser cache serving old code
3. JavaScript error preventing modal render

**Solutions**:
```bash
# Kill old processes
pkill -f "next dev"

# Clear Next.js cache
rm -rf .next

# Restart dev server
npm run dev

# Hard refresh browser
# Mac: Cmd+Shift+R
# Windows: Ctrl+Shift+R
```

### "Wallet Not Connected" Error

**Symptoms**: Error modal says "Please connect your wallet first"

**Causes**:
1. Wallet extension not connected
2. Auth context not initialized
3. Wallet disconnected mid-session

**Solutions**:
1. Click "Connect Wallet" in header
2. Approve connection in wallet extension
3. Refresh page if wallet shows connected but app doesn't recognize it

### Transaction Fails Silently

**Symptoms**: Click approve in wallet but nothing happens

**Causes**:
1. Insufficient STX balance
2. Network issues (mainnet vs testnet mismatch)
3. Wallet extension error

**Solutions**:
1. Check STX balance in wallet
2. Verify using correct network (testnet for development)
3. Check browser console for errors
4. Try disconnecting and reconnecting wallet

### ~~Cart Items Missing Prices~~ ✅ RESOLVED

**Previous Issue**: Cart showed "2.5 STX" for all items

**Resolution**:
- Card consolidation fixed all price passing issues
- All components now correctly include `price_stx` in props
- Data transformations preserve all metadata
- **Cart now displays accurate prices from all entry points** ✅

## Console Debugging

The implementation includes extensive console logging for debugging:

```javascript
// Cart operations
🛒 [CART LOAD] Component mounted, loading from localStorage...
🛒 [CART LOAD] Parsed cart items: [...]
🛒 Adding to cart: { id, title, price_stx }
🛒 [CART SAVE] Cart changed, current items: 2

// Purchase flow
🛒 Purchase All clicked! { isAuthenticated, walletAddress, cartLength }
✅ Starting purchase flow...
✅ Transaction submitted: {...}

// Errors
❌ Wallet not connected
💥 Purchase error: [error details]
```

Enable console logging in browser DevTools (F12 or Cmd+Option+J) to diagnose issues.

## Future Enhancements

### Phase 2: Backend Integration (6-8 hours)
- Record purchases in Supabase `purchases` table
- Link purchases to user accounts
- Track transaction IDs for verification
- Enable purchase history view

### Phase 3: Download System (4-6 hours)
- Generate secure, time-limited download URLs
- Verify ownership before granting access
- Support re-downloading purchased content
- Email receipts with download links

### Phase 4: Multi-Artist Payments (8-10 hours)
- Batch transactions for multiple artists
- Split payments based on cart composition
- Handle transaction failures gracefully
- Display per-artist payment breakdown

### Phase 5: Advanced Features (12-16 hours)
- Discount codes and promotions
- Bundle pricing (buy 3, get 1 free)
- Cart recommendations (frequently bought together)
- Wishlist functionality
- Gift purchases (send to another wallet)

## API Reference

### `purchaseAll()`
Initiates purchase flow for all items in cart.

**Parameters**: None (reads from cart state)

**Returns**: `Promise<void>`

**Side Effects**:
- Opens Stacks wallet prompt
- Updates `purchaseStatus` state
- Shows payment modal
- Clears cart on success

**Errors**:
- Throws if wallet not connected
- Throws if cart is empty
- Throws if transaction fails

### `addToCart(track)`
Adds a track to the shopping cart.

**Parameters**:
- `track` (object) - Track data with required fields:
  - `id` (string) - Unique track identifier
  - `title` (string) - Track name
  - `artist` (string) - Artist name
  - `price_stx` (string|number) - Price in STX (defaults to "2.5")
  - `license` (string) - License type (defaults to "Standard")

**Returns**: `void`

**Side Effects**:
- Updates cart state
- Saves to localStorage
- Triggers cart pulse animation
- Prevents duplicate additions

### `removeFromCart(trackId)`
Removes a track from the cart.

**Parameters**:
- `trackId` (string) - ID of track to remove

**Returns**: `void`

**Side Effects**:
- Updates cart state
- Saves to localStorage

### `clearCart()`
Empties the entire cart.

**Parameters**: None

**Returns**: `void`

**Side Effects**:
- Clears cart state
- Removes from localStorage
- Closes cart popover

## Security Considerations

### Client-Side Security
1. **No Private Keys**: Wallet extension handles keys, never exposed to app
2. **Transaction Signing**: User must approve every transaction in wallet
3. **Amount Verification**: User sees exact STX amount before approving

### Backend Requirements (Future)
1. **Purchase Verification**: Verify transaction on-chain before granting access
2. **Download URLs**: Generate signed, expiring URLs for purchased content
3. **Rate Limiting**: Prevent abuse of purchase/download endpoints
4. **Audit Logging**: Record all purchase attempts for fraud detection

### Best Practices
- Never store wallet private keys
- Always show transaction amount before requesting approval
- Validate recipient addresses before sending funds
- Implement transaction confirmation monitoring
- Handle failed transactions gracefully

## Deployment Notes

### Environment Variables
None required for basic payment flow (uses client-side wallet connection).

Future backend integration will need:
```env
STACKS_NETWORK=mainnet # or testnet
STACKS_API_URL=https://api.mainnet.hiro.so
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
```

### Build Process
No special build steps required. Standard Next.js build:
```bash
npm run build
npm start
```

### Production Checklist
- [ ] Update recipient address to production artist wallet
- [ ] Test with mainnet STX (small amounts first)
- [ ] Verify transaction fees are acceptable
- [ ] Implement backend purchase recording
- [ ] Set up download access system
- [ ] Enable transaction monitoring/alerts
- [ ] Add analytics tracking for purchases
- [ ] Test error handling with real users
- [ ] Document customer support procedures
- [ ] Create admin dashboard for transaction monitoring

## Support & Maintenance

### Monitoring
Monitor these metrics in production:
- Purchase success rate
- Transaction failure reasons
- Average transaction time
- Cart abandonment rate
- Wallet connection issues

### Common Support Issues
1. "I paid but didn't get my download" → Check transaction ID, verify on-chain
2. "Transaction failed" → Check wallet balance, network status
3. "Can't connect wallet" → Verify extension installed, permissions granted
4. "Wrong price charged" → Investigate cart data at purchase time

### Debug Checklist
1. Check browser console for errors
2. Verify wallet connection status
3. Inspect cart contents and prices
4. Check transaction on Stacks explorer
5. Review server logs (when backend integrated)
6. Test in incognito mode
7. Try different wallet extensions

## Resources

- **Stacks Docs**: https://docs.stacks.co
- **@stacks/connect Docs**: https://github.com/hirosystems/connect
- **Stacks Explorer (Mainnet)**: https://explorer.stacks.co
- **Stacks Explorer (Testnet)**: https://explorer.stacks.co/?chain=testnet
- **STX Faucet (Testnet)**: https://explorer.stacks.co/sandbox/faucet

## Contributors

Implemented by: Claude (Anthropic AI Assistant)
Tested by: Sandy Hoover
Integration Date: September 27, 2025

---

**Last Updated**: October 5, 2025
**Document Version**: 1.3
**Status**: 🚧 Payments Disabled (Cart functional, payments require smart contracts)

## Recent Updates

### October 5, 2025 - Cart Moved to Header + Payments Disabled 🛒

**Major Architectural Change**: Shopping cart extracted from Crate component to global Header position.

**Motivation**:
1. Better UX - cart always visible and accessible
2. Cleaner separation of concerns (DJ crate vs shopping cart)
3. Global state management via CartContext

**Changes Made**:

1. **Created CartContext** (`contexts/CartContext.tsx`)
   - Global cart state with `useCart()` hook
   - LocalStorage persistence
   - Cart functions: `addToCart`, `removeFromCart`, `clearCart`, `purchaseAll`
   - Stores `primary_uploader_wallet` for future payment splitting

2. **Updated Header** (`components/layout/Header.tsx`)
   - Added cart icon with item count badge (top-right corner)
   - Cart dropdown showing items, prices, total
   - "Payments Coming Soon" button (disabled)
   - Replaced "Purchase All" functionality

3. **Cleaned Crate** (`components/shared/Crate.tsx`)
   - Removed ~200 lines of cart code
   - Now uses global `window.addToCart` for cart button handlers
   - Focused purely on DJ workflow (track staging)

4. **Payment Splitting Discovery** 🚨
   - **Critical Issue Found**: Current implementation only pays first artist
   - **User Quote**: "I'm so glad we stumbled across this. That could have been a bit disastrous!"
   - **Action Taken**: Disabled purchase button immediately
   - **Solution**: Requires Clarity smart contracts for multi-artist revenue splitting

**Button State**:
```typescript
<button
  disabled={true}
  className="... cursor-not-allowed opacity-60"
  title="Payment splitting smart contracts coming soon"
>
  Payments Coming Soon
</button>
```

**Why Disabled**:
- Cart can contain tracks from multiple artists
- Current code: `cart[0]?.primary_uploader_wallet` only sends to first artist
- Need smart contracts to split payments fairly among all artists
- Better to disable than risk unfair payments

**Future Work**:
- Build Clarity smart contract for payment splitting
- Group cart items by artist wallet
- Execute atomic multi-recipient transaction
- Honor collaborator revenue splits (already stored in database)

**Files Modified**:
- `contexts/CartContext.tsx` (NEW)
- `components/layout/Header.tsx` (cart UI added)
- `components/shared/Crate.tsx` (cart removed)
- `app/providers.tsx` (CartProvider added)
- `app/welcome/page.tsx` ("Payments" moved to Coming Soon section)

---

### October 3, 2025 - Purchase Flow Debugging & Fix ✅

**Problem**: After merging `feature/store-edit-mode` branch, wallet purchase popup stopped appearing in production deployment, despite wallet connection working correctly.

**Symptoms**:
- Wallet authentication successful ✅
- Cart functioning properly ✅
- Purchase button showing "Processing..." spinner ✅
- **Wallet popup never appearing** ❌
- No transaction initiated ❌

**Debugging Process**:

1. **Initial Investigation**: Added debug logging to trace values:
   ```typescript
   console.log('🔍 Purchase Debug:', {
     cartTotal,
     amountInMicroSTX,
     amountString: amountInMicroSTX.toString(),
     recipient: recipientAddress,
     cart: cart.map(i => ({ id: i.id, price_stx: i.price_stx, title: i.title }))
   });
   ```

2. **Failed Attempts**:
   - **BigInt precision fix**: Tried `BigInt(Math.floor(cartTotal * 1000000))` - made it worse
   - **Dynamic import**: Tried `const connectModule = await import('@stacks/connect')` - didn't help
   - **Added appDetails**: Tried passing app identification object - still broken

3. **Breakthrough**: User suggested checking backup branch `backup/main-with-stx-payment-20250927`
   - Compared working implementation with current broken code
   - Discovered three critical differences:
     - ✅ Working version used **static import**
     - ✅ Working version had **NO BigInt wrapper**
     - ✅ Working version had **NO appDetails parameter**

**Solution**:

Reverted to simple, clean pattern from working backup:

```typescript
// Static import at top of file
import { openSTXTransfer } from '@stacks/connect';

// Simple implementation in function
const amountInMicroSTX = Math.floor(cartTotal * 1000000);

await openSTXTransfer({
  recipient: recipientAddress,
  amount: amountInMicroSTX.toString(),
  memo: `Purchase: ${cart.map(item => item.title).join(', ').slice(0, 32)}`,
  onFinish: (data) => {
    console.log('✅ Transaction submitted:', data);
    setPurchaseStatus('success');
    setTimeout(() => {
      clearCart();
      setShowPurchaseModal(false);
      setPurchaseStatus('idle');
    }, 3000);
  },
  onCancel: () => {
    console.log('❌ Transaction cancelled');
    setPurchaseStatus('idle');
    setShowPurchaseModal(false);
  }
});
```

**Additional Improvement**: Added button disabled state to prevent double-click race conditions:

```typescript
<button
  onClick={purchaseAll}
  disabled={purchaseStatus === 'pending'}
  className="... disabled:opacity-50 disabled:cursor-not-allowed"
>
  {purchaseStatus === 'pending' ? 'Processing...' : 'Purchase All →'}
</button>
```

**Results**:
- ✅ Wallet popup appears correctly
- ✅ All amounts work (0.5 STX, 2.5 STX, any amount)
- ✅ No double-click transaction issues
- ✅ Smooth purchase flow end-to-end

**Key Lessons Learned**:
1. **Simpler is better**: Removed complexity rather than adding it
2. **Check working backups early**: Saved hours of debugging
3. **Static imports for @stacks/connect**: Dynamic imports break wallet popup
4. **Minimal parameters**: Only pass what's required by the API
5. **Button state management**: Critical for preventing race conditions

**Implementation Files**:
- `/components/shared/Crate.tsx` (lines 14, 360-383, 1077-1083)

---

### September 27, 2025 - Card Consolidation Success ✅
- **Card System**: Successfully consolidated all card components
- **Price Handling**: All entry points correctly pass `price_stx` to cart
- **Cross-Page Persistence**: Cart state syncs perfectly between Globe and Big Mixer
- **Testing Result**: "Everything is working beautifully" - All prices correct from any source
- **Achievement**: Unified card architecture eliminates previous metadata loss issues