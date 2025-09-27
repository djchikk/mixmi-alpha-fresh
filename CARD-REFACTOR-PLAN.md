# Card Component Consolidation Plan

## Current State Analysis

### Active Card Components (in production use)

1. **CompactTrackCardWithFlip.tsx** ✅ **PRIMARY WORKING CARD**
   - Used by: Globe view (via GlobeTrackCard wrapper), Search results
   - Features: Flip animation, price display, cart integration
   - Data handling: ✅ Correctly passes `price_stx`
   - Status: **This is the newest, best implementation**

2. **GlobeTrackCard.tsx** (Wrapper)
   - Simple wrapper that renders `CompactTrackCardWithFlip`
   - Used by: `app/page.tsx` (globe view)
   - Status: Can likely be eliminated

3. **TrackCard.tsx**
   - Used by: `components/shared/Crate.tsx`
   - Features: Full-size card with detailed info
   - Data handling: ❌ Used in crate context, might lose data during drag
   - Status: **Needs audit - is this still used?**

4. **OptimizedTrackCard.tsx**
   - Used by: `components/globe/TrackNodeModal.tsx`
   - Features: Lazy loading optimization wrapper
   - Status: Check if this wraps CompactTrackCardWithFlip or is separate

5. **GlobeSearch.tsx** (Inline rendering)
   - Custom inline card rendering
   - Data handling: ✅ Correctly passes `price_stx` (line 235)
   - Status: Works correctly, but duplicates card logic

### Legacy/Unused Components (probably not in use)

- CompactTrackCard.backup.tsx
- CompactTrackCardWithFlip.backup2.tsx
- GalleryCard.tsx
- MediaCard.tsx
- OptimizedCompactCard.tsx
- ShopCard.tsx
- SpotlightCard.tsx
- StoreCard.tsx

## Data Flow Issues

### ✅ Working Paths (price_stx preserved)
1. Globe → Cart: Uses `CompactTrackCardWithFlip` → `price_stx` passed correctly
2. Search → Cart: Inline rendering → `price_stx` passed correctly (line 235)

### ❌ Broken Paths (price_stx lost)
1. Crate drag operations: Data transformation loses `price_stx`
2. Unknown: Other cart entry points not tested

### 🔧 Fixed but Watch
1. Mixer context conversions: Now preserves `price_stx` after fix

## Consolidation Strategy

### Phase 1: Audit & Map (1-2 hours)
**Goal:** Understand what's actually being used

Tasks:
- [ ] Check if TrackCard is still rendered anywhere
- [ ] Verify OptimizedTrackCard wrapping behavior
- [ ] Test all cart entry points (globe, search, crate drag, crate buttons)
- [ ] Document which components are truly legacy

### Phase 2: Standardize Data Flow (2-3 hours)
**Goal:** Ensure all paths preserve `price_stx` and other metadata

Tasks:
- [ ] Create shared TypeScript interface for card data
- [ ] Audit all drag/drop handlers for data loss
- [ ] Fix Crate drag operations
- [ ] Add console warnings when price_stx is missing
- [ ] Test all cart flows end-to-end

### Phase 3: Component Consolidation (3-4 hours)
**Goal:** Reduce to 1-2 core card components

Proposed Architecture:
```
BaseTrackCard (shared logic, data handling)
├─ CompactCard (small grid display)
│  └─ with/without flip variant
└─ DetailCard (modal/large display)
   └─ OptimizedWrapper (lazy loading)
```

Tasks:
- [ ] Extract shared logic into BaseTrackCard
- [ ] Refactor CompactTrackCardWithFlip to use BaseTrackCard
- [ ] Remove GlobeTrackCard wrapper (not needed)
- [ ] Consolidate search inline rendering to use CompactCard
- [ ] Update Crate to use standardized cards
- [ ] Remove unused legacy components

### Phase 4: Testing & Cleanup (2 hours)
Tasks:
- [ ] Test all user flows (globe, search, crate, mixer)
- [ ] Verify drag & drop works everywhere
- [ ] Check price_stx in cart from all sources
- [ ] Visual regression testing
- [ ] Remove unused files
- [ ] Update imports

## Estimated Total: 8-11 hours

## Risks & Mitigation

**Risk:** Breaking existing drag & drop behavior
- Mitigation: Incremental changes, test after each component

**Risk:** Visual regressions
- Mitigation: Take screenshots before changes, compare after

**Risk:** Data loss in conversions
- Mitigation: Add TypeScript strict typing, console warnings

**Risk:** Unknown dependencies
- Mitigation: Search codebase for all imports before deleting

## Success Criteria

✅ Only 2-3 card components remain (Base + variants)
✅ All cart paths show correct price
✅ Drag & drop preserves all metadata
✅ No visual regressions
✅ Code is DRY and maintainable
✅ TypeScript types are strict and shared

## Recommended Approach

1. **Do this on `feature/card-consolidation` branch**
2. **Start with Phase 1 audit** - understanding before changing
3. **Make incremental commits** - one component at a time
4. **Test frequently** - don't accumulate untested changes
5. **Get user feedback** - after Phase 2 (data flow fixes) and Phase 3 (consolidation)

---

## Quick Wins (Can do immediately)

If you want to start small before the full refactor:

1. **Delete obvious legacy files** (backups, unused components)
2. **Add TypeScript warning** when price_stx is undefined
3. **Document current usage** in comments at top of each card file
4. **Fix Crate drag specifically** without touching other cards

These can be done on current branch before starting the bigger refactor.