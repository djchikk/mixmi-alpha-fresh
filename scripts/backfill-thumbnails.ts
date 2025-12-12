/**
 * Backfill Thumbnails Script
 *
 * Generates pre-sized thumbnails for all existing images in ip_tracks
 * that don't already have thumbnails.
 *
 * Run with: npx ts-node scripts/backfill-thumbnails.ts
 *
 * Prerequisites:
 * 1. Run the SQL migration: scripts/add-thumbnail-columns.sql
 * 2. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const THUMBNAIL_SIZES = [64, 160, 256] as const;
const BATCH_SIZE = 10; // Process 10 tracks at a time
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

interface Track {
  id: string;
  title: string;
  cover_image_url: string | null;
  thumb_64_url: string | null;
  thumb_160_url: string | null;
  thumb_256_url: string | null;
}

/**
 * Check if the image is an animated GIF
 */
async function isAnimatedGif(buffer: Buffer): Promise<boolean> {
  let frameCount = 0;
  for (let i = 0; i < buffer.length - 2; i++) {
    if (buffer[i] === 0x21 && buffer[i + 1] === 0xF9) {
      frameCount++;
      if (frameCount > 1) return true;
    }
  }
  return false;
}

/**
 * Get content type from URL extension
 */
function getContentType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    default: return 'image/jpeg';
  }
}

/**
 * Extract storage bucket and path from Supabase URL
 * Supports 'user-content', 'track-covers', and 'cover-images' buckets
 */
function extractStorageInfo(url: string): { bucket: string; path: string } | null {
  // URL format: https://xxx.supabase.co/storage/v1/object/public/BUCKET/path/filename.jpg
  // Try user-content bucket first (new uploads)
  let match = url.match(/\/storage\/v1\/object\/public\/user-content\/(.+)$/);
  if (match) {
    return { bucket: 'user-content', path: match[1] };
  }

  // Try track-covers bucket (old uploads)
  match = url.match(/\/storage\/v1\/object\/public\/track-covers\/(.+)$/);
  if (match) {
    return { bucket: 'track-covers', path: match[1] };
  }

  // Try cover-images bucket (video clip covers)
  match = url.match(/\/storage\/v1\/object\/public\/cover-images\/(.+)$/);
  if (match) {
    return { bucket: 'cover-images', path: match[1] };
  }

  return null;
}

/**
 * Download image from Supabase storage
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ❌ Failed to download: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`  ❌ Download error:`, error);
    return null;
  }
}

/**
 * Generate thumbnails for a single image
 */
async function generateThumbnails(
  imageBuffer: Buffer,
  baseFilename: string,
  contentType: string
): Promise<Map<number, { buffer: Buffer; filename: string; contentType: string }>> {
  const results = new Map();
  const isGif = contentType === 'image/gif';
  const animated = isGif && await isAnimatedGif(imageBuffer);

  for (const size of THUMBNAIL_SIZES) {
    try {
      let buffer: Buffer;
      let filename: string;
      let outputType: string;

      if (animated) {
        // Preserve animation for GIFs
        buffer = await sharp(imageBuffer, { animated: true })
          .resize(size, size, { fit: 'cover', position: 'center' })
          .gif()
          .toBuffer();
        filename = `${baseFilename}_${size}.gif`;
        outputType = 'image/gif';
      } else {
        // Static image
        const ext = contentType.includes('png') ? 'png'
                  : contentType.includes('webp') ? 'webp'
                  : 'jpg';

        let processor = sharp(imageBuffer)
          .resize(size, size, { fit: 'cover', position: 'center' });

        if (ext === 'png') {
          processor = processor.png({ quality: 80 });
        } else if (ext === 'webp') {
          processor = processor.webp({ quality: 80 });
        } else {
          processor = processor.jpeg({ quality: 80 });
        }

        buffer = await processor.toBuffer();
        filename = `${baseFilename}_${size}.${ext}`;
        outputType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      }

      results.set(size, { buffer, filename, contentType: outputType });
    } catch (error) {
      console.error(`  ❌ Failed to generate ${size}px thumbnail:`, error);
    }
  }

  return results;
}

/**
 * Upload thumbnails to Supabase storage
 */
async function uploadThumbnails(
  thumbnails: Map<number, { buffer: Buffer; filename: string; contentType: string }>,
  storageInfo: { bucket: string; path: string }
): Promise<Map<number, string>> {
  const urls = new Map<number, string>();
  const baseDir = storageInfo.path.substring(0, storageInfo.path.lastIndexOf('/'));

  for (const [size, thumb] of thumbnails) {
    const thumbPath = `${baseDir}/thumbnails/${thumb.filename}`;

    const { error } = await supabase.storage
      .from(storageInfo.bucket)
      .upload(thumbPath, thumb.buffer, {
        contentType: thumb.contentType,
        cacheControl: '31536000',
        upsert: true // Overwrite if exists
      });

    if (error) {
      console.error(`  ❌ Failed to upload ${size}px thumbnail:`, error.message);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from(storageInfo.bucket)
      .getPublicUrl(thumbPath);

    urls.set(size, urlData.publicUrl);
  }

  return urls;
}

/**
 * Update track record with thumbnail URLs
 */
async function updateTrackThumbnails(
  trackId: string,
  thumbnailUrls: Map<number, string>
): Promise<boolean> {
  const update: any = {};

  if (thumbnailUrls.has(64)) update.thumb_64_url = thumbnailUrls.get(64);
  if (thumbnailUrls.has(160)) update.thumb_160_url = thumbnailUrls.get(160);
  if (thumbnailUrls.has(256)) update.thumb_256_url = thumbnailUrls.get(256);

  if (Object.keys(update).length === 0) {
    return false;
  }

  const { error } = await supabase
    .from('ip_tracks')
    .update(update)
    .eq('id', trackId);

  if (error) {
    console.error(`  ❌ Failed to update track:`, error.message);
    return false;
  }

  return true;
}

/**
 * Process a single track
 */
async function processTrack(track: Track): Promise<boolean> {
  console.log(`\n📷 Processing: ${track.title} (${track.id.substring(0, 8)}...)`);

  if (!track.cover_image_url) {
    console.log('  ⏭️ No cover image, skipping');
    return false;
  }

  // Skip if already has thumbnails
  if (track.thumb_64_url && track.thumb_160_url && track.thumb_256_url) {
    console.log('  ✅ Already has thumbnails, skipping');
    return false;
  }

  // Skip non-Supabase URLs
  if (!track.cover_image_url.includes('supabase.co')) {
    console.log('  ⏭️ Non-Supabase image, skipping');
    return false;
  }

  // Extract storage info (bucket and path)
  const storageInfo = extractStorageInfo(track.cover_image_url);
  if (!storageInfo) {
    console.log('  ❌ Could not extract storage path');
    return false;
  }

  // Download original image
  console.log('  📥 Downloading original image...');
  const imageBuffer = await downloadImage(track.cover_image_url);
  if (!imageBuffer) {
    return false;
  }

  // Get content type
  const contentType = getContentType(track.cover_image_url);

  // Generate base filename
  const originalFilename = storageInfo.path.split('/').pop()!;
  const baseFilename = originalFilename.replace(/\.[^.]+$/, '');

  // Generate thumbnails
  console.log('  🔄 Generating thumbnails...');
  const thumbnails = await generateThumbnails(imageBuffer, baseFilename, contentType);

  if (thumbnails.size === 0) {
    console.log('  ❌ No thumbnails generated');
    return false;
  }

  // Upload thumbnails
  console.log('  📤 Uploading thumbnails...');
  const thumbnailUrls = await uploadThumbnails(thumbnails, storageInfo);

  if (thumbnailUrls.size === 0) {
    console.log('  ❌ No thumbnails uploaded');
    return false;
  }

  // Update database
  console.log('  💾 Updating database...');
  const success = await updateTrackThumbnails(track.id, thumbnailUrls);

  if (success) {
    console.log(`  ✅ Generated ${thumbnailUrls.size} thumbnails`);
    return true;
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting thumbnail backfill...\n');

  // Check if thumb columns exist first
  const { data: testData, error: testError } = await supabase
    .from('ip_tracks')
    .select('thumb_64_url')
    .limit(1);

  if (testError && testError.message.includes('column')) {
    console.error('❌ Thumbnail columns not found in database.');
    console.error('   Please run the migration first:');
    console.error('   scripts/add-thumbnail-columns.sql');
    process.exit(1);
  }

  // Get all tracks with cover images but missing thumbnails
  let processed = 0;
  let generated = 0;
  let offset = 0;

  while (true) {
    console.log(`\n📦 Fetching batch at offset ${offset}...`);

    const { data: tracks, error } = await supabase
      .from('ip_tracks')
      .select('id, title, cover_image_url, thumb_64_url, thumb_160_url, thumb_256_url')
      .not('cover_image_url', 'is', null)
      .or('thumb_64_url.is.null,thumb_160_url.is.null,thumb_256_url.is.null')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('❌ Failed to fetch tracks:', error.message);
      break;
    }

    if (!tracks || tracks.length === 0) {
      console.log('\n✅ No more tracks to process');
      break;
    }

    console.log(`📋 Found ${tracks.length} tracks in this batch`);

    for (const track of tracks) {
      processed++;
      const success = await processTrack(track as Track);
      if (success) generated++;

      // Small delay between tracks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    offset += BATCH_SIZE;

    // Delay between batches
    if (tracks.length === BATCH_SIZE) {
      console.log(`\n⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Backfill Summary:');
  console.log(`   Tracks processed: ${processed}`);
  console.log(`   Thumbnails generated: ${generated}`);
  console.log('='.repeat(50));
}

// Run the script
main().catch(console.error);
