# Database Field Usage Report

**Date:** October 26, 2025
**Project:** mixmi Alpha Platform
**Purpose:** Analyze which database fields are actively used vs. deprecated/unused

---

## Executive Summary

**Analysis Method:** Comprehensive grep search of TypeScript/TSX codebase + TypeScript interface inspection

**Key Findings:**
- ✅ **3 duplicate field pairs found** - Can consolidate to save space
- ⚠️ **Splits 4-7 ARE USED** - Critical for Gen 1 remix attribution (DO NOT DROP)
- ⚠️ **Payment fields ARE USED** - Essential for blockchain transaction tracking
- ⚠️ **Old pricing fields STILL USED** - Active in codebase, cannot drop yet
- ✅ **2 legacy fields safe to drop** - `account_name`, `main_wallet_name` (just populated, never read)

---

## 1. Duplicate Uploader Fields

### Fields Analyzed
- `primary_uploader_wallet` (23 files)
- `uploader_address` (6 files)

### Usage Analysis

**primary_uploader_wallet:**
- ✅ Defined in TypeScript types (types/index.ts:145)
- ✅ Used throughout codebase (23 files)
- ✅ Primary field for track ownership

**uploader_address:**
- ❌ NOT in TypeScript types
- ⚠️ Used as fallback in 6 files
- 🔍 Comment in code: "Legacy field - required by database" (PaymentModal.tsx:398)

**Evidence:**
```typescript
// lib/globeDataSupabase.ts:42
uploaderAddress: track.uploader_address || track.primary_uploader_wallet

// hooks/useIPTrackSubmit.ts:526
uploader_address: effectiveWalletAddress || "",

// components/mixer/PaymentModal.tsx:398
uploader_address: walletAddress, // Legacy field - required by database
```

### Recommendation
**✅ DROP `uploader_address`**
- Reason: Clearly documented as legacy field
- Action: Update code to remove fallback references
- Migration: No data migration needed (primary_uploader_wallet has all values)

---

## 2. Duplicate Generation Fields

### Fields Analyzed
- `remix_depth` (10 files)
- `generation` (2 files)

### Usage Analysis

**remix_depth:**
- ✅ Defined in TypeScript types (types/index.ts:129)
- ✅ Used extensively (10 files)
- ✅ Primary field for generation tracking

**generation:**
- ❌ NOT in TypeScript types
- ⚠️ Used in 2 files with OR logic as fallback

**Evidence:**
```typescript
// components/mixer/PaymentModal.tsx:401
generation: 1, // This is a first-generation remix

// components/cards/CompactTrackCardWithFlip.tsx:634-638
{track.generation === 0 || track.remix_depth === 0 ? (
  'Gen 0'
) : track.generation === 1 || track.remix_depth === 1 ? (
  'Gen 1'
) : ...}
```

### Recommendation
**✅ DROP `generation`**
- Reason: Duplicate of remix_depth, only used as fallback
- Action: Update 2 files to use only remix_depth
- Migration: No data migration needed (remix_depth has all values)

---

## 3. Duplicate Parent Track References

### Fields Analyzed
- `source_track_ids` (5 files, array type)
- `parent_track_1_id`, `parent_track_2_id` (2 files)

### Usage Analysis

**source_track_ids:**
- ✅ Defined in TypeScript types (types/index.ts:130)
- ✅ Array field, more flexible
- ✅ Used in 5 files

**parent_track_1_id/parent_track_2_id:**
- ❌ NOT in TypeScript types
- ⚠️ Populated when creating remixes
- ⚠️ Used as fallback when reading

**Evidence:**
```typescript
// components/mixer/PaymentModal.tsx:402-403
parent_track_1_id: sourceTrackIds[0] || null, // First source loop
parent_track_2_id: sourceTrackIds[1] || null, // Second source loop

// components/modals/TrackDetailsModal.tsx:222-234
const hasNewIds = track.parent_track_1_id || track.parent_track_2_id;
if (hasNewIds) {
  if (track.parent_track_1_id) sourceIds.push(track.parent_track_1_id);
  if (track.parent_track_2_id) sourceIds.push(track.parent_track_2_id);
}
```

### Recommendation
**✅ DROP `parent_track_1_id` and `parent_track_2_id`**
- Reason: source_track_ids array is more flexible (supports 3+ source loops)
- Action: Update PaymentModal.tsx to stop populating these fields
- Migration: No data migration needed (source_track_ids has all values)

---

## 4. Old vs New Pricing Fields

### Fields Analyzed
- **New:** `remix_price_stx`, `download_price_stx` (11 files)
- **Old:** `price_stx`, `remix_price` (no _stx suffix), `download_price`, `combined_price` (28 files)

### Usage Analysis

**remix_price_stx & download_price_stx:**
- ✅ Defined in TypeScript types
- ✅ Used in 11 files
- ✅ Current pricing model

**price_stx (legacy):**
- ✅ Defined in TypeScript types with comment "Legacy combined price (kept for backward compatibility)"
- ⚠️ **ACTIVELY USED** in 28 files
- ⚠️ Used as fallback: `track.download_price_stx ?? track.price_stx ?? 2.5`

**remix_price (no _stx suffix):**
- ❌ NOT in TypeScript types
- ⚠️ **ACTIVELY USED** in upload modal and forms
- ⚠️ Used in type definitions in useIPTrackForm.ts

**Evidence:**
```typescript
// contexts/CartContext.tsx:78
const downloadPrice = track.download_price_stx ?? track.price_stx ?? 2.5;

// hooks/useIPTrackForm.ts:60
remix_price: number;

// components/modals/IPTrackModal.tsx:1653-1681
if (!(formData as any).remix_price) { /* validation */ }
value={(formData as any).remix_price || 0.5}
```

### Recommendation
**❌ DO NOT DROP old pricing fields yet**
- Reason: Still actively used throughout codebase
- Action Required: **Data migration needed first**
  1. Consolidate remix_price → remix_price_stx
  2. Consolidate download_price → download_price_stx
  3. Consolidate combined_price → (decide: remix or download?)
  4. Update all code references
  5. THEN drop old fields in future migration
- Timeline: Requires dedicated refactoring sprint

---

## 5. Splits 4-7 (Extended Splits)

### Fields Analyzed
- `composition_split_1-3_wallet/percentage` (19 files)
- `composition_split_4-7_wallet/percentage` (2 files)
- `production_split_1-3_wallet/percentage` (19 files)
- `production_split_4-7_wallet/percentage` (2 files)

### Usage Analysis

**Splits 1-3:**
- ✅ Defined in TypeScript types
- ✅ Heavily used (19 files)

**Splits 4-7:**
- ❌ NOT in TypeScript types
- ✅ **ACTIVELY USED for Gen 1 remixes**

**Evidence:**
```typescript
// components/mixer/PaymentModal.tsx:433-456
composition_split_4_wallet: remixSplits.composition[3]?.wallet,
composition_split_4_percentage: remixSplits.composition[3]?.percentage,
// ... through split_7 for both composition and production

// components/modals/TrackDetailsModal.tsx:106-116
// Reads splits 4-7 when displaying track details
```

**User Context (from handoff document):**
> "The 7 wallet addresses per track are there to accommodate remix generation 1. Assuming that we are only starting with 7 total for generation 0."

### Recommendation
**❌ DO NOT DROP splits 4-7**
- Reason: Critical for Gen 1 remix IP attribution
- Reason: Actively populated and read for remixes
- Action: **ADD to TypeScript types** (currently missing!)
- Note: When a Gen 0 loop with 3 contributors is remixed with another Gen 0 loop with 3 contributors, you get 6 contributors in the Gen 1 remix (3 from each source)

---

## 6. Commercial & Collaboration Fields

### Fields Analyzed
- `open_to_commercial`, `commercial_contact`, `commercial_contact_fee`
- `collab_contact`, `collab_contact_fee`

### Usage Analysis

**All commercial/collab fields:**
- ❌ NOT in TypeScript types
- ✅ **ACTIVELY USED** in upload modal
- ✅ Stored to database
- ✅ Displayed in TrackDetailsModal
- ✅ Used in certificate generation

**Evidence:**
```typescript
// components/modals/IPTrackModal.tsx:1499-1543
checked={(formData as any).open_to_commercial || false}
value={(formData as any).commercial_contact || ''}
value={(formData as any).commercial_contact_fee || 10}

// lib/certificate-service.ts:436-475
if (data.open_to_commercial) {
  if (data.commercial_contact) { /* display on certificate */ }
}
```

### Recommendation
**❌ DO NOT DROP commercial/collaboration fields**
- Reason: Active feature with UI and certificate integration
- Action: **ADD to TypeScript types** (currently missing!)
- Note: These fields enable commercial licensing and collaboration workflows

---

## 7. Unclear/Mystery Fields

### 7.1 account_name & main_wallet_name

**Usage:**
- ❌ NOT in TypeScript types
- ⚠️ Only WRITTEN, never READ

**Evidence:**
```typescript
// hooks/useIPTrackSubmit.ts:533-534
account_name: effectiveWalletAddress || "",
main_wallet_name: effectiveWalletAddress || "",

// Only found in old modal - just setting to wallet address
```

**Recommendation:**
**✅ DROP `account_name` and `main_wallet_name`**
- Reason: Populated but never used
- Migration: No action needed (never read)

---

### 7.2 stacks_tx_id, payment_status, payment_checked_at

**Usage:**
- ❌ NOT in TypeScript types
- ✅ **CRITICAL for payment verification**

**Evidence:**
```typescript
// components/mixer/PaymentModal.tsx:420-424
stacks_tx_id: stacksTxId,
payment_status: 'pending',
payment_checked_at: null,

// app/api/verify-remix-payments/route.ts:22-163
.eq('payment_status', 'pending')
// Verifies blockchain transactions, updates to 'confirmed' or 'failed'
```

**Recommendation:**
**❌ DO NOT DROP payment tracking fields**
- Reason: Essential for blockchain transaction verification
- Reason: API endpoint depends on these fields
- Action: **ADD to TypeScript types** (currently missing!)
- Note: Especially important given potential blockchain migration

---

### 7.3 duration

**Usage:**
- ❌ NOT in TypeScript types for IPTrack
- ⚠️ Field name used for audio buffer durations (in-memory, not database)

**Evidence:**
```typescript
// All usage is for audio buffer duration, not database field:
// lib/simplifiedMixerAudio.ts:149
this.state.deckA.duration = audioBuffer.duration;

// Only database-related usage is in backup certificate service
// lib/certificate-service.backup.ts:181
if (data.content_type === 'full_song' && data.duration) totalHeight += 6;
```

**Recommendation:**
**⚠️ UNCLEAR - Need user input**
- Current state: Only used in backup certificate service
- Question: Is track duration stored in database or calculated on-the-fly?
- If stored: Keep and add to TypeScript types
- If calculated: Safe to drop from database

---

### 7.4 is_live

**Usage:**
- ❌ NOT in TypeScript types
- ⚠️ Only hardcoded to `true`, never read

**Evidence:**
```typescript
// hooks/useIPTrackSubmit.ts:532
is_live: true,

// components/modals/IPTrackModal.old.tsx:681
is_live: true,  // DATABASE COLUMN: is_live
```

**Recommendation:**
**✅ DROP `is_live`**
- Reason: Hardcoded to true, no conditional logic
- Migration: No action needed (always true)
- Future: If needed for draft/published states, add back with UI controls

---

### 7.5 notes

**Usage:**
- ❌ NOT in TypeScript types
- ✅ **ACTIVELY USED**

**Evidence:**
```typescript
// components/modals/IPTrackModal.tsx:1112
value={(formData as any).notes || ''}

// components/modals/TrackDetailsModal.tsx:879-883
{(track.tell_us_more || track.notes) && (
  <p>{track.tell_us_more || track.notes}</p>
)}

// lib/certificate-service.ts:537-563
if (data.notes) {
  const notesLines = doc.splitTextToSize(data.notes, notesWidth);
}
```

**Recommendation:**
**❌ DO NOT DROP `notes`**
- Reason: Used in upload form, track details, and certificates
- Action: **ADD to TypeScript types** (currently missing!)
- Note: Appears to be transitioning to `tell_us_more` field

---

## 8. License Fields

### Fields Analyzed
- `license_type` (defined in TypeScript, used in 25 files)
- `license_selection` (NOT in TypeScript, used in 25 files)

### Usage Analysis

**license_type:**
- ✅ Defined in TypeScript types: `'remix_only' | 'remix_external' | 'custom'`
- ✅ Used in forms, certificates, track cards

**license_selection:**
- ❌ NOT in TypeScript types
- ✅ **ACTIVELY USED** in newer upload modal
- Values: `'platform_remix'`, `'platform_download'`

**Evidence:**
```typescript
// Both fields actively used:
// components/modals/IPTrackModal.tsx:1648
checked={(formData as any).license_selection === 'platform_remix'}

// types/index.ts:92
license_type?: 'remix_only' | 'remix_external' | 'custom';
```

### Recommendation
**⚠️ CONSOLIDATE license fields - Need user input**
- Current state: Two different naming conventions for same concept
- Question: Which field is the "source of truth"?
- Options:
  1. Keep both (allow transition period)
  2. Migrate license_selection → license_type with value mapping
  3. Migrate license_type → license_selection (newer pattern)
- Action required: User decision on preferred field name + migration strategy

---

## 9. Alpha Users Table

### Fields Analyzed
- `invite_code` (should rename to `alpha_code` per docs)
- `approved` (should rename to `is_active` per docs)
- `artist_name` (✅ USED)
- `email` (❌ UNUSED)
- `notes` (need to check)

### Usage Analysis

**artist_name:**
- ✅ **ACTIVELY USED**

**Evidence:**
```typescript
// lib/auth/alpha-auth.ts:82
.select('wallet_address, artist_name, email, notes, approved, created_at, invite_code')

// Used throughout: track.artist || track.artist_name
```

**email:**
- Selected from database but never referenced in code
- No grep matches for `alpha.*\.email`

**Recommendation:**
- **✅ RENAME** `invite_code` → `alpha_code` (consistency with docs)
- **✅ RENAME** `approved` → `is_active` (more descriptive)
- **✅ ADD** `approved_at` timestamp field
- **❌ KEEP** `artist_name` (actively used)
- **✅ DROP** `email` if confirmed unused (or move to future user profile table)
- **⚠️ CHECK** `notes` field usage in alpha_users table

---

## Summary Table

| Field(s) | Status | TypeScript | Usage | Recommendation |
|----------|--------|------------|-------|----------------|
| `uploader_address` | Legacy | ❌ | Fallback only | ✅ **DROP** |
| `generation` | Legacy | ❌ | Fallback only | ✅ **DROP** |
| `parent_track_1_id`, `parent_track_2_id` | Legacy | ❌ | Fallback only | ✅ **DROP** |
| `account_name`, `main_wallet_name` | Unused | ❌ | Written never read | ✅ **DROP** |
| `is_live` | Unused | ❌ | Hardcoded true | ✅ **DROP** |
| **Splits 4-7** | **Active** | ❌ | **Gen 1 remixes** | ❌ **KEEP + add to types** |
| **Payment fields** | **Active** | ❌ | **Blockchain tracking** | ❌ **KEEP + add to types** |
| **Commercial fields** | **Active** | ❌ | **Licensing UI** | ❌ **KEEP + add to types** |
| **Old pricing** | **Active** | Mixed | **Widely used** | ❌ **Migrate first, then drop** |
| **`notes`** | **Active** | ❌ | **Forms + certs** | ❌ **KEEP + add to types** |
| `license_type` vs `license_selection` | Both active | Mixed | Both used | ⚠️ **User decision needed** |
| `duration` | Unclear | ❌ | Only in backup | ⚠️ **User decision needed** |

---

## Recommended Actions

### Immediate (Safe to Drop)
1. ✅ Drop `uploader_address`
2. ✅ Drop `generation`
3. ✅ Drop `parent_track_1_id`, `parent_track_2_id`
4. ✅ Drop `account_name`, `main_wallet_name`
5. ✅ Drop `is_live`
6. ✅ Drop `email` from alpha_users (if confirmed unused)

### Add to TypeScript Types
1. Splits 4-7 (composition and production)
2. Payment tracking fields (`stacks_tx_id`, `payment_status`, `payment_checked_at`)
3. Commercial fields (`open_to_commercial`, `commercial_contact`, `commercial_contact_fee`)
4. Collaboration fields (`collab_contact`, `collab_contact_fee`)
5. `notes` field
6. `license_selection` (if keeping)

### Requires User Decision
1. **License fields:** Consolidate `license_type` vs `license_selection`
2. **Duration field:** Keep or drop?
3. **Pricing migration:** When to migrate old → new pricing fields?

### Future Work
1. Plan pricing field migration (old → new with _stx suffix)
2. Consider splitting alpha_users into auth + profile tables
3. Add `approved_at` timestamp to alpha_users

---

## Questions for User

### 1. License Fields Consolidation
**Question:** You have two license systems:
- `license_type`: 'remix_only' | 'remix_external' | 'custom'
- `license_selection`: 'platform_remix' | 'platform_download'

Should we:
- A) Keep `license_type` and map `license_selection` values to it
- B) Keep `license_selection` and deprecate `license_type`
- C) Keep both for now (maintain compatibility)

### 2. Duration Field
**Question:** The `duration` field is only referenced in backup certificate service. Should we:
- A) Keep it for track duration metadata
- B) Drop it (calculate duration on-the-fly from audio files)
- C) Move it to a separate metadata table

### 3. Old Pricing Fields
**Question:** When should we migrate away from old pricing fields?
- Current state: Both old and new pricing fields actively used
- Option A: Migrate in this cleanup (requires code refactoring)
- Option B: Migrate in separate sprint (safer, more time)
- Option C: Keep both indefinitely (technical debt)

### 4. Blockchain Migration Impact
**Question:** You mentioned possibly moving to a different blockchain. Should we:
- A) Keep all payment fields as-is (blockchain-agnostic naming)
- B) Rename to more generic terms (e.g., `blockchain_tx_id` instead of `stacks_tx_id`)
- C) Wait until blockchain decision is final

---

**End of Report**
