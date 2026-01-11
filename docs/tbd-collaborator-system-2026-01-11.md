# TBD Collaborator System

**Date:** January 11, 2026

This document explains how mixmi handles collaborators who don't have accounts yet, and how managers can resolve these placeholder accounts once collaborators join.

---

## Overview

When uploading content to mixmi, creators often collaborate with people who aren't on the platform yet. Rather than losing track of these collaborators or their earnings, mixmi creates **TBD (To Be Determined) personas** - placeholder accounts that hold earnings until the real collaborator claims them.

---

## How TBD Personas Work

### Creation

TBD personas are created in two ways:

1. **Via Upload Studio Chatbot**: When a user mentions a collaborator by name who isn't found on mixmi, the chatbot offers to create a managed persona for them.

2. **Via Edit Form**: When editing track splits, if a collaborator search returns no results, users can click "Create managed wallet for [Name]" to create a TBD persona.

### Naming Convention

TBD personas use a `-tbd` suffix to clearly identify them as placeholders:
- `julie-tbd`
- `kwame-jones-tbd`
- `tokyo-producer-tbd`

### Ownership

TBD personas are created under the **uploader's account**. The uploader becomes the **manager** of this persona, meaning:
- They can see the TBD persona in their account dashboard
- They hold the earnings on behalf of the collaborator
- They're responsible for resolving (linking) the persona when the collaborator joins

### Wallets

Each TBD persona gets a real SUI wallet address. This means:
- Track splits can reference the wallet immediately
- Earnings accumulate in a real on-chain address
- The wallet can be transferred or linked when the collaborator claims

---

## The Resolve Dashboard

Located in **Account → Earnings → Resolve** tab.

### What It Shows

For each TBD persona you manage:
- **Display name** and **username** (with `-tbd` suffix)
- **Track count** - how many tracks reference this wallet in splits
- **Balance** - accumulated earnings (USDC)
- **Created date**

### Resolution Actions

Three buttons for each TBD persona:

#### 1. Invite (Recommended)
Generates a unique claim link that you send to your collaborator.

**How it works:**
1. Click "Invite" → system generates a claim token
2. Link is copied to your clipboard (e.g., `mixmi.app/claim/Ab3xYz`)
3. Send this link to your collaborator via text, email, DM, etc.
4. They click the link, sign up or log in
5. They select which of their personas to claim to
6. System updates all track splits and transfers balance
7. TBD persona is archived

**Why this is best:**
- You control who gets the link (you know them IRL)
- They prove ownership by having the secret link
- No admin verification needed
- Clean handoff of earnings

#### 2. Link to User
For when the collaborator already has a mixmi account but you didn't know their username when uploading.

**How it works:**
1. Click "Link to User"
2. Search for their username
3. Select the correct user
4. Confirm the link

*Note: This feature requires additional confirmation flow (coming soon)*

#### 3. This is Me
For when you realize the TBD persona is actually yourself (a different alias or stage name).

**How it works:**
1. Click "This is Me"
2. Select which of your personas to merge into
3. Confirm the merge
4. All track splits update, balance transfers, TBD is archived

---

## The Claim Page (`/claim/[token]`)

When a collaborator receives an invite link:

### What They See
- **Gift icon** with "Claim Your Earnings" header
- **Credit name** - the display name on the TBD persona
- **Track count** - how many tracks they're credited on
- **Balance** - how much USDC is waiting for them

### If Not Logged In
- Sign Up / Sign In buttons
- Redirects back to claim page after auth

### If Logged In
- List of their personas (excluding any TBD personas)
- Select which persona to claim to
- "Claim to My Account" button

### After Claiming
- Success confirmation
- Link to view their Earnings dashboard
- All future royalties go directly to their wallet

---

## Technical Details

### Database Tables

**`personas`** (existing)
- TBD personas have `-tbd` in username
- `account_id` links to manager's account
- `sui_address` is a real generated wallet

**`tbd_claim_tokens`** (new)
```sql
- id: uuid
- token: text (unique, 6 chars)
- tbd_persona_id: uuid (FK to personas)
- created_by_account_id: uuid (FK to accounts)
- created_at: timestamp
- expires_at: timestamp (default 90 days)
- claimed_at: timestamp (null until claimed)
- claimed_by_persona_id: uuid (FK to personas)
- recipient_name: text
- recipient_contact: text
```

### API Endpoints

**`POST /api/personas/generate-claim-token`**
- Input: `{ tbdPersonaId, accountId, recipientName? }`
- Returns: `{ token, claimUrl, expiresAt }`
- Reuses existing active token if one exists

**`GET /api/personas/claim-tbd?token=xxx`**
- Returns claim info for display on claim page

**`POST /api/personas/claim-tbd`**
- Input: `{ token, claimingPersonaId, claimingAccountId }`
- Updates all track splits (6 wallet fields)
- Transfers balance
- Archives TBD persona

**`POST /api/upload-studio/create-collaborator-persona`**
- Creates TBD persona under uploader's account
- Auto-generates `-tbd` suffix username

### Track Split Fields Updated on Claim

When a TBD persona is claimed, these fields are updated across all tracks:
- `composition_split_1_wallet`
- `composition_split_2_wallet`
- `composition_split_3_wallet`
- `production_split_1_wallet`
- `production_split_2_wallet`
- `production_split_3_wallet`

---

## User Flow Example

### Scenario: Sandy uploads a track with Julie

1. **Upload**: Sandy uses Upload Studio, mentions "Julie did the vocals"
2. **Search**: System searches for Julie, finds no match
3. **Create TBD**: Sandy confirms creating a managed persona
4. **Result**: `@julie-tbd` created under Sandy's account with its own wallet
5. **Track saved**: Split points to `julie-tbd`'s wallet address

### Later: Julie joins mixmi

6. **Resolve**: Sandy goes to Earnings → Resolve
7. **Invite**: Sandy clicks "Invite" on Julie's card
8. **Share**: Sandy texts Julie the claim link
9. **Claim**: Julie clicks link, signs up, claims to her new persona
10. **Done**: Julie now owns her earnings, future royalties go to her

---

## Design Philosophy

### Why TBD Personas vs. Just Wallet Addresses?

- **Visibility**: TBD personas show up in "Managed Accounts" dashboard
- **Accountability**: Clear who is holding whose earnings
- **Audit trail**: All transactions visible in earnings history
- **Clean handoff**: Persona can be claimed, not just wallet transferred

### Why Invite Links vs. Admin Verification?

- **Scalable**: No admin bottleneck
- **Trust-based**: Manager knows collaborator IRL
- **Self-service**: Collaborator can claim anytime
- **Secure**: Secret link = proof of relationship

### Why 90-Day Expiration?

- Long enough for collaborators to get around to it
- Short enough to prompt action
- Can always generate a new link if expired

---

## Files Reference

| File | Purpose |
|------|---------|
| `components/account/EarningsTab.tsx` | Resolve tab UI |
| `app/claim/[token]/page.tsx` | Claim page UI |
| `app/api/personas/generate-claim-token/route.ts` | Generate invite links |
| `app/api/personas/claim-tbd/route.ts` | Process claims |
| `app/api/upload-studio/create-collaborator-persona/route.ts` | Create TBD personas |
| `lib/upload-studio/system-prompt.ts` | Chatbot TBD handling |
| `components/shared/CollaboratorAutosuggest.tsx` | Edit form TBD creation |
| `supabase/migrations/20260110_tbd_claim_tokens.sql` | Claim tokens table |
