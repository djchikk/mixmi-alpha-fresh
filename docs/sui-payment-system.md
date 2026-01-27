# SUI Payment System Documentation

Technical documentation for mixmi's SUI blockchain payment system using zkLogin authentication and sponsored transactions.

---

## Overview

mixmi uses SUI blockchain for USDC payments with the following key features:
- **zkLogin**: Users authenticate with Google/Apple OAuth - no wallet extensions needed
- **Sponsored Transactions**: Platform pays gas fees so users only need USDC
- **Payment Splitting**: Automatic revenue distribution to creators and platform

---

## Architecture

```
User (Google OAuth)
       ↓
   zkLogin Auth
       ↓
  SUI Address derived from JWT + salt
       ↓
  User signs transaction with ephemeral keypair + ZK proof
       ↓
  Platform sponsors gas (adds SUI for fees)
       ↓
  Dual-signed transaction executed on SUI
       ↓
  USDC transferred to recipients
```

---

## Authentication Flow (zkLogin)

### 1. User Initiates Sign-In
- User clicks "Sign in with Google"
- App generates ephemeral Ed25519 keypair (temporary, session-only)
- App generates nonce binding keypair to OAuth flow

### 2. OAuth Redirect
- User redirects to Google OAuth
- Nonce embedded in OAuth request
- User authenticates with Google

### 3. Callback Processing
- JWT returned in URL fragment
- App extracts JWT and validates nonce
- App requests salt from our API (creates/retrieves from `zklogin_users` table)

### 4. ZK Proof Generation
- App calls `/api/zklogin/prove` (proxies to Shinami)
- Shinami generates zero-knowledge proof
- Proof verifies: "This JWT belongs to this user without revealing the JWT"

### 5. Address Derivation
- SUI address derived from: `jwtToAddress(jwt, salt)`
- Same JWT + salt always produces same address
- Address stored in session for transactions

### Key Files
- `lib/zklogin/index.ts` - Core zkLogin utilities
- `lib/zklogin/session.ts` - Session storage
- `app/auth/callback/page.tsx` - OAuth callback handler
- `app/api/zklogin/prove/route.ts` - Shinami prover proxy
- `app/api/auth/zklogin/salt/route.ts` - Salt management

---

## Prover Service (Shinami)

We use [Shinami](https://shinami.com) as our ZK prover service because:
- Accepts any OAuth client ID (no whitelist like Mysten's prover)
- Free tier available for testing
- Supports Testnet and Mainnet

### Configuration
- **API Key**: `SHINAMI_WALLET_SERVICES_KEY` environment variable
- **Endpoint**: `https://api.us1.shinami.com/sui/zkprover/v1`
- **Format**: JSON-RPC with method `shinami_zkp_createZkLoginProof`

### Important Notes
- `maxEpoch` must be passed as a **string**, not number
- Response is wrapped in `zkProof` object - must unwrap before use
- Rate limit: 2 proofs per address per minute

---

## Transaction Flow (Purchases)

### 1. User Adds to Cart
- Cart stored in localStorage via `CartContext`
- Each item has price in USDC

### 2. Checkout Initiated
- `handleSuiPurchase()` in CartContext
- Validates zkLogin session is still valid (epoch check)

### 3. Recipient Resolution
- For each track, resolve payment recipients
- Platform fee (currently 0%) + creator payment
- Recipients need valid SUI addresses

### 4. Transaction Building
- Build USDC transfer transaction using `@mysten/sui`
- Transaction includes all payment splits

### 5. Sponsorship Request
- Send transaction to `/api/sui/sponsor`
- Platform wallet adds gas payment (SUI tokens)
- Platform signs as gas sponsor

### 6. User Signing (zkLogin)
- User signs with ephemeral keypair
- ZK proof attached to signature
- Creates zkLogin signature using `getZkLoginSignature()`

### 7. Execution
- Dual-signed transaction sent to `/api/sui/execute`
- SUI network verifies both signatures
- USDC transferred on success

### Key Files
- `contexts/CartContext.tsx` - Purchase flow orchestration
- `lib/sui/transactions.ts` - Transaction building
- `lib/sui/gas-sponsor.ts` - Sponsorship logic
- `app/api/sui/sponsor/route.ts` - Sponsorship endpoint
- `app/api/sui/execute/route.ts` - Execution endpoint

---

## Environment Variables

### Required for SUI Payments
```
NEXT_PUBLIC_SUI_NETWORK=testnet          # or mainnet
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx         # Google OAuth client ID
SHINAMI_WALLET_SERVICES_KEY=xxx          # Shinami API key
SUI_SPONSOR_PRIVATE_KEY=xxx              # Platform wallet private key (hex)
```

### Network Configuration
| Network | Use Case | Prover | USDC |
|---------|----------|--------|------|
| testnet | Testing | Shinami | Test USDC |
| mainnet | Production | Shinami | Real USDC |
| devnet | Not supported | N/A | N/A |

---

## Database Tables

### zklogin_users
Stores salt and SUI address for each OAuth user.
```sql
google_sub TEXT PRIMARY KEY,    -- OAuth subject ID
salt TEXT NOT NULL,             -- zkLogin salt (BigInt string)
sui_address TEXT NOT NULL,      -- Derived SUI address
email TEXT,
invite_code TEXT,
created_at TIMESTAMPTZ
```

### purchases
Records completed purchases.
```sql
buyer_address TEXT,             -- SUI address of buyer
track_id UUID,
price_usdc DECIMAL,
tx_hash TEXT,                   -- SUI transaction digest
network TEXT,                   -- 'sui'
status TEXT,                    -- 'completed'
completed_at TIMESTAMPTZ
```

---

## Error Handling

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "Groth16 proof verify failed" | Wrong prover for network | Use Shinami (not Mysten prover) |
| "audience not supported" | OAuth client ID not whitelisted | Use Shinami instead of Mysten |
| "Invalid params" (Shinami) | maxEpoch as number | Pass maxEpoch as string |
| "missing proofPoints" | Nested zkProof response | Unwrap `result.zkProof` |
| "Session expired" | maxEpoch exceeded | Re-authenticate user |

### Session Expiry
- Sessions valid for ~2 epochs (~48 hours on testnet)
- Check `currentEpoch < session.maxEpoch` before transactions
- Prompt re-authentication if expired

---

## Testing

### Testnet Setup
1. Get testnet SUI from faucet for sponsor wallet
2. Get testnet USDC (mint or request)
3. Set `NEXT_PUBLIC_SUI_NETWORK=testnet`
4. Create Shinami API key for Testnet

### Test Flow
1. Sign in with Google (creates zkLogin session)
2. Add item to cart
3. Click purchase
4. Verify transaction on [Suiscan](https://suiscan.xyz/testnet)

---

## Security Considerations

- **Ephemeral keypairs**: Never stored long-term, regenerated each session
- **Salt storage**: Server-side only, links OAuth identity to SUI address
- **Sponsor key**: Server-side only, never exposed to client
- **Shinami API key**: Server-side only, proxied through our API

---

## Future Improvements

- [ ] Apple OAuth support (configured but not fully tested)
- [ ] Session refresh without full re-authentication
- [ ] Mainnet deployment with production USDC
- [ ] Multi-signature support for high-value transactions

---

*Last updated: January 2026*
