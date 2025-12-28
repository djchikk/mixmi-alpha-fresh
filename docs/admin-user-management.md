# Admin User Management

Documentation for the admin user management page at `/admin/users`.

---

## Overview

The admin page provides tools for managing users during the alpha transition period. It handles four different scenarios for creating and migrating users between the legacy wallet-based system and the new account/persona system.

---

## Access

Navigate to `/admin/users` and enter the admin access code when prompted.

---

## The Four Forms

### Form 1: Create zkLogin User

**Purpose:** Create a brand new user who will log in via zkLogin (Google) without any existing Stacks wallet.

**When to use:**
- New alpha testers joining without crypto wallet experience
- Creating test accounts for QA purposes
- Setting up accounts that will later have wallets added

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| Username | Yes | The @username for their default persona (lowercase, no spaces) |
| Display Name | No | Friendly display name (defaults to username if blank) |
| Invite Code | Yes | Unique code they'll use to log in |

**What it creates:**
1. New `accounts` row
2. New `alpha_users` entry with the invite code
3. New `user_profiles` entry with placeholder wallet (`ZKLOGIN-{username}`)
4. New `personas` entry (marked as default)
5. Initial profile sections (spotlight, media, shop, gallery)

---

### Form 2: Migrate Wallet User

**Purpose:** Convert an existing wallet-only user to the new account/persona system.

**When to use:**
- User has content uploaded under a Stacks wallet address
- User wants to switch to zkLogin but keep their content
- Wallet user needs an invite code for the new login system

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| Wallet Address | Yes | Full Stacks wallet address (SP...) |
| Persona Username | Yes | Username for their new persona |
| Invite Code | No | If provided, creates/updates alpha_users entry |

**What it does:**
1. Creates new `accounts` row
2. Creates/updates `alpha_users` with invite code (if provided)
3. Updates existing `user_profiles` with account_id (or creates new one)
4. Creates new `personas` with wallet_address linked
5. Copies existing profile data (name, avatar, bio) to persona

**Important:** Will fail if wallet already has an account_id. Use "Add Persona" or "Transfer Wallet" instead.

---

### Form 3: Transfer Wallet to Persona

**Purpose:** Link an additional wallet's content to an existing persona.

**When to use:**
- User has content under multiple wallets
- Want to consolidate wallet content under one persona
- Persona already exists but needs more wallets linked

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| Source Wallet | Yes | Full Stacks wallet address to transfer from |
| Target Persona | Yes | Existing @username to receive the content |
| Copy Profile Data | Checkbox | Whether to copy name/avatar/bio from wallet profile |

**What it does:**
1. Links wallet's `user_profiles` entry to persona's account_id
2. Optionally copies profile data to persona (name, avatar, bio)
3. Sets wallet_address on persona if not already set
4. Creates minimal profile if wallet had no profile

**Note:** The persona must already exist. Use Form 4 first if needed.

---

### Form 4: Add Persona to Account

**Purpose:** Add a new persona to an existing account, preserving original usernames.

**When to use:**
- Adding radio stations or other content to a bundle account
- User needs multiple personas with specific usernames
- Consolidating many profiles under one login

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| Select Account | Yes | Dropdown of existing accounts (shows default persona username) |
| Persona Username | Yes | The @username for this persona (can be any available name) |
| Display Name | No | Friendly name (defaults to username) |
| Wallet Address | No | Optional wallet to link to this persona |
| Copy Profile Data | Checkbox | If wallet provided, copy its name/avatar/bio |

**What it does:**
1. Creates new `personas` entry under selected account
2. If wallet provided:
   - Links wallet's `user_profiles` to the account
   - Optionally copies profile data to persona
   - Creates minimal profile if wallet had none

**Key benefit:** Bypasses the 5-persona limit that applies to user-created personas. Admin can add unlimited personas.

---

## Reference Tables

The admin page displays two reference tables at the bottom:

### All Personas Table
Shows all personas in the system with:
- Username
- Display Name
- Account ID
- Wallet Address (if linked)
- Default status

### Wallets & Profiles Table
Shows all user_profiles with:
- Wallet Address (truncated)
- Display Name
- Username
- Account ID (if linked)
- Track Count

---

## Common Workflows

### Adding a Radio Station Bundle

1. Have an existing account (or create one with Form 1)
2. Use **Form 4** for each radio station:
   - Select the account from dropdown
   - Enter the radio station's original username
   - Enter display name
   - Paste wallet address if it has one
   - Check "Copy profile data" to bring over avatar/bio
3. Repeat for each station

### Converting Legacy Wallet User

1. Use **Form 2** with their wallet address
2. Give them a new invite code to log in
3. They'll see their existing content under their new persona

### Consolidating Multiple Wallets

1. First ensure target persona exists (Form 1, 2, or 4)
2. Use **Form 3** for each additional wallet
3. Each wallet's content will be accessible under the persona

---

## Technical Details

### Placeholder Wallets

zkLogin users without real wallets get a placeholder: `ZKLOGIN-{username}`

This maintains compatibility with the wallet-based lookup chain while allowing pure social login.

### The Lookup Chain

```
zklogin_users.invite_code
  → alpha_users.wallet_address
    → user_profiles.account_id
      → personas (multiple per account)
```

### Database Tables Affected

| Table | Purpose |
|-------|---------|
| `accounts` | Parent container for personas |
| `personas` | Individual identities with usernames |
| `user_profiles` | Legacy profiles, linked via account_id |
| `alpha_users` | Invite code authorization |
| `user_profile_sections` | Profile content sections |

---

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Username is already taken" | Username exists in personas | Choose different username |
| "Invite code already exists" | Duplicate invite code | Use unique code |
| "Wallet already linked to account" | Wallet has account_id | Use Form 3 or 4 instead |
| "Account not found" | Invalid account ID | Select from dropdown |
| "Could not find persona" | Username doesn't exist | Create persona first |

---

## Notes

- All operations require the admin access code
- Changes take effect immediately in the database
- Users may need to refresh or re-login to see changes
- Track counts shown are for non-deleted tracks only
