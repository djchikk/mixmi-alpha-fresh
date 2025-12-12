/**
 * Backfill Profile Thumbnails Script
 *
 * Generates pre-sized thumbnails for all existing profile images in user_profiles
 * that don't already have thumbnails.
 *
 * Run with: npx ts-node scripts/backfill-profile-thumbnails.ts
 *
 * Prerequisites:
 * 1. Run the SQL migration: scripts/add-profile-thumbnail-columns.sql
 * 2. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL');
  console.error('  SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Profile thumbnail sizes: 48px for header, 96px for store/dashboard
const PROFILE_THUMBNAIL_SIZES = [48, 96] as const;
const BATCH_SIZE = 10;
const DELAY_BETWEEN_PROFILES = 500;

interface UserProfile {
  wallet_address: string;
  avatar_url: string | null;
  avatar_thumb_48_url: string | null;
  avatar_thumb_96_url: string | null;
}

interface ThumbnailResult {
  size: number;
  buffer: Buffer;
  filename: string;
  contentType: string;
}

/**
 * Check if file is an animated GIF
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
 * Extract storage info from Supabase URL
 */
function extractStorageInfo(url: string): { bucket: string; path: string } | null {
  // Try 'images' bucket (profile images)
  let match = url.match(/\/storage\/v1\/object\/public\/images\/(.+)$/);
  if (match) {
    return { bucket: 'images', path: match[1] };
  }

  // Try 'user-content' bucket
  match = url.match(/\/storage\/v1\/object\/public\/user-content\/(.+)$/);
  if (match) {
    return { bucket: 'user-content', path: match[1] };
  }

  // Try 'track-covers' bucket (older profile images stored here)
  match = url.match(/\/storage\/v1\/object\/public\/track-covers\/(.+)$/);
  if (match) {
    return { bucket: 'track-covers', path: match[1] };
  }

  return null;
}

/**
 * Detect content type from buffer magic bytes
 */
function detectContentType(buffer: Buffer): string {
  // Check for PNG (89 50 4E 47)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  // Check for JPEG (FF D8 FF)
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  // Check for GIF (47 49 46 38)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }
  // Check for WebP (52 49 46 46 ... 57 45 42 50)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }
  // Default to jpeg
  return 'image/jpeg';
}

/**
 * Download image from URL
 */
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  Failed to download: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`  Download error:`, error);
    return null;
  }
}

/**
 * Generate thumbnails for profile image
 */
async function generateThumbnails(
  imageBuffer: Buffer,
  baseFilename: string,
  contentType: string
): Promise<ThumbnailResult[]> {
  const results: ThumbnailResult[] = [];
  const isGif = contentType === 'image/gif';
  const animated = isGif && await isAnimatedGif(imageBuffer);

  for (const size of PROFILE_THUMBNAIL_SIZES) {
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

      results.push({
        size,
        buffer,
        filename,
        contentType: outputType
      });
    } catch (error) {
      console.error(`  Failed to generate ${size}px thumbnail:`, error);
    }
  }

  return results;
}

/**
 * Upload thumbnails to Supabase storage
 */
async function uploadThumbnails(
  thumbnails: ThumbnailResult[],
  storageInfo: { bucket: string; path: string }
): Promise<Map<number, string>> {
  const urls = new Map<number, string>();
  // Handle paths that may or may not have directories
  const lastSlash = storageInfo.path.lastIndexOf('/');
  const baseDir = lastSlash > 0 ? storageInfo.path.substring(0, lastSlash) : '';

  for (const thumb of thumbnails) {
    // If no baseDir (flat storage), put thumbnails directly in root with prefix
    const thumbPath = baseDir ? `${baseDir}/thumbnails/${thumb.filename}` : `thumbnails/${thumb.filename}`;

    const { error } = await supabase.storage
      .from(storageInfo.bucket)
      .upload(thumbPath, thumb.buffer, {
        contentType: thumb.contentType,
        cacheControl: '31536000',
        upsert: true
      });

    if (error) {
      console.error(`  Failed to upload ${thumb.size}px thumbnail:`, error.message);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from(storageInfo.bucket)
      .getPublicUrl(thumbPath);

    urls.set(thumb.size, urlData.publicUrl);
  }

  return urls;
}

/**
 * Update profile with thumbnail URLs
 */
async function updateProfileThumbnails(
  walletAddress: string,
  thumbnailUrls: Map<number, string>
): Promise<boolean> {
  const update: any = {};

  if (thumbnailUrls.has(48)) update.avatar_thumb_48_url = thumbnailUrls.get(48);
  if (thumbnailUrls.has(96)) update.avatar_thumb_96_url = thumbnailUrls.get(96);

  if (Object.keys(update).length === 0) {
    return false;
  }

  const { error } = await supabase
    .from('user_profiles')
    .update(update)
    .eq('wallet_address', walletAddress);

  if (error) {
    console.error(`  Failed to update profile:`, error.message);
    return false;
  }

  return true;
}

/**
 * Process a single profile
 */
async function processProfile(profile: UserProfile): Promise<boolean> {
  const shortWallet = profile.wallet_address.substring(0, 10) + '...';
  console.log(`\n Processing profile: ${shortWallet}`);

  if (!profile.avatar_url) {
    console.log('  Skipping - no avatar URL');
    return false;
  }

  // Skip if already has thumbnails
  if (profile.avatar_thumb_48_url && profile.avatar_thumb_96_url) {
    console.log('  Skipping - already has thumbnails');
    return false;
  }

  // Skip video avatars
  if (profile.avatar_url.includes('.mp4') || profile.avatar_url.includes('.webm') || profile.avatar_url.includes('video/')) {
    console.log('  Skipping - video avatar');
    return false;
  }

  // Skip non-Supabase URLs
  if (!profile.avatar_url.includes('supabase.co')) {
    console.log('  Skipping - non-Supabase URL');
    return false;
  }

  // Extract storage info
  const storageInfo = extractStorageInfo(profile.avatar_url);
  if (!storageInfo) {
    console.log('  Skipping - could not extract storage path');
    return false;
  }

  // Download original image
  console.log('  Downloading avatar...');
  const imageBuffer = await downloadImage(profile.avatar_url);
  if (!imageBuffer) {
    return false;
  }

  // Get content type - detect from buffer if URL has no extension
  const hasExtension = profile.avatar_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  const contentType = hasExtension ? getContentType(profile.avatar_url) : detectContentType(imageBuffer);

  // Generate base filename
  const originalFilename = storageInfo.path.split('/').pop()!;
  const baseFilename = originalFilename.replace(/\.[^.]+$/, '');

  // Generate thumbnails
  console.log('  Generating thumbnails...');
  const thumbnails = await generateThumbnails(imageBuffer, baseFilename, contentType);

  if (thumbnails.length === 0) {
    console.log('  No thumbnails generated');
    return false;
  }

  // Upload thumbnails
  console.log('  Uploading thumbnails...');
  const thumbnailUrls = await uploadThumbnails(thumbnails, storageInfo);

  if (thumbnailUrls.size === 0) {
    console.log('  No thumbnails uploaded');
    return false;
  }

  // Update database
  console.log('  Updating database...');
  const success = await updateProfileThumbnails(profile.wallet_address, thumbnailUrls);

  if (success) {
    console.log(`  Generated ${thumbnailUrls.size} thumbnails`);
    return true;
  }

  return false;
}

/**
 * Main function
 */
async function main() {
  console.log('Starting profile thumbnail backfill...\n');

  // Check if thumb columns exist first
  const { data: testData, error: testError } = await supabase
    .from('user_profiles')
    .select('avatar_thumb_48_url')
    .limit(1);

  if (testError && testError.message.includes('column')) {
    console.error('Thumbnail columns not found in database.');
    console.error('Please run the migration first:');
    console.error('  scripts/add-profile-thumbnail-columns.sql');
    process.exit(1);
  }

  // Get counts first
  const { count: totalWithAvatars } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .not('avatar_url', 'is', null);

  const { count: withoutThumbs } = await supabase
    .from('user_profiles')
    .select('*', { count: 'exact', head: true })
    .not('avatar_url', 'is', null)
    .or('avatar_thumb_48_url.is.null,avatar_thumb_96_url.is.null');

  console.log('=== Profile Thumbnail Status ===');
  console.log(`Profiles with avatars: ${totalWithAvatars}`);
  console.log(`Profiles missing thumbnails: ${withoutThumbs}`);
  console.log('');

  // Get all profiles that need thumbnails
  let processed = 0;
  let generated = 0;
  let offset = 0;

  while (true) {
    console.log(`\nFetching batch at offset ${offset}...`);

    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('wallet_address, avatar_url, avatar_thumb_48_url, avatar_thumb_96_url')
      .not('avatar_url', 'is', null)
      .or('avatar_thumb_48_url.is.null,avatar_thumb_96_url.is.null')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Failed to fetch profiles:', error.message);
      break;
    }

    if (!profiles || profiles.length === 0) {
      console.log('\nNo more profiles to process');
      break;
    }

    console.log(`Found ${profiles.length} profiles in this batch`);

    for (const profile of profiles) {
      processed++;
      const success = await processProfile(profile as UserProfile);
      if (success) generated++;

      // Small delay between profiles
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_PROFILES));
    }

    offset += BATCH_SIZE;

    // If we got fewer than BATCH_SIZE, we're done
    if (profiles.length < BATCH_SIZE) {
      break;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Backfill Summary:');
  console.log(`   Profiles processed: ${processed}`);
  console.log(`   Thumbnails generated: ${generated}`);
  console.log('='.repeat(50));
}

// Run the script
main().catch(console.error);
