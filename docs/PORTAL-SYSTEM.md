# Portal System Documentation

## Overview

Portal Cards are a special content type for "Portal Keepers" - super-curators who manage multiple worlds, projects, or communities within the mixmi ecosystem. Unlike regular content cards that represent playable audio/video, Portal Cards are links to user profiles, visually distinguished by their circular shape and iridescent shimmer effect.

## Visual Design

### Card Appearance
- **Shape:** Circular (160px diameter) vs square for other content types
- **Border:** 6px iridescent/pearlescent shimmer animation
- **Image:** Circular profile image fills the card
- **Globe Node:** White (#FFFFFF) to stand out from content-type colors

### Hover State
- Dark overlay (90% black) with scan line animation
- **Name:** Displayed prominently, clickable link to profile
- **Description:** 2 lines max, not clickable
- Subtle cyan scan line sweeps vertically

### What's NOT Shown
- No play button (not playable content)
- No BPM indicator
- No price tag
- No content type badge
- No flip animation (single-sided card)

## File Structure

```
components/
├── cards/
│   ├── PortalCard.tsx          # Main portal card component
│   └── GlobeTrackCard.tsx      # Routes portal content_type to PortalCard
├── globe/
│   ├── GridNodeSystem.tsx      # Includes portal white color
│   └── types.ts                # TrackNode includes portal_username

app/
├── admin/
│   └── portals/
│       └── page.tsx            # Admin CRUD interface
├── dev/
│   └── portal-preview/
│       └── page.tsx            # Development preview page

lib/
└── globeDataSupabase.ts        # Fetches portal_username field

scripts/
└── migrations/
    └── add-portal-support.sql  # Database migration

types/
└── index.ts                    # IPTrack includes 'portal' content_type
```

## Components

### PortalCard.tsx

The main portal card component with the circular design and shimmer effect.

```typescript
interface Portal {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  profileUrl: string;
  coordinates?: { lat: number; lng: number };
  location?: string;
  content_type: 'portal';
}
```

**Key Features:**
- CSS shimmer animation (6s cycle, 400% background-size)
- Scan line effect on hover (2s linear animation)
- Drag support with `PORTAL_CARD` type (distinct from `COLLECTION_TRACK`)
- Link component wrapping the name for profile navigation

### GlobeTrackCard.tsx

Routes content types to appropriate card components.

```typescript
if (track.content_type === 'portal') {
  return <PortalCard portal={{...}} />;
}
return <CompactTrackCardWithFlip {...props} />;
```

This ensures portal cards render correctly everywhere `GlobeTrackCard` is used:
- Selected node display
- Pinned cards
- Comparison slots
- Cluster views

### GridNodeSystem.tsx

Defines globe node colors by content type.

```typescript
const CONTENT_TYPE_COLORS = {
  loop: '#A084F9',
  full_song: '#A8E66B',
  video_clip: '#5BB5F9',
  radio_station: '#FFC044',
  portal: '#FFFFFF',  // White for portals
  // ...
};
```

## Admin Interface

### Location
`/admin/portals` (access code protected)

### Access Code
Defined in `ADMIN_CODE` constant. Change this for security.

### Features

**Create Portal:**
1. Search for Portal Keeper by name (uses `/api/profile/search-users`)
2. OR manually enter wallet address + username
3. Enter display name (can differ from profile name)
4. Enter 2-line description
5. Upload profile image (generates thumbnails)
6. Select location via Mapbox autocomplete

**Edit Portal:**
1. Click "Edit" on any existing portal
2. Form populates with current data
3. Portal row highlighted in cyan
4. "Cancel Edit" button to abort
5. Save updates existing record

**Delete Portal:**
1. Click "Delete" with confirmation dialog
2. Permanently removes from database

### Preview
Live preview shows portal card as you fill out the form.

## Database Schema

Portals use the `ip_tracks` table with `content_type = 'portal'`.

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Auto-generated |
| content_type | TEXT | Always 'portal' |
| title | TEXT | Display name on card |
| artist | TEXT | Same as title for consistency |
| portal_username | TEXT | Username for `/profile/{username}` link |
| primary_uploader_wallet | TEXT | Portal Keeper's wallet (ownership) |
| location_lat | FLOAT | Latitude for globe placement |
| location_lng | FLOAT | Longitude for globe placement |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| description | TEXT | 2-line description on hover |
| cover_image_url | TEXT | Profile image URL |
| primary_location | TEXT | Human-readable location name |
| thumb_64_url | TEXT | 64px thumbnail |
| thumb_160_url | TEXT | 160px thumbnail |
| thumb_256_url | TEXT | 256px thumbnail |

### SQL Migration

```sql
-- Add portal_username column to ip_tracks
ALTER TABLE ip_tracks
ADD COLUMN IF NOT EXISTS portal_username TEXT;

-- Add 'portal' to content_type constraint
ALTER TABLE ip_tracks DROP CONSTRAINT IF EXISTS ip_tracks_content_type_check;
ALTER TABLE ip_tracks ADD CONSTRAINT ip_tracks_content_type_check
CHECK (content_type IN ('loop', 'full_song', 'loop_pack', 'ep',
       'radio_station', 'station_pack', 'video_clip', 'mix', 'portal'));
```

## TypeScript Types

### IPTrack (types/index.ts)
```typescript
content_type: 'full_song' | 'loop' | 'loop_pack' | 'ep' | 'mix' |
              'radio_station' | 'station_pack' | 'video_clip' | 'portal';

portal_username?: string; // Username for Portal Keeper's profile link
```

### TrackNode (components/globe/types.ts)
```typescript
portal_username?: string;
```

## Data Flow

### Globe Display
1. `fetchGlobeTracksFromSupabase()` fetches all tracks including portals
2. `convertIPTrackToNode()` maps `portal_username` to TrackNode
3. `GridNodeSystem` renders white node for portal content_type
4. User clicks node → `GlobeTrackCard` receives track data
5. `GlobeTrackCard` checks `content_type === 'portal'` → renders `PortalCard`

### Profile Link
1. Portal card hover shows name as clickable link
2. Link URL: `/profile/${portal_username || primary_uploader_wallet}`
3. Prefers username for clean URLs, falls back to wallet

### Admin Creation
1. Admin enters portal data in form
2. On submit, inserts to `ip_tracks` with `content_type: 'portal'`
3. Generates thumbnails if image provided
4. Portal appears on globe at specified location

## CSS Animations

### Shimmer Effect
```css
.portal-border {
  background: linear-gradient(
    135deg,
    #FFFFFF 0%,
    #D4C4F8 14%,    /* Light lavender */
    #FFFFFF 28%,
    #C4D4F8 42%,    /* Light blue */
    #FFFFFF 56%,
    #F8D4E4 70%,    /* Light pink */
    #FFFFFF 84%,
    #D4F8E4 100%    /* Light mint */
  );
  background-size: 400% 400%;
  animation: shimmer 6s ease-in-out infinite;
}
```

### Scan Line Effect
```css
.portal-scanline {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    transparent 45%,
    rgba(129, 228, 242, 0.08) 50%,  /* Cyan tint */
    transparent 55%,
    transparent 100%
  );
  background-size: 100% 200%;
  animation: scanline 2s linear infinite;
}
```

## Future Considerations

### Potential Enhancements
- Portal card in profile header (show Portal Keeper status)
- Portal-specific analytics (profile visits from globe)
- Featured portals rotation
- Portal categories/tags
- Multi-location portals (curator present in multiple cities)

### Not Supported (By Design)
- Portals cannot be dragged to mixer/crate (not playable)
- Portals don't appear in playlists
- No audio preview
- No purchase/download functionality

## Troubleshooting

### Portal shows as regular track card
- Check `content_type` in database is exactly `'portal'`
- Ensure `GlobeTrackCard.tsx` has the portal routing logic
- Hard refresh browser to clear cached JS

### White node but wrong card style
- Verify `portal_username` is being fetched in `globeDataSupabase.ts`
- Check that `GlobeTrackCard` receives `portal_username` in track prop

### Admin page not loading portals
- Check browser console for Supabase errors
- Verify user has read access to `ip_tracks` table
- Ensure `content_type` filter is exactly `'portal'`

### Profile link goes to wrong place
- Check `portal_username` is set correctly
- Verify the username exists in `user_profiles` table
- Falls back to wallet address if username is empty
