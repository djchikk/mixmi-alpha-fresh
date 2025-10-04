# Track Deletion Issue

## Current Problem
When deleting a track from the creator store, it only removes it from the UI temporarily. The track reappears on next visit because it's not being deleted from the database.

## Complexity
Proper track deletion needs to consider:
1. **Purchased tracks** - Users who bought it should still have access
2. **Remixed tracks** - If this track was used as a source for remixes
3. **Payment history** - Transaction records must be preserved
4. **Certificates** - Already generated certificates reference the track

## Proposed Solution
Instead of hard delete, implement soft delete:
- Add `is_deleted` or `deleted_at` column to ip_tracks
- Hide deleted tracks from creator's store
- Keep track available for:
  - Users who purchased it
  - Remix chain integrity
  - Historical records

## Implementation Steps (FUTURE)
1. Add soft delete column to database
2. Update store queries to filter out deleted tracks
3. Add confirmation dialog with clear warning
4. Update delete handler to soft delete
5. Consider "archived" section for creator to see their deleted tracks

## Warning Message
"Are you sure you want to remove this track from your store? 
- It will no longer be available for new purchases
- Users who already purchased it will retain access
- This action cannot be undone"