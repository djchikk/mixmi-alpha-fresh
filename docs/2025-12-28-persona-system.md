# Persona System Implementation - December 28, 2025

Complete technical reference for the persona system built during the December 2025 transition from Stacks wallets to SUI zkLogin authentication.

---

## Overview

The persona system allows users to have multiple identities under a single account. This supports:
- Artists with multiple projects/aliases
- Radio station operators
- Users who want separate public/private identities

Each persona has its own:
- Username (unique, URL-safe)
- Display name
- Avatar (image or video)
- Bio
- Linked STX wallet address
- USDC earnings balance

---

## Database Schema

### accounts table
Parent container that groups authentication methods and personas.

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sui_address TEXT UNIQUE,           -- zkLogin SUI address (primary)
  stx_address TEXT UNIQUE,           -- Legacy Stacks wallet (optional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### personas table
Individual identities belonging to an account.

```sql
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,     -- URL-safe, lowercase
  display_name TEXT,                 -- Human-readable
  avatar_url TEXT,                   -- Supports video (.mp4, .webm)
  bio TEXT,
  wallet_address TEXT,               -- STX wallet linked to this persona
  is_active BOOLEAN DEFAULT true,    -- Soft delete flag
  usdc_balance DECIMAL(20,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Relationships
- One account can have up to 5 personas (enforced by trigger, can be disabled)
- Each persona can have one linked STX wallet
- Tracks reference personas via `ip_tracks.persona_id`

---

## Admin Page (`/admin/users`)

Access-code protected interface for managing the transition.

### Form 1: Search User
Find existing users by wallet address, username, or invite code.

```typescript
// Searches across multiple tables
const { data: profile } = await supabase
  .from('user_profiles')
  .select('*')
  .or(`wallet_address.eq.${query},username.ilike.${query}`)
  .maybeSingle();

const { data: alphaUser } = await supabase
  .from('alpha_users')
  .select('*')
  .eq('invite_code', query)
  .maybeSingle();
```

### Form 2: Create Account
Creates a new account from a SUI address (from zkLogin).

**API Route:** `POST /api/admin/create-account`

```typescript
// Request body
{ sui_address: string }

// Creates account record
const { data: account } = await supabase
  .from('accounts')
  .insert({ sui_address })
  .select()
  .single();
```

### Form 3: Add Persona to Account
Creates a persona under an existing account.

**API Route:** `POST /api/admin/add-persona-to-account`

```typescript
// Request body
{
  account_id: string,      // UUID of parent account
  username: string,        // Must be unique
  display_name?: string,
  avatar_url?: string,
  bio?: string,
  wallet_address?: string  // STX wallet to link
}

// Also updates user_profiles.username if wallet is linked
if (wallet_address) {
  await supabase
    .from('user_profiles')
    .update({ username })
    .eq('wallet_address', wallet_address);
}
```

### Form 4: Link STX Wallet to Account
Links a Stacks wallet address to an existing account.

**API Route:** `POST /api/admin/link-stx-wallet`

```typescript
// Request body
{ account_id: string, stx_address: string }

// Updates account record
await supabase
  .from('accounts')
  .update({ stx_address })
  .eq('id', account_id);
```

**UI Enhancement:** Shows SUI address in account dropdown so admin knows which zkLogin account they're linking to.

### Form 5: Delete Persona
Removes a persona, handling foreign key constraints.

**API Route:** `POST /api/admin/delete-persona`

```typescript
// Request body
{ persona_id: string }

// Step 1: Unlink tracks (required due to FK constraint)
await supabase
  .from('ip_tracks')
  .update({ persona_id: null })
  .eq('persona_id', persona_id);

// Step 2: Delete the persona
await supabase
  .from('personas')
  .delete()
  .eq('id', persona_id);

// Step 3: If this was the only persona, delete the account too
const { data: remainingPersonas } = await supabase
  .from('personas')
  .select('id')
  .eq('account_id', account_id);

if (remainingPersonas?.length === 0) {
  await supabase
    .from('accounts')
    .delete()
    .eq('id', account_id);
}
```

### Form 6: Edit Persona
Changes username and/or display name of existing persona.

**API Route:** `POST /api/admin/edit-persona`

```typescript
// Request body
{
  persona_id: string,
  new_username?: string,
  new_display_name?: string
}

// Checks username availability first
const { data: existing } = await supabase
  .from('personas')
  .select('id')
  .eq('username', new_username)
  .neq('id', persona_id)
  .maybeSingle();

if (existing) {
  return { error: 'Username already taken' };
}

// Updates persona
await supabase
  .from('personas')
  .update({ username: new_username, display_name: new_display_name })
  .eq('id', persona_id);

// Also updates user_profiles if wallet is linked
if (persona.wallet_address) {
  await supabase
    .from('user_profiles')
    .update({ username: new_username })
    .eq('wallet_address', persona.wallet_address);
}
```

---

## Username Lookup Pattern

All components that display profile/store links must check personas first, then fall back to user_profiles. This ensures backward compatibility during the transition.

### The Pattern

```typescript
// Fetch username for a wallet address
// Priority: personas.username → user_profiles.username

useEffect(() => {
  const fetchUsername = async () => {
    if (!walletAddress) {
      setUsername(null);
      return;
    }

    // First check if there's an active persona with this wallet
    const { data: personaData } = await supabase
      .from('personas')
      .select('username, display_name')
      .eq('wallet_address', walletAddress)
      .eq('is_active', true)
      .maybeSingle();

    if (personaData?.username) {
      setUsername(personaData.username);
      setDisplayName(personaData.display_name || null);
      return;
    }

    // Fall back to user_profiles (legacy)
    const { data } = await supabase
      .from('user_profiles')
      .select('username, display_name')
      .eq('wallet_address', walletAddress)
      .single();

    setUsername(data?.username || null);
    setDisplayName(data?.display_name || null);
  };

  fetchUsername();
}, [walletAddress]);
```

### Components Updated

| Component | File | What it does |
|-----------|------|--------------|
| CompactTrackCardWithFlip | `components/cards/CompactTrackCardWithFlip.tsx` | Track cards on globe, links to profile/store |
| TrackDetailsModal | `components/modals/TrackDetailsModal.tsx` | Track detail popup, shows uploader info |
| SimplifiedMixer | `components/mixer/SimplifiedMixer.tsx` | Mixer deck info for Deck A and Deck B |
| SimplifiedDeck | `components/mixer/SimplifiedDeck.tsx` | Standalone deck component |

---

## Header Persona Switcher

The header dropdown shows all personas for zkLogin users and allows switching between them.

### Location
`components/layout/Header.tsx`

### Features
- Shows current persona's avatar, username, display name
- Dropdown lists all personas for the account
- Supports video avatars (auto-plays muted)
- Scrollable list for accounts with many personas
- Click to switch active persona

### Video Avatar Detection

```typescript
{persona.avatar_url && (
  persona.avatar_url.includes('.mp4') ||
  persona.avatar_url.includes('.webm') ||
  persona.avatar_url.includes('video/')
) ? (
  <video
    src={persona.avatar_url}
    className="w-full h-full object-cover"
    autoPlay
    loop
    muted
    playsInline
  />
) : (
  <img
    src={persona.avatar_url || generateAvatar(persona.username)}
    className="w-full h-full object-cover"
    alt={persona.username}
  />
)}
```

### Scrollable Container

```typescript
<div className="max-h-64 overflow-y-auto">
  {personas.map(persona => (
    // persona items
  ))}
</div>
```

---

## Profile/Store URL Resolution

URLs can use either persona username or wallet address.

### URL Formats
- `/profile/tokyo-denpa` - Persona username (preferred)
- `/profile/SP2X5M...` - Stacks wallet address (legacy)
- `/store/tokyo-denpa` - Store by persona username
- `/store/SP2X5M...` - Store by wallet address

### Detection Logic

```typescript
// In profile page
const identifier = params.walletAddress; // Could be username OR wallet

// Check if it's a username (doesn't start with SP or ST)
const isUsername = !identifier.startsWith('SP') && !identifier.startsWith('ST');

// Pass correct value to child components
<ProfileInfo
  username={isUsername ? identifier : profileData?.profile?.username}
  walletAddress={profileData?.walletAddress}
/>
```

### Store/Profile Button Links

```typescript
// Use username if available, fall back to wallet
const profileUrl = username
  ? `/profile/${username}`
  : `/profile/${walletAddress}`;

const storeUrl = username
  ? `/store/${username}`
  : `/store/${walletAddress}`;
```

---

## Supabase Triggers & Constraints

### 5 Persona Limit Trigger
By default, Supabase enforces max 5 personas per account.

```sql
-- Trigger function
CREATE OR REPLACE FUNCTION enforce_persona_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM personas WHERE account_id = NEW.account_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 personas per account';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER check_persona_limit
  BEFORE INSERT ON personas
  FOR EACH ROW
  EXECUTE FUNCTION enforce_persona_limit();
```

**To disable for admin operations:** Go to Supabase Dashboard → Database → Triggers → Disable `check_persona_limit`

### Foreign Key Constraint
`ip_tracks.persona_id` references `personas.id`. Must unlink tracks before deleting persona.

```sql
-- The constraint
ALTER TABLE ip_tracks
  ADD CONSTRAINT ip_tracks_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES personas(id);

-- Before deleting persona, unlink tracks
UPDATE ip_tracks SET persona_id = NULL WHERE persona_id = 'uuid-here';
DELETE FROM personas WHERE id = 'uuid-here';
```

---

## Backup System

### Backup Script
`scripts/backup-tables.js` - Creates JSON exports of key tables.

```bash
# Run from project root
node scripts/backup-tables.js
```

**Tables backed up:**
- ip_tracks
- user_profiles
- personas
- accounts
- alpha_users

**Output:** `/backups/YYYY-MM-DD/tablename.json`

### Git Tags
Create git tags before major changes:

```bash
git tag -a v2025-12-28-persona-system -m "Persona system complete"
git push origin v2025-12-28-persona-system
```

---

## Migration Workflow

### For Each Existing User

1. **Find their zkLogin account** (created when they sign in with Google + invite code)
2. **Create account record** if needed (Form 2)
3. **Add persona** with their existing username, avatar, bio (Form 3)
4. **Link their STX wallet** to the account (Form 4)

### Handling Username Conflicts

If a user wants their original username but it's taken by an old persona:

1. Delete the old persona (Form 5) - this frees the username
2. Create new persona with the original username (Form 3)

Or use Edit Persona (Form 6) to rename the old one first.

### Verification Steps

After migrating a user:
1. Check their profile page loads: `/profile/username`
2. Check their store page loads: `/store/username`
3. Check their content cards link correctly
4. Check persona switcher in header shows correctly

---

## File Reference

### Admin System
```
app/admin/users/page.tsx           - Admin UI with all 6 forms
app/api/admin/create-account/route.ts
app/api/admin/add-persona-to-account/route.ts
app/api/admin/link-stx-wallet/route.ts
app/api/admin/delete-persona/route.ts
app/api/admin/edit-persona/route.ts
```

### Auth & Context
```
contexts/AuthContext.tsx           - Auth state, personas array, switchPersona()
lib/supabase.ts                    - Supabase client
```

### UI Components
```
components/layout/Header.tsx       - Persona switcher dropdown
components/cards/CompactTrackCardWithFlip.tsx
components/modals/TrackDetailsModal.tsx
components/mixer/SimplifiedMixer.tsx
components/mixer/SimplifiedDeck.tsx
```

### Profile/Store Pages
```
app/profile/[walletAddress]/page.tsx
app/store/[walletAddress]/page.tsx
components/profile/ProfileInfo.tsx
```

### Utilities
```
scripts/backup-tables.js           - Database backup script
```

---

## Troubleshooting

### "Maximum of 5 personas per account" Error
- Disable the `check_persona_limit` trigger in Supabase Dashboard
- Or delete old personas first before creating new ones

### "Foreign key constraint ip_tracks_persona_id_fkey" Error
- Must unlink tracks before deleting persona
- The delete-persona API route handles this automatically

### 500 Error on API Routes
- Check if using `.single()` when result might not exist
- Use `.maybeSingle()` for optional results

### Username Not Showing on Cards
- Verify persona has `is_active: true`
- Check `wallet_address` matches `primary_uploader_wallet` on track
- Verify the component uses the persona-first lookup pattern

### Profile Page 404
- Check if URL uses username or wallet address
- Verify the lookup logic handles both cases

---

## Version History

- **December 28, 2025** - Initial persona system implementation
  - Admin page with 6 forms
  - Username lookup pattern in all content cards
  - Header persona switcher with video avatar support
  - Profile/Store URL resolution
  - Backup script and documentation
