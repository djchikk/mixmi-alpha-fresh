# Database Cleanup Plan - October 2025
**Date:** October 30, 2025
**Status:** Active - Ready for Execution
**Scope:** Schema audit, unused column removal, table cleanup

---

## Executive Summary

**Problem:**
- Schema bloat: duplicate/unused columns in main tables
- Random placeholder tables from early development
- Need fresh audit based on current October 2025 state

**Scope:**
- **Primary Tables:** `alpha_users`, `ip_tracks`, `user_profiles`
- **Secondary Concern:** Orphaned/placeholder tables
- **Out of Scope:** Test data deletion (manual cleanup by Sandy)

**Approach:**
1. Export current schema
2. Systematic column audit (code references)
3. Safe migration with backups
4. Documentation of changes

**Timeline:** 1-2 days (can run parallel to documentation updates)

---

## Phase 1: Schema Export (15 minutes)

### Option A: Supabase Dashboard (Easiest)

**Steps:**
1. Log into Supabase dashboard
2. Navigate to Database → Schema Visualizer
3. Click "SQL Editor" tab
4. Run this query to get table structures:

```sql
-- Get all table definitions
SELECT
    table_schema,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('alpha_users', 'ip_tracks', 'user_profiles')
ORDER BY table_name, ordinal_position;
```

5. Export as CSV or copy results

**For ALL tables in database:**
```sql
-- Get complete table list
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Option B: Using Supabase CLI (More Complete)

**Install Supabase CLI (if not already):**
```bash
npm install -g supabase
```

**Generate Schema Dump:**
```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Dump schema to file
supabase db dump --file schema-dump-oct-2025.sql
```

This creates a complete SQL dump with:
- All table definitions
- All constraints
- All indexes
- All RLS policies

### What to Send Me

**Minimum (for column audit):**
- List of all columns in `alpha_users`, `ip_tracks`, `user_profiles`
- Data types for each column

**Ideal (for complete audit):**
- Full schema dump (schema-dump-oct-2025.sql)
- List of all tables in database

**I'll analyze:**
- Which columns are actually used in codebase
- Which tables are referenced anywhere
- What's safe to remove

---

## Phase 2: Column Usage Audit Framework

Once you provide the schema, I'll check each column against these criteria:

### Audit Checklist (What I'll Search For)

For each column in `ip_tracks`, `user_profiles`, `alpha_users`:

**1. Frontend Usage:**
```bash
# Search entire codebase for column name
grep -r "column_name" app/
grep -r "column_name" components/
grep -r "column_name" lib/
```

**2. API Usage:**
```bash
# Check API routes
grep -r "column_name" app/api/
```

**3. Database Queries:**
```bash
# Look for Supabase queries
grep -r ".select.*column_name" .
grep -r ".insert.*column_name" .
grep -r ".update.*column_name" .
```

**4. TypeScript Types:**
```bash
# Check type definitions
grep -r "column_name" types/
```

**5. Documentation References:**
```bash
# Check if documented as active feature
grep -r "column_name" docs/
```

### Classification System

**🟢 KEEP - Active Column**
- Found in 3+ code locations
- Part of active feature
- Has current documentation
- In TypeScript types

**🟡 REVIEW - Uncertain Column**
- Found in 1-2 locations
- Might be legacy or future feature
- Needs manual decision

**🔴 REMOVE - Unused Column**
- Zero code references
- Not in TypeScript types
- No documentation
- Likely leftover from old feature

**⚠️ DEPRECATED - Old Column with New Replacement**
- Has newer equivalent column
- Example: `cover_art` (old) vs `cover_image_url` (new)
- Safe to remove after data migration

---

## Phase 3: Known Column Issues (Predictions)

Based on my knowledge of the codebase, I predict these issues:

### `ip_tracks` Table - Likely Issues

**Duplicate Naming Patterns:**
```
❓ cover_art vs cover_image_url
❓ price vs price_stx vs remix_price_stx vs download_price_stx
❓ location vs locations vs primary_location vs location_lat/lng
❓ creator vs created_by vs primary_uploader_wallet
```

**Old Attribution Fields:**
```
❓ old_attribution_* (before composition/production split)
❓ collaborators (before split_1/2/3 system)
```

**Feature Flags That Might Be Unused:**
```
❓ is_public / visibility
❓ featured / highlighted
❓ verified / approved
```

### `user_profiles` Table - Likely Issues

**Profile vs Config Duplication:**
```
❓ avatar vs avatar_url
❓ bio vs description
❓ profile_data vs profile_config (JSONB)
❓ settings vs preferences
```

**Old Social Fields:**
```
❓ twitter_handle vs social_links (JSONB)
❓ website vs links
```

### `alpha_users` Table - Likely Simple

This table probably has minimal bloat since it's newer. Expected columns:
- wallet_address (keep)
- invite_code (keep)
- approved (keep)
- created_at (keep)
- email, discord_handle, etc. (review based on usage)

---

## Phase 4: Table Cleanup Strategy

### Identifying Orphaned Tables

**I'll check for tables that:**
1. Don't appear in any TypeScript types
2. Have zero references in app/components/lib
3. Have no foreign key relationships
4. Aren't mentioned in documentation

**Common Orphan Candidates:**
```
- test_* tables
- temp_* tables
- old_* tables
- *_backup tables (from previous migrations)
- Feature tables that never launched (playlists_old, etc.)
```

**Safe Removal Criteria:**
- Zero code references
- No foreign keys pointing TO this table
- No RLS policies (or only basic ones)
- Last updated >6 months ago (check created_at)

---

## Phase 5: Safe Migration Plan

### Step 1: Backup Everything (CRITICAL)

**Before any changes:**
```sql
-- Backup main tables
CREATE TABLE ip_tracks_backup_oct2025 AS SELECT * FROM ip_tracks;
CREATE TABLE user_profiles_backup_oct2025 AS SELECT * FROM user_profiles;
CREATE TABLE alpha_users_backup_oct2025 AS SELECT * FROM alpha_users;
```

**Export data to files (extra safety):**
```bash
# Using Supabase CLI
supabase db dump --data-only --file data-backup-oct-2025.sql
```

### Step 2: Column Removal (Conservative)

**Start with 100% Certain Removals:**
```sql
-- Example: Remove column with ZERO references
ALTER TABLE ip_tracks DROP COLUMN old_unused_field;
```

**Test After Each Removal:**
1. Run app locally
2. Test upload flow
3. Test profile editing
4. Test mixer loading
5. Check for console errors

**Rollback if Issues:**
```sql
-- If something breaks, restore from backup
DROP TABLE ip_tracks;
ALTER TABLE ip_tracks_backup_oct2025 RENAME TO ip_tracks;
```

### Step 3: Data Migration (If Needed)

**If consolidating columns:**
```sql
-- Example: Migrate cover_art → cover_image_url
UPDATE ip_tracks
SET cover_image_url = cover_art
WHERE cover_image_url IS NULL
  AND cover_art IS NOT NULL;

-- Verify migration
SELECT COUNT(*) FROM ip_tracks
WHERE cover_art IS NOT NULL
  AND cover_image_url IS NULL;
-- Should be 0

-- Then safe to drop old column
ALTER TABLE ip_tracks DROP COLUMN cover_art;
```

### Step 4: Table Removal (Orphans)

**For completely unused tables:**
```sql
-- Check foreign key dependencies first
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'potentially_orphaned_table';

-- If empty result, safe to drop
DROP TABLE orphaned_table_name;
```

---

## Phase 6: Post-Cleanup Verification

### Automated Checks

**1. TypeScript Compilation:**
```bash
npm run build
# Should compile with no errors
```

**2. Critical Paths Test:**
```bash
# Manual testing checklist
- [ ] Upload new loop
- [ ] Upload new song
- [ ] Edit track metadata
- [ ] Create/edit user profile
- [ ] Purchase track (test flow)
- [ ] Load track to mixer
- [ ] Create remix
- [ ] View certificate
```

**3. Database Integrity:**
```sql
-- Check for NULL values in required fields
SELECT COUNT(*)
FROM ip_tracks
WHERE title IS NULL
   OR artist IS NULL
   OR primary_uploader_wallet IS NULL;
-- Should be 0

-- Check foreign key integrity
SELECT COUNT(*)
FROM ip_tracks
WHERE created_by NOT IN (SELECT wallet_address FROM user_profiles);
-- Check if expected (orphaned records)
```

---

## Phase 7: Documentation Updates

After cleanup, update:

**1. TypeScript Types (`types/index.ts`):**
```typescript
// Remove unused fields from interfaces
interface IPTrack {
  // Remove: old_field
  // Keep: current_field
}
```

**2. Database Schema Docs:**
- Update `docs/DATABASE-SCHEMA.md` (or create if missing)
- Document final column list
- Add migration history

**3. CLAUDE.md:**
- Update "Database Architecture" section
- Document what was removed and why

**4. Add Migration Record:**
- Create `docs/migrations/2025-10-30-schema-cleanup.md`
- Document all changes made
- Include rollback procedures

---

## Decision Framework for Manual Review

When a column status is 🟡 REVIEW (uncertain), ask these questions:

### Question 1: Is This Feature Active?
```
YES → Keep column
NO → Continue to Question 2
```

### Question 2: Was This Feature Partially Implemented?
```
YES → Is it planned for Q1 2026?
  YES → Keep (mark with comment "// Future feature")
  NO → Remove
NO → Continue to Question 3
```

### Question 3: Does Removing This Break Existing Data?
```
YES → Need data migration first
NO → Safe to remove
```

### Question 4: Is There a Newer Equivalent Column?
```
YES → Migrate data, then remove
NO → If truly unused, remove
```

---

## Example Audit Output (What I'll Provide)

Once you send me the schema, I'll provide a report like this:

```markdown
## ip_tracks Column Audit Results

### 🟢 KEEP (45 columns)
- id (primary key)
- title (used in 23 files)
- artist (used in 19 files)
- audio_url (critical - audio playback)
- cover_image_url (used in cards, modals)
- ... [list continues]

### 🟡 REVIEW (8 columns)
- old_price (found in 1 file, might be legacy)
  - Location: lib/oldPaymentSystem.ts (archived?)
  - Recommendation: Check if lib/oldPaymentSystem.ts is still used

- featured (found in database schema but no code refs)
  - Recommendation: Future feature or abandoned? Your call

### 🔴 REMOVE (12 columns)
- temp_upload_id (zero references)
- old_cover_art (replaced by cover_image_url)
- legacy_attribution_field (replaced by split_1/2/3 system)
- ... [list continues]

### ⚠️ DEPRECATED (5 columns - need migration)
- cover_art → cover_image_url
  - Migration: Copy data to new column
  - Affected rows: 23 tracks
  - Safe to remove after migration
```

---

## Cleanup Priorities

### Priority 1: Safe & Certain (Do First)
- Remove columns with ZERO code references
- Remove orphaned tables
- Update TypeScript types

**Risk:** Low
**Benefit:** Immediate cleanup
**Time:** 1-2 hours

### Priority 2: Data Migrations (Do Second)
- Consolidate duplicate columns
- Migrate to new naming conventions
- Preserve all existing data

**Risk:** Medium (test thoroughly)
**Benefit:** Long-term schema consistency
**Time:** 2-3 hours

### Priority 3: Feature Cleanup (Do Last)
- Remove partially-implemented features
- Decide on future feature columns
- Archive old feature tables

**Risk:** Medium (might remove something useful)
**Benefit:** Cleaner future development
**Time:** 1-2 hours

---

## What I Need From You

### Immediate (15 minutes of your time)

**Send me one of these:**

**Option A (Quick):**
```bash
# Run in Supabase SQL Editor, copy/paste results
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('alpha_users', 'ip_tracks', 'user_profiles')
ORDER BY table_name, ordinal_position;
```

**Option B (Complete):**
```bash
# Full schema dump
supabase db dump --file schema-dump-oct-2025.sql
# Then send me the file
```

**Option C (Table List):**
```sql
-- Just the table names (to identify orphans)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Follow-Up (After I Analyze)

I'll provide you with:
1. Column audit report (KEEP/REVIEW/REMOVE)
2. Orphaned table list
3. Migration SQL scripts (if needed)
4. Testing checklist

You'll make final decisions on 🟡 REVIEW items, then we execute the cleanup.

---

## Timeline Estimate

**If we start now:**

**Day 1 (Today):**
- You: Export schema (15 min)
- Me: Analyze schema, provide audit report (1 hour)
- You: Review recommendations, make decisions (30 min)

**Day 2 (Tomorrow):**
- Me: Write migration scripts (1 hour)
- You: Backup database, run migrations (30 min)
- Both: Test critical paths (1 hour)
- Me: Update documentation (30 min)

**Total Time:** ~5 hours spread over 2 days
**Your Time:** ~1.5 hours
**Can Run Parallel:** Yes! Documentation updates can happen simultaneously

---

## Success Criteria

**Cleanup is successful when:**
- ✅ No duplicate/confusing column names
- ✅ All columns have clear purpose
- ✅ TypeScript types match database schema
- ✅ Zero unused tables in database
- ✅ All tests pass
- ✅ No console errors in app
- ✅ Database schema documented

---

## Rollback Plan (If Something Goes Wrong)

**Worst case scenario:**
```sql
-- Restore from backups
DROP TABLE ip_tracks;
DROP TABLE user_profiles;
DROP TABLE alpha_users;

ALTER TABLE ip_tracks_backup_oct2025 RENAME TO ip_tracks;
ALTER TABLE user_profiles_backup_oct2025 RENAME TO user_profiles;
ALTER TABLE alpha_users_backup_oct2025 RENAME TO alpha_users;

-- Restore RLS policies (from schema-dump-oct-2025.sql)
-- Restore indexes (from schema-dump-oct-2025.sql)
```

**Recovery time:** <5 minutes

---

## Post-Cleanup Benefits

**For Development:**
- ✅ Clearer schema = faster feature development
- ✅ No confusion about which columns to use
- ✅ TypeScript autocomplete more accurate
- ✅ Easier onboarding for new features (radio, video)

**For Performance:**
- ✅ Smaller row sizes = faster queries
- ✅ Fewer indexes to maintain
- ✅ Cleaner database backups

**For Future:**
- ✅ Clean foundation for radio_stations table
- ✅ Clean foundation for videos table
- ✅ Clear patterns for new features

---

## Next Steps

**Ready to start?**

1. Export your schema using any of the options above
2. Send me the results (paste here or share file)
3. I'll analyze and provide detailed audit report
4. We'll execute cleanup together

**Questions before we start?**
- Anything specific you know is broken?
- Any columns you're particularly worried about?
- Any tables you know are important (even if orphaned)?

Let me know when you have the schema export ready!

---

**Document Status:** Ready for Execution
**Blocking:** Waiting for schema export from Sandy
**Next Action:** Sandy exports schema → I analyze → We execute cleanup
