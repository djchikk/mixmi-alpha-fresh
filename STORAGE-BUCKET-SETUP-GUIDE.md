# 🎥 Storage Bucket Setup Guide for Video Uploads

**Date:** November 19, 2025
**Issue:** Video uploads failing with "StorageApiError: new row violates row-level security policy"
**Solution:** Create storage buckets and RLS policies in Supabase dashboard

---

## 📁 Required Storage Buckets

### 1. **video-clips** bucket
- **Purpose:** Store uploaded video files (MP4, MOV, WebM)
- **Public:** Yes (allows public playback)
- **File size limit:** 10MB
- **Allowed MIME types:** `video/mp4`, `video/quicktime`, `video/webm`

### 2. **cover-images** bucket
- **Purpose:** Store auto-generated video thumbnails (first frame)
- **Public:** Yes (allows public display)
- **File size limit:** 5MB
- **Allowed MIME types:** `image/jpeg`, `image/png`, `image/webp`

---

## 🛠️ Setup Instructions

### **Step 1: Create Buckets in Supabase UI**

1. Open your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Create the first bucket:
   - **Name:** `video-clips`
   - **Public bucket:** ✅ **Yes** (check this box!)
   - **File size limit:** 10485760 (10MB in bytes)
   - **Allowed MIME types:** Add: `video/mp4`, `video/quicktime`, `video/webm`
   - Click **"Create bucket"**
5. Repeat for the second bucket:
   - **Name:** `cover-images`
   - **Public bucket:** ✅ **Yes**
   - **File size limit:** 5242880 (5MB in bytes)
   - **Allowed MIME types:** Add: `image/jpeg`, `image/png`, `image/webp`
   - Click **"Create bucket"**

### **Step 2: Set Up RLS Policies via SQL Editor**

1. Go to **SQL Editor** in Supabase dashboard
2. Click **"New query"**
3. Paste the following SQL:

```sql
-- =================================================================
-- RLS Policies for video-clips and cover-images buckets
-- =================================================================
-- Based on the working track-covers bucket pattern
-- =================================================================

-- Policy for video-clips bucket (allows all operations)
CREATE POLICY "allow_all_video_clips"
ON storage.objects FOR ALL
USING (bucket_id = 'video-clips')
WITH CHECK (bucket_id = 'video-clips');

-- Policy for cover-images bucket (allows all operations)
CREATE POLICY "allow_all_cover_images"
ON storage.objects FOR ALL
USING (bucket_id = 'cover-images')
WITH CHECK (bucket_id = 'cover-images');
```

4. Click **"Run"** to execute the SQL

### **Step 3: Verify Setup**

Run this verification query in SQL Editor:

```sql
-- Check that buckets exist
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('video-clips', 'cover-images');

-- Check that policies exist
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname IN ('allow_all_video_clips', 'allow_all_cover_images');
```

You should see:
- ✅ 2 buckets returned with `public = true`
- ✅ 2 policies returned with `cmd = *` (allows all operations)

---

## 🎯 Expected Results

After completing these steps, video uploads should work!

**Upload flow:**
1. User selects video file (MP4, MOV, or WebM)
2. App extracts first frame as thumbnail
3. Thumbnail uploads to `cover-images` bucket ✅
4. Video uploads to `video-clips` bucket ✅
5. Both files get public URLs for playback ✅

**Code locations:**
- Video upload: `components/modals/IPTrackModal.tsx:557-569`
- Thumbnail upload: `components/modals/IPTrackModal.tsx:526-540`

---

## 🔍 Troubleshooting

### "Bucket not found" error
- ✅ Verify buckets created in Storage UI
- ✅ Check bucket names are exactly `video-clips` and `cover-images` (no typos)

### "RLS policy violation" error
- ✅ Verify policies created in SQL Editor
- ✅ Check policy names match exactly
- ✅ Ensure `public = true` for both buckets

### Files upload but can't be viewed
- ✅ Verify buckets are marked as **public**
- ✅ Check MIME types are in allowed list
- ✅ Confirm file sizes are under limits

---

## 📚 Reference: Existing Bucket Pattern

The `track-covers` bucket (used for music album art) uses this same simple pattern:

```sql
-- From: docs/TRACK_COVER_UPLOADER_GUIDE.md
CREATE POLICY "allow_all_track_covers"
ON storage.objects FOR ALL
USING (bucket_id = 'track-covers')
WITH CHECK (bucket_id = 'track-covers');
```

We're replicating this proven pattern for video uploads!

---

**🎉 Once complete, video clip uploads will work seamlessly with auto-generated thumbnails!**
