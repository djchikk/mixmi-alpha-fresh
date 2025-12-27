# SUI Blockchain & Accounting System

Technical documentation for the mixmi SUI transition and USDC-based accounting system.
**Created:** December 26, 2025

---

## Overview

mixmi is transitioning from Stacks (STX) to SUI blockchain for payments. This document covers:
- New database schema for multi-persona accounting
- USDC pricing model
- zkLogin authentication flow
- Migration from STX to SUI

---

## Database Schema

### accounts
Parent account that links multiple authentication methods and personas.

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### personas
Each account can have up to 5 personas (artist identities). Each persona has its own:
- Username and display name
- Avatar
- USDC balance
- Payout address

```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  balance_usdc DECIMAL(12,2) DEFAULT 0,
  payout_address TEXT,  -- SUI address for withdrawals
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger enforces max 5 personas per account
```

### tbd_wallets
"To Be Determined" wallets hold earnings for collaborators who don't have mixmi accounts yet.

```sql
CREATE TABLE tbd_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_account_id UUID NOT NULL REFERENCES accounts(id),
  label TEXT NOT NULL,  -- e.g., "Kwame - Lagos Session"
  contact_email TEXT,
  balance_usdc DECIMAL(12,2) DEFAULT 0,
  claim_code TEXT UNIQUE DEFAULT gen_random_uuid(),
  claimed_by_account_id UUID REFERENCES accounts(id),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Max 5 TBD wallets per account
-- Owner cannot claim their own TBD wallet
```

### earnings
Transaction log for all earnings across personas.

```sql
CREATE TABLE earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES personas(id),
  tbd_wallet_id UUID REFERENCES tbd_wallets(id),
  amount_usdc DECIMAL(12,4) NOT NULL,
  source_type TEXT NOT NULL,  -- 'direct_sale', 'remix_royalty', 'streaming', 'contact_fee'
  source_id UUID,  -- Reference to the source (track_id, etc.)
  generation INTEGER DEFAULT 0,  -- 0=direct, 1=Gen1, 2=Gen2
  payer_persona_id UUID REFERENCES personas(id),
  tx_hash TEXT,  -- Blockchain transaction hash
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT earnings_destination CHECK (
    (persona_id IS NOT NULL AND tbd_wallet_id IS NULL) OR
    (persona_id IS NULL AND tbd_wallet_id IS NOT NULL)
  )
);
```

### zklogin_users
Links SUI addresses (from zkLogin) to invite codes and accounts.

```sql
CREATE TABLE zklogin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sui_address TEXT UNIQUE NOT NULL,
  email TEXT,
  invite_code TEXT REFERENCES alpha_users(invite_code),
  account_id UUID REFERENCES accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## USDC Pricing Columns (ip_tracks)

New columns added to `ip_tracks` table:

```sql
-- USDC pricing (primary going forward)
remix_price_usdc DECIMAL(10,4),     -- Cost to use in mixer
download_price_usdc DECIMAL(10,2),  -- Offline download price
contact_fee_usdc DECIMAL(10,2),     -- Collab/licensing inquiry fee

-- Legacy STX columns preserved for backwards compatibility
-- (contain same values as USDC during transition)
```

---

## Pricing Configuration

All prices defined in `config/pricing.ts`:

```typescript
export const PRICING = {
  mixer: {
    loopRecording: 0.10,    // $0.10 USDC per 8-bar loop
    songSection: 0.10,      // $0.10 USDC per 8-bar section
    videoClip: 0.10,        // $0.10 USDC per 5-second clip
  },
  download: {
    loop: 2.00,             // $2.00 USDC default
    song: 1.00,             // $1.00 USDC default
    videoClip: 2.00,        // $2.00 USDC default
  },
  contact: {
    inquiryFee: 1.00,       // $1.00 USDC (100% to creator)
    creatorCutPercent: 100,
  },
  platform: {
    platformCutPercent: 10, // 10% of recording fees
    creatorCutPercent: 90,  // 90% to creator
    activeSplitGenerations: 3,
    seedRoyaltyPercent: 1,  // Original seed always gets 1%
  },
  account: {
    maxPersonas: 5,
    maxTbdWallets: 5,
  },
} as const;
```

---

## Authentication Flow

### 1. Stacks Wallet (Legacy)
```
User connects Stacks wallet
  → walletAddress set (SP...)
  → suiAddress = null
  → authType = 'wallet'
```

### 2. Invite Code Only
```
User enters invite code
  → Look up alpha_users table
  → walletAddress = alpha_users.wallet_address
  → suiAddress = null
  → authType = 'invite'
```

### 3. zkLogin (Google OAuth + Invite)
```
User clicks "Sign in with Google"
  → Google OAuth flow
  → SUI address derived from Google identity
  → Look up/create zklogin_users record
  → Link to alpha_users via invite_code
  → walletAddress = linked STX wallet (if any)
  → suiAddress = derived SUI address
  → authType = 'zklogin'
```

---

## Account Linkage

The system links different auth methods to a single account:

```
alpha_users.invite_code
    ↓
zklogin_users.invite_code → zklogin_users.sui_address
    ↓
alpha_users.wallet_address → user_profiles.wallet_address
    ↓
user_profiles.account_id → accounts.id
    ↓
personas (1-5 per account)
```

---

## Migration Files

Located in `supabase/migrations/`:

| File | Purpose |
|------|---------|
| `20251226000000_add_persona_accounting.sql` | Core tables: accounts, personas, tbd_wallets, earnings |
| `20251226000001_backup_ip_tracks.sql` | Backup ip_tracks before modifications |
| `20251226000002_add_usdc_pricing.sql` | Add USDC columns to ip_tracks |
| `20251226000003_link_existing_users.sql` | Create accounts for existing user_profiles |

---

## UI Components Updated

### Dashboard Settings Tab (`app/account/page.tsx`)
- **Your Accounts** section - List personas with balances, Switch/Edit buttons
- **Connected Wallets** - Shows SUI and STX addresses
- Supports video avatars

### Header Dropdown (`components/layout/Header.tsx`)
- Persona/Account switcher
- Shows `displayAddress` (prefers SUI)
- "Add Account" button (max 5)

### Pricing Displays (Updated STX → USDC)
- `IPTrackModal.tsx` - Upload form pricing
- `SimplifiedLicensingStep.tsx` - Licensing step
- `TrackDetailsModal.tsx` - Track info display
- `PaymentModal.tsx` - Mixer payment flow
- `CartWidget.tsx` - Shopping cart
- `CertificateViewer.tsx` - Upload certificates
- Card components - Price badges

---

## Session Work Summary (December 26, 2025)

### Commits on `feature/persona-usdc-system` → merged to `main`:

1. `8d06a10` - Add persona accounting system with USDC pricing
2. `1fbaf7a` - Update all pricing displays from STX to USDC
3. `e507ccb` - Fix SimplifiedLicensingStep STX → USDC pricing
4. `39eda69` - Update submission code to write USDC pricing columns
5. `1d7dfcd` - Align chatbot field names with code expectations
6. `981caf3` - UI updates for SUI transition (cart, header, IP splits)
7. `a1df35c` - Dashboard Settings tab - Personas section
8. `761087c` - Persona avatar fallback chain
9. `747c209` - Avatar loading for zkLogin users + rename Personas to Accounts
10. `05a45bd` - Support video avatars in Accounts section

### Key Changes:
- All UI now shows USDC instead of STX
- Centralized pricing in `config/pricing.ts`
- New "Your Accounts" section in Dashboard Settings
- Header shows SUI address for zkLogin users
- IP splits form shows "You" instead of wallet address
- Form submissions write to both USDC and STX columns (backwards compat)
- Max personas increased from 3 to 5

---

## TODO / Future Work

- [ ] Wire up "Add Account" modal to create new personas
- [ ] Wire up "Edit" button for persona editing
- [ ] Build TBD Wallet management UI
- [ ] Build Earnings tab with transaction history
- [ ] Implement actual SUI payment transactions
- [ ] Withdrawal flow from persona balances
