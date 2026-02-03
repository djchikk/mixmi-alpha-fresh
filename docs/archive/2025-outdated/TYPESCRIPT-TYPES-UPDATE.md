# TypeScript Types Update Documentation

**Date:** October 26, 2025
**File:** `types/index.ts`
**Purpose:** Add missing fields that exist in database but not in TypeScript types

---

## Overview

**Problem:** Many actively-used database fields are missing from TypeScript types, causing:
- Type errors and `as any` casts throughout codebase
- No autocomplete for these fields in IDE
- Runtime errors when accessing undefined properties

**Solution:** Add missing fields to `IPTrack` interface

---

## Current State Analysis

### ✅ Fields in Database AND TypeScript
- `primary_uploader_wallet`
- `remix_depth`
- `source_track_ids`
- `license_type`
- `price_stx`
- `remix_price_stx`, `download_price_stx`
- Composition/production splits 1-3

### ❌ Fields in Database but NOT in TypeScript
- **Splits 4-7** (composition and production)
- **Payment tracking** (`stacks_tx_id`, `payment_status`, `payment_checked_at`)
- **Commercial licensing** (`open_to_commercial`, `commercial_contact`, `commercial_contact_fee`)
- **Collaboration** (`collab_contact`, `collab_contact_fee`)
- **Additional fields** (`notes`, `license_selection`)
- **Alpha users fields** (needs separate interface)

---

## Recommended TypeScript Changes

### 1. Add Splits 4-7 to IPTrack Interface

**Location:** `types/index.ts`, lines 104-117 (after existing splits 1-3)

```typescript
export interface IPTrack {
  // ... existing fields ...

  // Composition Splits (up to 7 for Gen 1 remixes)
  composition_split_1_wallet: string;
  composition_split_1_percentage: number;
  composition_split_2_wallet?: string;
  composition_split_2_percentage?: number;
  composition_split_3_wallet?: string;
  composition_split_3_percentage?: number;
  composition_split_4_wallet?: string; // 🆕 NEW
  composition_split_4_percentage?: number; // 🆕 NEW
  composition_split_5_wallet?: string; // 🆕 NEW
  composition_split_5_percentage?: number; // 🆕 NEW
  composition_split_6_wallet?: string; // 🆕 NEW
  composition_split_6_percentage?: number; // 🆕 NEW
  composition_split_7_wallet?: string; // 🆕 NEW
  composition_split_7_percentage?: number; // 🆕 NEW

  // Production Splits (up to 7 for Gen 1 remixes)
  production_split_1_wallet: string;
  production_split_1_percentage: number;
  production_split_2_wallet?: string;
  production_split_2_percentage?: number;
  production_split_3_wallet?: string;
  production_split_3_percentage?: number;
  production_split_4_wallet?: string; // 🆕 NEW
  production_split_4_percentage?: number; // 🆕 NEW
  production_split_5_wallet?: string; // 🆕 NEW
  production_split_5_percentage?: number; // 🆕 NEW
  production_split_6_wallet?: string; // 🆕 NEW
  production_split_6_percentage?: number; // 🆕 NEW
  production_split_7_wallet?: string; // 🆕 NEW
  production_split_7_percentage?: number; // 🆕 NEW

  // ... rest of fields ...
}
```

**Rationale:** These fields are actively used when creating Gen 1 remixes to track all contributors from both source loops.

---

### 2. Add Payment Tracking Fields

**Location:** `types/index.ts`, after `created_by` field

```typescript
export interface IPTrack {
  // ... existing fields ...

  // Payment and transaction tracking
  stacks_tx_id?: string; // 🆕 NEW - Blockchain transaction ID
  payment_status?: 'pending' | 'confirmed' | 'failed'; // 🆕 NEW - Payment verification status
  payment_checked_at?: string; // 🆕 NEW - Last payment verification timestamp

  // ... rest of fields ...
}
```

**Rationale:** These fields are critical for blockchain payment verification (see `app/api/verify-remix-payments/route.ts`).

**Note:** Consider renaming to `blockchain_tx_id` if moving to different blockchain.

---

### 3. Add Commercial Licensing Fields

**Location:** `types/index.ts`, after licensing section

```typescript
export interface IPTrack {
  // ... existing fields ...

  // Licensing and permissions
  license_type?: 'remix_only' | 'remix_external' | 'custom';
  license_selection?: 'platform_remix' | 'platform_download'; // 🆕 NEW - Newer licensing system
  allow_remixing?: boolean;
  open_to_collaboration?: boolean;
  open_to_commercial?: boolean; // 🆕 NEW - Commercial licensing available
  commercial_contact?: string; // 🆕 NEW - Contact for commercial licensing
  commercial_contact_fee?: number; // 🆕 NEW - Fee for commercial contact (STX)
  collab_contact?: string; // 🆕 NEW - Contact for collaboration opportunities
  collab_contact_fee?: number; // 🆕 NEW - Fee for collaboration contact (STX)
  agreed_to_terms?: boolean;

  // ... rest of fields ...
}
```

**Rationale:** These fields are actively used in upload modal, track details, and certificate generation.

---

### 4. Add Notes Field

**Location:** `types/index.ts`, near `tell_us_more` field

```typescript
export interface IPTrack {
  // ... existing fields ...

  description?: string;
  tell_us_more?: string;
  notes?: string; // 🆕 NEW - Additional notes/credits (used in forms and certificates)

  // ... rest of fields ...
}
```

**Rationale:** Actively used in upload forms, track details modal, and certificate generation.

---

### 5. Create AlphaUser Interface

**Location:** `types/index.ts`, after IPTrack interface

```typescript
// 🆕 NEW - Alpha user authentication and profile
export interface AlphaUser {
  wallet_address: string; // Primary key
  alpha_code: string; // Formerly invite_code - alpha access code
  artist_name: string; // Display name for artist
  is_active: boolean; // Formerly approved - whether user has access
  approved_at?: string; // Timestamp when user was approved
  created_at: string;
  updated_at: string;
  notes?: string; // Admin notes about user
}
```

**Rationale:** Alpha authentication system uses these fields. Types currently scattered across `lib/auth/alpha-auth.ts` and `app/api/alpha-auth/route.ts`.

**Note:** `email` field intentionally omitted - appears unused in codebase.

---

## Complete Updated IPTrack Interface

Here's the full interface with all additions:

```typescript
// IP Attribution System Types
export interface IPTrack {
  id: string;
  title: string;
  version?: string;
  artist: string;
  description?: string;
  tell_us_more?: string;
  notes?: string; // 🆕 NEW
  tags: string[];
  content_type: 'full_song' | 'loop' | 'loop_pack' | 'ep' | 'mix';
  loop_category?: string;
  sample_type: string;
  bpm?: number;
  key?: string;
  isrc?: string;
  social_urls?: Record<string, string>;
  contact_info?: Record<string, string>;

  // Licensing and permissions
  license_type?: 'remix_only' | 'remix_external' | 'custom';
  license_selection?: 'platform_remix' | 'platform_download'; // 🆕 NEW
  allow_remixing?: boolean;
  open_to_collaboration?: boolean;
  open_to_commercial?: boolean; // 🆕 NEW
  commercial_contact?: string; // 🆕 NEW
  commercial_contact_fee?: number; // 🆕 NEW
  collab_contact?: string; // 🆕 NEW
  collab_contact_fee?: number; // 🆕 NEW
  agreed_to_terms?: boolean;

  // Pricing fields
  price_stx?: number;
  remix_price_stx?: number;
  download_price_stx?: number;
  allow_downloads?: boolean;

  // Composition Splits (up to 7 for Gen 1 remixes)
  composition_split_1_wallet: string;
  composition_split_1_percentage: number;
  composition_split_2_wallet?: string;
  composition_split_2_percentage?: number;
  composition_split_3_wallet?: string;
  composition_split_3_percentage?: number;
  composition_split_4_wallet?: string; // 🆕 NEW
  composition_split_4_percentage?: number; // 🆕 NEW
  composition_split_5_wallet?: string; // 🆕 NEW
  composition_split_5_percentage?: number; // 🆕 NEW
  composition_split_6_wallet?: string; // 🆕 NEW
  composition_split_6_percentage?: number; // 🆕 NEW
  composition_split_7_wallet?: string; // 🆕 NEW
  composition_split_7_percentage?: number; // 🆕 NEW

  // Production Splits (up to 7 for Gen 1 remixes)
  production_split_1_wallet: string;
  production_split_1_percentage: number;
  production_split_2_wallet?: string;
  production_split_2_percentage?: number;
  production_split_3_wallet?: string;
  production_split_3_percentage?: number;
  production_split_4_wallet?: string; // 🆕 NEW
  production_split_4_percentage?: number; // 🆕 NEW
  production_split_5_wallet?: string; // 🆕 NEW
  production_split_5_percentage?: number; // 🆕 NEW
  production_split_6_wallet?: string; // 🆕 NEW
  production_split_6_percentage?: number; // 🆕 NEW
  production_split_7_wallet?: string; // 🆕 NEW
  production_split_7_percentage?: number; // 🆕 NEW

  // Media Assets
  cover_image_url?: string;
  audio_url?: string;

  // Loop Pack System
  pack_id?: string;
  pack_position?: number;
  total_loops?: number;

  // Remix tracking
  remix_depth?: number;
  source_track_ids?: string[];

  // Payment and transaction tracking
  stacks_tx_id?: string; // 🆕 NEW
  payment_status?: 'pending' | 'confirmed' | 'failed'; // 🆕 NEW
  payment_checked_at?: string; // 🆕 NEW

  // Metadata
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  created_by?: string;

  // Location fields
  location_lat?: number;
  location_lng?: number;
  primary_location?: string;
  locations?: Array<{ lat: number; lng: number; name: string }>;

  // Collaboration System Fields
  primary_uploader_wallet?: string;
  collaboration_preferences?: Record<string, boolean>;
  store_display_policy?: 'primary_only' | 'all_collaborations' | 'curated_collaborations';
  collaboration_type?: 'primary_artist' | 'featured_artist' | 'producer' | 'remixer' | 'composer' | 'vocalist';
}
```

---

## Files Requiring Updates After Type Changes

### 1. Remove `as any` casts

After adding these types, search for and remove type casts in these files:

**Search pattern:** `(formData as any).`

**Files to update:**
- `components/modals/IPTrackModal.tsx`
- `components/modals/TrackDetailsModal.tsx`
- `hooks/useIPTrackForm.ts`
- `hooks/useIPTrackSubmit.ts`
- `lib/certificate-service.ts`

**Example replacement:**
```typescript
// BEFORE (with any cast)
value={(formData as any).notes || ''}
value={(formData as any).commercial_contact || ''}

// AFTER (proper typing)
value={formData.notes || ''}
value={formData.commercial_contact || ''}
```

---

### 2. Update form type definitions

**File:** `hooks/useIPTrackForm.ts`

Remove duplicate field definitions and rely on imported `IPTrack` type:

```typescript
// BEFORE - Custom interface with duplicated fields
interface IPTrackFormData {
  notes: string;
  open_to_commercial: boolean;
  commercial_contact: string;
  // ... etc
}

// AFTER - Extend IPTrack or use directly
type IPTrackFormData = IPTrack & {
  // Only add form-specific fields that aren't in IPTrack
};
```

---

## Benefits of These Changes

### ✅ Type Safety
- Catch errors at compile time instead of runtime
- No more `as any` casts masking type issues

### ✅ Better IDE Support
- Autocomplete for all database fields
- Inline documentation for field purposes
- Easier refactoring with "Find all references"

### ✅ Code Quality
- Self-documenting code
- Clearer contracts between components
- Easier onboarding for new developers

### ✅ Fewer Bugs
- TypeScript will warn about:
  - Missing required fields
  - Typos in field names
  - Incorrect value types

---

## Implementation Checklist

- [ ] **Step 1:** Update `types/index.ts` with all new fields
- [ ] **Step 2:** Create new `AlphaUser` interface
- [ ] **Step 3:** Run `npm run build` to check for type errors
- [ ] **Step 4:** Fix any type errors that surface
- [ ] **Step 5:** Remove `as any` casts from all files
- [ ] **Step 6:** Update form type definitions in hooks
- [ ] **Step 7:** Run full test suite
- [ ] **Step 8:** Update component prop types if needed

---

## Diff Preview for types/index.ts

```diff
 export interface IPTrack {
   id: string;
   title: string;
   version?: string;
   artist: string;
   description?: string;
   tell_us_more?: string;
+  notes?: string;
   tags: string[];
   // ... existing fields ...

   // Licensing and permissions
   license_type?: 'remix_only' | 'remix_external' | 'custom';
+  license_selection?: 'platform_remix' | 'platform_download';
   allow_remixing?: boolean;
   open_to_collaboration?: boolean;
+  open_to_commercial?: boolean;
+  commercial_contact?: string;
+  commercial_contact_fee?: number;
+  collab_contact?: string;
+  collab_contact_fee?: number;
   agreed_to_terms?: boolean;

   // ... existing pricing and split fields 1-3 ...

+  // Extended splits for Gen 1 remixes (4-7)
+  composition_split_4_wallet?: string;
+  composition_split_4_percentage?: number;
+  composition_split_5_wallet?: string;
+  composition_split_5_percentage?: number;
+  composition_split_6_wallet?: string;
+  composition_split_6_percentage?: number;
+  composition_split_7_wallet?: string;
+  composition_split_7_percentage?: number;
+
+  production_split_4_wallet?: string;
+  production_split_4_percentage?: number;
+  production_split_5_wallet?: string;
+  production_split_5_percentage?: number;
+  production_split_6_wallet?: string;
+  production_split_6_percentage?: number;
+  production_split_7_wallet?: string;
+  production_split_7_percentage?: number;

   // ... existing fields ...

+  // Payment tracking
+  stacks_tx_id?: string;
+  payment_status?: 'pending' | 'confirmed' | 'failed';
+  payment_checked_at?: string;

   // ... rest of existing fields ...
 }
+
+// Alpha user authentication and profile
+export interface AlphaUser {
+  wallet_address: string;
+  alpha_code: string;
+  artist_name: string;
+  is_active: boolean;
+  approved_at?: string;
+  created_at: string;
+  updated_at: string;
+  notes?: string;
+}
```

---

## Testing Strategy

### 1. Type Check
```bash
npm run build
```
Expected: No type errors

### 2. Runtime Testing
- Upload new track → verify all fields save correctly
- Create Gen 1 remix → verify splits 4-7 populate
- View track details → verify commercial/collab fields display
- Check payment verification → verify payment_status updates

### 3. Regression Testing
- Ensure existing functionality still works
- Check that removing `as any` didn't break anything
- Verify autocomplete works in IDE

---

## Future Considerations

### 1. Separate Concerns
Consider splitting `IPTrack` into smaller interfaces:
```typescript
interface IPTrackBase { /* core fields */ }
interface IPTrackSplits { /* all split fields */ }
interface IPTrackPayment { /* payment tracking */ }
interface IPTrackLicensing { /* licensing options */ }

type IPTrack = IPTrackBase & IPTrackSplits & IPTrackPayment & IPTrackLicensing;
```

### 2. Strict Null Checks
Enable `strictNullChecks` in `tsconfig.json` for better optional field handling.

### 3. Zod Validation
Consider using Zod for runtime validation matching TypeScript types:
```typescript
import { z } from 'zod';

const IPTrackSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string().optional(),
  // ... etc
});
```

---

**End of TypeScript Types Update Documentation**
