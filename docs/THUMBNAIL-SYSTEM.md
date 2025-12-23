# Thumbnail System Documentation

This document describes the pre-generated thumbnail system implemented to reduce Supabase image transformation quota usage.

## Overview

Instead of using Supabase's on-the-fly image transformations (which count against quota), we now generate and store pre-sized thumbnails at upload time. This significantly reduces transformation quota usage.

## Thumbnail Sizes

### Track Thumbnails (ip_tracks table)
| Column | Size | Usage |
|--------|------|-------|
| `thumb_64_url` | 64x64px | Small displays, lists |
| `thumb_160_url` | 160x160px | Medium displays, grid cards |
| `thumb_256_url` | 256x256px | Large displays, detail views |

### Profile Thumbnails (user_profiles table)
| Column | Size | Usage |
|--------|------|-------|
| `avatar_thumb_48_url` | 48x48px | Header avatar (36-48px displays) |
| `avatar_thumb_96_url` | 96x96px | Store page, Dashboard (56px displays) |

## Storage Buckets

Thumbnails are stored in the same bucket as their source image, in a `/thumbnails/` subdirectory:

| Bucket | Content | Thumbnail Location |
|--------|---------|-------------------|
| `user-content` | New track uploads | `{path}/thumbnails/{filename}_{size}.{ext}` |
| `track-covers` | Old track uploads, profile images | `thumbnails/{filename}_{size}.{ext}` |
| `cover-images` | Video clip cover images | `{path}/thumbnails/{filename}_{size}.{ext}` |
| `images` | Profile images (new) | `{path}/thumbnails/{filename}_{size}.{ext}` |

## Data Flow

### Track Upload Flow
```
User uploads track with cover image
    ↓
app/api/upload-studio/submit/route.ts
    ↓
Cover image saved to Supabase Storage (user-content bucket)
    ↓
Track record created in ip_tracks with cover_image_url
    ↓
Background: POST /api/tracks/generate-thumbnails
    ↓
app/api/tracks/generate-thumbnails/route.ts
    ↓
1. Downloads original image
2. Uses Sharp to generate 64px, 160px, 256px versions
3. Uploads thumbnails to storage (same bucket, /thumbnails/ folder)
4. Updates ip_tracks with thumb_64_url, thumb_160_url, thumb_256_url
```

### Profile Image Upload Flow
```
User uploads profile image
    ↓
components/profile/ProfileImageModal.tsx
    ↓
Image saved to Supabase Storage
    ↓
user_profiles.avatar_url updated
    ↓
Background: POST /api/profile/generate-thumbnails
    ↓
app/api/profile/generate-thumbnails/route.ts
    ↓
1. Downloads original image
2. Uses Sharp to generate 48px, 96px versions
3. Uploads thumbnails to storage (same bucket, /thumbnails/ folder)
4. Updates user_profiles with avatar_thumb_48_url, avatar_thumb_96_url
```

### Video Clip Upload Flow
```
User uploads video clip
    ↓
components/upload-studio/VideoClipModal.tsx
    ↓
Video frame captured at 0.1s using canvas.toBlob()
    ↓
Cover image saved to cover-images bucket
    ↓
Track record created with cover_image_url pointing to captured frame
    ↓
Background: POST /api/tracks/generate-thumbnails
    ↓
(Same as track upload flow - thumbnails generated from the captured frame)
```

## Component Usage

### Globe Track Cards (app/page.tsx)
```typescript
// Pass thumbnail URLs to GlobeTrackCard
<GlobeTrackCard
  coverImage={track.cover_image_url}
  thumb64Url={track.thumb_64_url}
  thumb160Url={track.thumb_160_url}
  thumb256Url={track.thumb_256_url}
/>
```

### Header Avatar (components/layout/Header.tsx)
```typescript
// Fetches avatar_thumb_48_url from user_profiles
// Falls back to full avatar_url if thumbnail not available
src={avatarThumb48Url || avatarUrl || generateAvatar(walletAddress)}
```

### Store Page (app/store/[walletAddress]/page.tsx)
```typescript
// Fetches avatar_thumb_96_url from user_profiles
src={profileThumb96Url || profileImage}
```

### Dashboard (app/account/page.tsx)
```typescript
// Fetches avatar_thumb_96_url from user_profiles
src={profileThumb96Url || profileImage}
```

## API Endpoints

### POST /api/tracks/generate-thumbnails
Generates thumbnails for a track's cover image.

**Request Body:**
```json
{
  "trackId": "uuid",
  "coverImageUrl": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "thumbnails": {
    "thumb_64_url": "https://...",
    "thumb_160_url": "https://...",
    "thumb_256_url": "https://..."
  }
}
```

### POST /api/profile/generate-thumbnails
Generates thumbnails for a user's profile avatar.

**Request Body:**
```json
{
  "walletAddress": "SP...",
  "avatarUrl": "https://..."
}
```

**Response:**
```json
{
  "success": true,
  "thumbnails": {
    "avatar_thumb_48_url": "https://...",
    "avatar_thumb_96_url": "https://..."
  }
}
```

## Backfill Scripts

### Track Thumbnail Backfill
```bash
npx ts-node scripts/backfill-thumbnails.ts
```
- Processes all tracks with cover images but missing thumbnails
- Supports buckets: user-content, track-covers, cover-images
- Batch processing with rate limiting

### Profile Thumbnail Backfill
```bash
npx ts-node scripts/backfill-profile-thumbnails.ts
```
- Processes all profiles with avatars but missing thumbnails
- Supports buckets: images, user-content, track-covers
- Detects image type from buffer for extensionless URLs
- Skips video avatars (MP4, WebM)

### Check Video Thumbnail Status
```bash
node scripts/check-video-thumbnails.js
```
- Reports count of video clips with/without thumbnails

## Database Migrations

### Track Thumbnail Columns
```sql
-- scripts/add-thumbnail-columns.sql
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS thumb_64_url TEXT;
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS thumb_160_url TEXT;
ALTER TABLE ip_tracks ADD COLUMN IF NOT EXISTS thumb_256_url TEXT;
```

### Profile Thumbnail Columns
```sql
-- scripts/add-profile-thumbnail-columns.sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_thumb_48_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_thumb_96_url TEXT;
```

## Image Processing Details

### Sharp Configuration
- **Resize**: `fit: 'cover'`, `position: 'center'` (square crop from center)
- **Quality**: 80% for JPEG/WebP/PNG
- **Animated GIFs**: Preserved with `{ animated: true }` option
- **Format**: Preserves original format (JPEG, PNG, WebP, GIF)

### Content Type Detection
For URLs without file extensions (legacy profile images), content type is detected from buffer magic bytes:
- PNG: `89 50 4E 47`
- JPEG: `FF D8 FF`
- GIF: `47 49 46 38`
- WebP: `52 49 46 46 ... 57 45 42 50`

## Fallback Behavior

All components implement graceful fallback:
```typescript
src={thumbnail || originalImage || placeholder}
```

This ensures images still display even if:
- Thumbnails haven't been generated yet
- Thumbnail generation failed
- Legacy content predates thumbnail system

## File Locations

| File | Purpose |
|------|---------|
| `app/api/tracks/generate-thumbnails/route.ts` | Track thumbnail API |
| `app/api/profile/generate-thumbnails/route.ts` | Profile thumbnail API |
| `scripts/backfill-thumbnails.ts` | Track backfill script |
| `scripts/backfill-profile-thumbnails.ts` | Profile backfill script |
| `scripts/check-video-thumbnails.js` | Video thumbnail checker |
| `scripts/add-thumbnail-columns.sql` | Track DB migration |
| `scripts/add-profile-thumbnail-columns.sql` | Profile DB migration |
| `lib/userProfileService.ts` | UserProfile type with thumbnail fields |
| `components/profile/ProfileImageModal.tsx` | Profile upload with thumbnail generation |
| `components/layout/Header.tsx` | Uses profile thumbnails |
| `app/store/[walletAddress]/page.tsx` | Uses profile thumbnails |
| `app/account/page.tsx` | Uses profile thumbnails |
| `app/page.tsx` | Passes track thumbnails to globe cards |

## Monitoring

To check thumbnail coverage:
```bash
# Track thumbnails
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('ip_tracks').select('*', { count: 'exact', head: true }).not('thumb_64_url', 'is', null).then(r => console.log('Tracks with thumbnails:', r.count));
"

# Profile thumbnails
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('user_profiles').select('*', { count: 'exact', head: true }).not('avatar_thumb_48_url', 'is', null).then(r => console.log('Profiles with thumbnails:', r.count));
"
```

## Future Considerations

1. **Video avatar thumbnails**: Currently skipped. Would require server-side video processing (ffmpeg) to extract frames.

2. **Additional sizes**: Easy to add more sizes by updating the `THUMBNAIL_SIZES` arrays in the generation scripts/APIs.

3. **WebP conversion**: Could convert all thumbnails to WebP for better compression while maintaining quality.

4. **CDN caching**: Thumbnails have `cacheControl: '31536000'` (1 year) set for optimal caching.
