# Handoff Document - October 1, 2025

## Session Summary
Working on **feature/user-profiles** branch to implement user profile and creator store infrastructure with complete linking system between profiles, stores, and content.

---

## Today's Accomplishments (October 1, 2025)

### 1. Store Card Integration & Toggle System
**Status**: ✅ Complete
- Integrated Store Card into Shop section with toggle functionality
- Store card shows track count and creator info dynamically
- Supports custom title, description, and image from profile config
- Navigate to store using username or wallet address as fallback
- Toggle button allows showing/hiding store card in profile Shop section
- Edit controls properly integrated with section management

**Files Modified**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/cards/StoreCard.tsx`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/sections/ShopSection.tsx`

### 2. Username-Based URLs for Stores
**Status**: ✅ Complete
- Store URLs now support `/store/username` format (e.g., `/store/johndoe`)
- Automatic fallback to wallet address if username not set (e.g., `/store/SP123...`)
- Resolution logic checks if parameter is username (no SP/ST prefix) or wallet address
- Seamless navigation from store card using username when available

**Files Modified**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/app/store/[walletAddress]/page.tsx`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/cards/StoreCard.tsx`

### 3. Profile Avatar Display on Store Pages
**Status**: ✅ Complete
- Store page now displays creator's profile avatar from `avatar_url` column
- Fixed column reference from incorrect `profile_config` lookup to direct `avatar_url` field
- Query pattern: `SELECT display_name, username, avatar_url FROM user_profiles WHERE wallet_address = ?`
- Creator name resolution: display_name → username → wallet address (in priority order)
- Avatar displays in header area of creator store page

**Files Modified**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/app/store/[walletAddress]/page.tsx` (commit 7fd7ea1)

### 4. Section Limits Enforcement
**Status**: ✅ Complete
- All profile sections enforce 3-item maximum (Spotlight, Shop, Gallery, Media)
- Smart GIF quota management across sections
- Clear UI feedback when limits reached
- Add buttons disabled when at capacity
- User-friendly limit descriptions in modals

**Files Modified**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/lib/sectionLimits.ts`
- All section components (Gallery, Media, Shop, Spotlight)

### 5. GIF Support for Spotlight Section
**Status**: ✅ Complete
- Spotlight section now supports GIF uploads
- Updated limits: `maxGifs: 3` (was 0)
- Users can upload GIFs for creative spotlight content
- 500KB max size for spotlight GIFs
- Maintained 3-item total limit

**Files Modified**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/lib/sectionLimits.ts` (line 24)

### 6. BNS Name System Temporarily Disabled
**Status**: ⚠️ Temporarily Disabled
- Hiro API endpoints returning 404 errors as of September 2025
- Current implementation validates BNS format but does NOT verify on-chain ownership
- Security risk that must be fixed before production
- Username system working as alternative identifier

**Documentation**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/docs/BNS_API_UPDATE_NEEDED.md`

### 7. Custom Sticker Uploads Fixed
**Status**: ✅ Complete
- Fixed `custom_sticker` field inclusion in profile queries
- Sticker uploads and display working correctly
- Database column properly queried and populated
- Max 400KB GIF size for animated stickers

**Files Modified**:
- Profile query services to include `custom_sticker` field

### 8. Image Compression System Review
**Status**: ✅ Verified Working
- Image compression pipeline using `lib/imageOptimization.ts`
- GIF quota manager prevents excessive storage usage
- Separate size limits per section (profile: 400KB, spotlight: 500KB, gallery: 600KB)
- TrackCoverUploader system for music-specific uploads
- All images stored as clean Supabase Storage URLs (no base64)

---

## Tomorrow's Planned Tasks (October 2, 2025)

### Priority 1: Add Linking from Globe Cards
**Goal**: Make track cards on globe page link to stores and profiles

**Implementation**:
- In `CompactTrackCardWithFlip.tsx`:
  - Track title → link to creator's store (`/store/username` or `/store/wallet`)
  - Artist name → link to creator's profile (`/profile/username` or `/profile/wallet`)
  - Check if profile exists before enabling artist name link
  - Use cursor pointer and hover effects for clickable elements
  - Add navigation using Next.js router

**Files to Modify**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/cards/CompactTrackCardWithFlip.tsx`

**Technical Notes**:
- Stores are always available (auto-created for all users)
- Profiles are optional - must check existence before linking
- Need to query `user_profiles` table for username/existence
- Store track's `created_by` wallet address for lookups

---

### Priority 2: Add Track/Artist Names to Track Details Modal
**Goal**: Display track and artist information with clickable links in modal

**Implementation**:
- In `TrackDetailsModal.tsx`:
  - Add track title and artist name display
  - Track title → link to creator store
  - Artist name → link to creator profile (if exists)
  - Style links with hover effects (subtle accent color)
  - Maintain existing modal functionality

**Files to Modify**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/modals/TrackDetailsModal.tsx`

---

### Priority 3: Add Links from Mixer Deck Text
**Goal**: Make deck display text link to stores/profiles

**Implementation**:
- In mixer deck components:
  - Track name in deck → link to store
  - Artist name in deck → link to profile (if exists)
  - Ensure links don't interfere with drag/drop functionality
  - Prevent navigation during mixing (require click on static text)

**Files to Modify**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/mixer/SimplifiedDeck.tsx`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/mixer/compact/SimplifiedDeckCompact.tsx`

---

### Priority 4: Add "My Profile | My Store" to Header
**Goal**: Authenticated users can quickly navigate to their own profile/store

**Implementation**:
- In `Header.tsx`:
  - When authenticated, show "My Profile | My Store" next to wallet/disconnect
  - Use subtle accent color for these links (not dominant)
  - "My Profile" → `/profile/username` or `/profile/wallet`
  - "My Store" → `/store/username` or `/store/wallet`
  - Mobile responsive design
  - Only show when user is connected

**Files to Modify**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/layout/Header.tsx`

**Design Notes**:
- Use subtle accent color (matches design philosophy)
- Small, non-intrusive text
- Maintain clean header design
- Consider pipe separator: "My Profile | My Store"

---

### Priority 5: Add Profile Link from Creator Store Header
**Goal**: Easy navigation from store back to profile

**Implementation**:
- In store page header:
  - Add link/button to view creator's profile
  - Check if profile exists before showing link
  - Use avatar as clickable element (if available)
  - Or add small "View Profile" text link near creator name

**Files to Modify**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/app/store/[walletAddress]/page.tsx`

---

### Priority 6: Profile Existence Checking
**Goal**: Ensure all links check if profile exists before enabling

**Implementation**:
- Create helper function: `checkProfileExists(wallet_address): Promise<boolean>`
- Cache results to avoid repeated queries
- Disable/hide profile links when profile doesn't exist
- Store links always enabled (all users have stores)

**New Utility File**:
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/lib/profileHelpers.ts`

**Usage Pattern**:
```typescript
const profileExists = await checkProfileExists(walletAddress);
if (profileExists) {
  // Show profile link
} else {
  // Hide or disable profile link
}
```

---

## Technical Context

### Current Branch Status
- **Branch**: feature/user-profiles
- **Last Commit**: "fix: Use avatar_url from user_profiles table for store page" (7fd7ea1)
- **Status**: All today's features working and tested
- **Pushed**: Yes, changes pushed to GitHub

### Database Schema
**user_profiles table key columns**:
- `wallet_address` (text, primary key) - SP/ST mainnet address
- `username` (text, unique, nullable) - Optional user-chosen username
- `display_name` (text, nullable) - Optional display name
- `avatar_url` (text, nullable) - Direct URL to profile image
- `bio` (text, nullable)
- `profile_config` (jsonb) - Stores section configurations
- `custom_sticker` (text, nullable) - Custom sticker image data

**Important Notes**:
- Profile images stored in `avatar_url` column (NOT in profile_config)
- Username used for URLs when available, wallet address as fallback
- All users automatically have stores (always linkable)
- Profiles are optional - must check existence

### URL Patterns
**Stores** (always available):
- `/store/username` - If user has username set
- `/store/SP123...` - Fallback to wallet address

**Profiles** (optional - check existence):
- `/profile/username` - If user has username set
- `/profile/SP123...` - Fallback to wallet address

### Resolution Logic Pattern
```typescript
// Check if parameter is username or wallet
if (paramValue.startsWith('SP') || paramValue.startsWith('ST')) {
  // It's a wallet address
  walletAddress = paramValue;
} else {
  // It's a username - look up wallet address
  const { data } = await supabase
    .from('user_profiles')
    .select('wallet_address')
    .eq('username', paramValue)
    .single();
  walletAddress = data?.wallet_address;
}
```

### Key Components
- `CompactTrackCardWithFlip` - Track cards used on globe, store, crate
- `StoreCard` - Creator store card in Shop section
- `TrackDetailsModal` - Full track information modal
- `Header` - Main navigation header
- `SafeImage` - Image component with fallbacks

### State Management
- `AuthContext` - Wallet authentication state
- `ToastContext` - User notifications
- Profile data fetched directly from Supabase (no global context)

---

## Current System State

### Working Features
✅ User profile pages with avatar, bio, sticker
✅ Profile sections (Spotlight, Shop, Gallery, Media)
✅ Section limits enforcement (3 items max)
✅ GIF support in appropriate sections
✅ Store Card integration with toggle
✅ Username-based URLs for stores
✅ Avatar display on store pages
✅ Custom sticker uploads
✅ Image compression system

### Known Issues
⚠️ BNS verification temporarily disabled (API issues)
⚠️ Profile linking not yet implemented from cards/modals
⚠️ No "My Profile | My Store" in header yet

### Performance Notes
- Globe loading: 17ms (optimized September 2025)
- Images stored as clean Supabase URLs (no base64 corruption)
- Section queries optimized with proper column selection
- Avatar images load efficiently from storage

---

## Code Patterns to Follow

### Fetching Profile Data
```typescript
const { data: profileData, error } = await supabase
  .from('user_profiles')
  .select('display_name, username, avatar_url, bio')
  .eq('wallet_address', walletAddress)
  .single();

if (!error && profileData) {
  // Use profileData
}
```

### Username Resolution for URLs
```typescript
// Generate store URL
const storeUrl = username ? `/store/${username}` : `/store/${walletAddress}`;

// Generate profile URL (check existence first!)
const profileUrl = username ? `/profile/${username}` : `/profile/${walletAddress}`;
```

### Link Styling (Subtle Accent)
```typescript
className="text-gray-300 hover:text-accent transition-colors cursor-pointer"
```

### Navigation with Next.js Router
```typescript
import { useRouter } from 'next/navigation';
const router = useRouter();

// Navigate
router.push(`/store/${username || walletAddress}`);
```

---

## Testing Checklist for Tomorrow

### Linking Features
- [ ] Click track title on globe card → navigates to store
- [ ] Click artist name on globe card → navigates to profile (if exists)
- [ ] Artist name not clickable if profile doesn't exist
- [ ] Links work with both username and wallet address formats
- [ ] Track Details Modal shows clickable track/artist names
- [ ] Mixer deck text links to store/profile
- [ ] Links don't interfere with existing functionality (drag/drop, etc.)

### Header Navigation
- [ ] "My Profile | My Store" appears when authenticated
- [ ] Links use subtle accent color
- [ ] Clicking navigates to correct URLs (username or wallet)
- [ ] Mobile responsive design works
- [ ] Links disappear when disconnected

### Profile Linking from Store
- [ ] Avatar or text link on store page navigates to profile
- [ ] Link only appears if profile exists
- [ ] Works with username and wallet URLs

### General
- [ ] All links use correct URL format (username first, wallet fallback)
- [ ] Profile existence checking works correctly
- [ ] No console errors
- [ ] Smooth navigation experience

---

## Environment & Deployment

### Branch Info
- **Current Branch**: feature/user-profiles
- **Base Branch**: main
- **Status**: Development, not yet merged to main

### Local Development
```bash
npm run dev  # Runs on port 3010
```

### Environment Variables Required
```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=
```

### Database Tables Used
- `user_profiles` - User profile data and configuration
- `ip_tracks` - Track content for stores
- `user_profile_sections` - Section configurations

---

## Important Files Reference

### Components
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/cards/CompactTrackCardWithFlip.tsx`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/cards/StoreCard.tsx`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/modals/TrackDetailsModal.tsx`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/layout/Header.tsx`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/components/mixer/SimplifiedDeck.tsx`

### Pages
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/app/store/[walletAddress]/page.tsx`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/app/profile/[walletAddress]/page.tsx`

### Libraries
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/lib/sectionLimits.ts`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/lib/supabase-profile.ts`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/lib/userProfileService.ts`

### Documentation
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/docs/BNS_API_UPDATE_NEEDED.md`
- `/Users/sandyhoover/Desktop/mixmi-alpha-fresh-6/docs/CLAUDE.md`

---

## Next Session Quick Start

### 1. Verify Current State
```bash
git status
git log --oneline -5
npm run dev
```

### 2. Start with Priority 1
Begin with adding links from `CompactTrackCardWithFlip.tsx`:
- Track title → store link
- Artist name → profile link (check existence first)

### 3. Test Each Feature
Test linking functionality thoroughly before moving to next priority.

### 4. Commit Pattern
Use descriptive commits for each feature:
```bash
git add .
git commit -m "feat: Add store/profile links to track cards"
git push origin feature/user-profiles
```

---

## Questions to Consider

### Design Questions
1. Should profile links show a tooltip "View Profile" on hover?
2. How to visually indicate when an artist name is NOT clickable (no profile)?
3. Should mixer deck links open in new tab or same tab?
4. Where exactly should "My Profile | My Store" appear in header?

### Technical Questions
1. Should we cache profile existence checks for performance?
2. How to handle username changes (URL stability)?
3. Should links be disabled during drag operations?
4. Need loading states for link navigation?

---

## Success Criteria

Tomorrow's work will be considered complete when:

✅ All track cards on globe link to stores/profiles
✅ Track Details Modal shows clickable track/artist info
✅ Mixer deck displays have working links
✅ Header shows "My Profile | My Store" when authenticated
✅ Store pages link back to profiles
✅ Profile existence checking works reliably
✅ All navigation works with both username and wallet URLs
✅ No broken links or console errors
✅ Smooth, intuitive user experience

---

## Final Notes

The user profiles infrastructure is solid and working well. Today focused on the foundational pieces (Store Card, URLs, avatars, limits). Tomorrow is all about connecting the ecosystem with intelligent linking between profiles, stores, and content.

The architecture supports both username and wallet-based URLs seamlessly, with automatic fallbacks. Profile existence checking will be key to avoiding broken links.

All changes are pushed to `feature/user-profiles` branch and ready for continued development.

**Estimated Time for Tomorrow's Tasks**: 3-4 hours for complete linking system implementation and testing.

---

**Document Created**: October 1, 2025
**Branch**: feature/user-profiles
**Last Commit**: 7fd7ea1
**Next Session**: October 2, 2025
