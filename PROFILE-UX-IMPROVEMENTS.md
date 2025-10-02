# Profile UX Improvements

## Problem
The user experience for new artists was broken and off-putting:
1. When users upload their first track, they choose an artist name
2. That name goes into `ip_tracks.artist` field
3. But when visiting their profile, it shows "New User" or errors
4. Profile page showed harsh error messages instead of welcoming defaults

## Solution Implemented

### 1. Auto-populate display_name from artist name ✅
**File**: `scripts/update-profile-initialization.sql`

Updated the `initialize_user_profile()` database function to:
- Query the user's first uploaded track to get their artist name
- Use that artist name as the `display_name` in `user_profiles`
- Fall back to "New User" only if no tracks exist

**To deploy**: Run this SQL in Supabase SQL Editor:
```sql
-- See: scripts/update-profile-initialization.sql
```

### 2. Graceful profile page defaults ✅
**File**: `app/profile/[walletAddress]/page.tsx`

Changed the profile page to:
- Remove the harsh "Profile Not Found" error message
- Show a welcoming default profile structure instead
- Display the default daisy-blue sticker
- Show "New User" as display name until they update it
- Feel complete and professional, not broken

Now the flow is:
1. User uploads track with artist name "STARLA" → `ip_tracks.artist = "STARLA"`
2. Profile gets initialized → `user_profiles.display_name = "STARLA"`
3. Profile page shows "STARLA" with default sticker
4. User can customize later if they want

## Benefits

✅ **Seamless UX**: Artist name flows naturally from upload → store → profile
✅ **Professional feel**: No error messages, everything looks intentional
✅ **Consistent identity**: Same name shows on tracks, store, and profile
✅ **User control**: They can still customize display_name later

## Files Modified

1. `scripts/update-profile-initialization.sql` - New SQL function (needs manual deployment)
2. `app/profile/[walletAddress]/page.tsx` - Graceful defaults instead of errors

## Next Steps

1. Run the SQL migration in Supabase to update `initialize_user_profile()`
2. Test the flow: upload track → visit store → visit profile
3. Verify artist name appears consistently everywhere
