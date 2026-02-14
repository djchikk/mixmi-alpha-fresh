/**
 * One-time script to fix remix cover images stored as base64 data URIs.
 * Uploads each to Supabase Storage and updates the database row.
 * Also triggers thumbnail generation for each fixed track.
 *
 * Usage: node scripts/fix-base64-covers.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixBase64Covers() {
  console.log('Finding tracks with base64 cover images...');

  const { data: tracks, error } = await supabase
    .from('ip_tracks')
    .select('id, title, cover_image_url')
    .like('cover_image_url', 'data:%');

  if (error) {
    console.error('Query error:', error);
    return;
  }

  console.log(`Found ${tracks.length} tracks with base64 covers\n`);

  for (const track of tracks) {
    console.log(`Processing: ${track.title} (${track.id})`);
    const dataUri = track.cover_image_url;

    // Parse the data URI
    const match = dataUri.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) {
      console.log('  Skipping - not a valid image data URI');
      continue;
    }

    const format = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `remix-cover-migrated-${track.id}.${format}`;

    console.log(`  Size: ${Math.round(buffer.length / 1024)} KB`);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('cover-images')
      .upload(fileName, buffer, {
        contentType: `image/${format}`,
        cacheControl: '31536000',
        upsert: true,
      });

    if (uploadError) {
      console.error(`  Upload failed:`, uploadError.message);
      continue;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('cover-images')
      .getPublicUrl(fileName);

    // Update database row
    const { error: updateError } = await supabase
      .from('ip_tracks')
      .update({ cover_image_url: publicUrl })
      .eq('id', track.id);

    if (updateError) {
      console.error(`  DB update failed:`, updateError.message);
      continue;
    }

    console.log(`  Uploaded and updated: ${publicUrl.slice(-60)}`);

    // Trigger thumbnail generation
    try {
      const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('supabase.co', 'vercel.app');
      // Use the local API if available, otherwise just log
      const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tracks/generate-thumbnails`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id, coverImageUrl: publicUrl }),
      });
      if (response.ok) {
        console.log('  Thumbnails generated');
      } else {
        console.log('  Thumbnail generation skipped (server not running locally)');
      }
    } catch {
      console.log('  Thumbnail generation skipped (server not running locally)');
    }
  }

  console.log('\nDone!');
}

fixBase64Covers();
