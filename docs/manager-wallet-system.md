# Manager Wallet System

## Overview

The Manager Wallet System allows a single zkLogin account holder to act as a **custodian** for multiple independent SUI wallets. Each persona under an account gets its own real, on-chain SUI address with separate funds.

This enables:
- **Artists** managing band members or collaborators
- **Labels** managing their roster of artists
- **Family members** providing technical/financial support to relatives
- **Community leaders** managing accounts for people in areas with limited tech access

## Architecture

```
Account (zkLogin = "Manager")
│
├── Manager's zkLogin SUI address
│   └── Used for: authentication, signing purchases, gas sponsorship
│
├── Persona "Artist A"
│   ├── Generated SUI address: 0xabc...
│   ├── Encrypted private key (only manager can decrypt)
│   └── Balance: $45.00 USDC
│
├── Persona "Artist B"
│   ├── Generated SUI address: 0xdef...
│   ├── Encrypted private key (only manager can decrypt)
│   └── Balance: $120.50 USDC
│
└── TBD Wallet "Kwame" (unclaimed collaborator)
    ├── Generated SUI address: 0x123...
    ├── Encrypted private key (manager controls until claimed)
    └── Balance: $30.00 USDC (held royalties)
```

## Key Concepts

### 1. Separate On-Chain Accounting
Each persona has a **real SUI address** with actual USDC on-chain. This isn't database-tracked virtual balances - it's verifiable blockchain state. Anyone can look up `0xabc...` on SuiScan and see the exact balance.

### 2. Manager as Custodian
The zkLogin account holder is the custodian of all persona wallets under their account. They can:
- View balances for all personas
- Initiate withdrawals from any persona
- Transfer between personas
- Cash out to external addresses (bank, M-Pesa, exchange, etc.)

The **platform never has access** to unencrypted private keys.

### 3. Encrypted Key Storage
Private keys for persona wallets are encrypted using a key derived from the manager's zkLogin credentials. Only the authenticated manager can decrypt and use them.

### 4. TBD Wallets for Unnamed Collaborators
When a track has collaborators without accounts (entered as just names like "Kwame"), we:
1. Generate a wallet for them
2. Manager controls it until they claim
3. When claimed, funds transfer to their new account

## Database Schema

### personas table (updated)
```sql
-- Existing columns...
sui_address TEXT,                    -- Generated SUI address for this persona
sui_keypair_encrypted TEXT,          -- Encrypted private key (only manager can decrypt)
sui_keypair_nonce TEXT,              -- Encryption nonce
payout_address TEXT,                 -- Optional: external address for auto-payouts
```

### tbd_wallets table (updated)
```sql
-- Existing columns...
sui_address TEXT,                    -- Generated SUI address
sui_keypair_encrypted TEXT,          -- Encrypted private key
sui_keypair_nonce TEXT,              -- Encryption nonce
```

## Encryption Flow

### Key Derivation
```
User's zkLogin salt (unique, deterministic)
         ↓
    + Server secret
         ↓
    HKDF derivation
         ↓
    Encryption key (AES-256-GCM)
```

The encryption key is derived from:
1. User's zkLogin `salt` (known only to that user's OAuth identity)
2. Server-side secret (prevents database-only attacks)

This ensures:
- Only the authenticated user can decrypt
- Platform can't decrypt without user authentication
- Database breach doesn't expose keys

### Encryption Process
```typescript
// When creating a persona:
1. Generate Ed25519 keypair
2. Derive encryption key from user's salt + server secret
3. Encrypt private key with AES-256-GCM
4. Store encrypted key + nonce in database
5. Derive SUI address from public key
```

### Decryption Process
```typescript
// When user wants to withdraw:
1. User authenticates via zkLogin
2. Get user's salt from session
3. Derive encryption key from salt + server secret
4. Decrypt persona's private key
5. Sign withdrawal transaction
6. Execute on-chain
```

## User Flows

### Creating a Persona
1. User clicks "Add Account" in Settings
2. Backend generates Ed25519 keypair
3. Private key encrypted with user's derived key
4. Persona created with its own SUI address
5. UI shows new persona with `$0.00` balance

### Receiving Payment
1. Buyer purchases track from "Artist A" persona
2. Payment routes to Artist A's SUI address (`0xabc...`)
3. On-chain USDC balance increases
4. Dashboard shows updated balance

### Withdrawing Funds
1. Manager goes to Earnings tab
2. Selects persona "Artist A"
3. Clicks "Withdraw"
4. Enters destination address and amount
5. Backend decrypts Artist A's private key
6. Signs and executes USDC transfer
7. Funds arrive at destination

### Collaborator Claiming TBD Wallet
1. "Kwame" creates a mixmi account
2. Enters claim code or is invited by manager
3. Manager approves the claim
4. Funds transfer from TBD wallet to Kwame's new persona
5. TBD wallet marked as claimed

## Security Considerations

### What the Platform Can Do
- Store encrypted keys
- Facilitate transactions when user is authenticated
- Cannot decrypt keys without user's active session

### What the Manager Can Do
- Access all personas under their account
- Withdraw from any persona they manage
- Cannot access other accounts' personas

### What Happens if Manager Loses Access
- If manager loses OAuth access (Google/Apple account), they lose access to personas
- Recovery would require OAuth account recovery
- Consider adding backup recovery options in future

### Database Breach Scenario
- Attacker gets encrypted keys
- Without server secret AND user's salt, keys are useless
- Server secret should be in secure env vars / KMS

## Implementation Files

```
lib/sui/
├── keypair-manager.ts      # Keypair generation, encryption, decryption
├── client.ts               # SUI client utilities
├── payment-splitter.ts     # Payment routing
└── index.ts                # Exports

app/api/
├── personas/
│   ├── create/route.ts     # Creates persona with wallet
│   └── withdraw/route.ts   # Handles withdrawals
└── sui/
    ├── sponsor/route.ts    # Gas sponsorship
    └── execute/route.ts    # Transaction execution

components/account/
├── EarningsTab.tsx         # Shows balances, withdrawal UI
└── PersonaWalletCard.tsx   # Individual persona wallet display
```

## Example: Kenya Use Case

**Scenario:** John in Nairobi manages accounts for his cousin Mary (musician in rural area) and his friend Peter (producer).

1. John signs in with his Google account (zkLogin)
2. Creates personas: "Mary Music" and "Peter Beats"
3. Each persona gets its own SUI wallet
4. Mary's fans buy her tracks → funds go to Mary's wallet
5. Peter's beats get licensed → funds go to Peter's wallet
6. John can see both balances in his dashboard
7. Monthly, John withdraws from each and sends via M-Pesa to Mary and Peter

**Benefits:**
- Real accounting: John can show Mary exactly what she earned
- Separation: Mary's money never mixes with Peter's
- Flexibility: John handles the technical side
- Trust: Balances are verifiable on-chain

## Future Enhancements

1. **Multi-sig for large withdrawals** - Require manager + persona holder approval
2. **Auto-payout schedules** - Monthly automatic withdrawals to set addresses
3. **Persona handoff** - Transfer full control of a persona to another account
4. **Recovery keys** - Backup decryption method
5. **Sub-managers** - Allow manager to delegate specific personas

---

*Last updated: December 29, 2025*
