import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

// Force dynamic to prevent build-time evaluation (sharp has native dependencies)
export const dynamic = 'force-dynamic';

// Initialize Supabase with service role for uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Profile thumbnail sizes (48px for header, 96px for store/dashboard)
const PROFILE_THUMBNAIL_SIZES = [48, 96] as const;

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
 * Generate thumbnails for profile image
 */
async function generateProfileThumbnails(
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

      console.log(`✅ Generated ${size}px profile thumbnail: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to generate ${size}px profile thumbnail:`, error);
    }
  }

  return results;
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

export async function POST(request: NextRequest) {
  console.log('🖼️ Profile thumbnail generation endpoint hit');

  try {
    const body = await request.json();
    const { walletAddress, avatarUrl } = body;

    if (!walletAddress || !avatarUrl) {
      return NextResponse.json(
        { error: 'walletAddress and avatarUrl are required' },
        { status: 400 }
      );
    }

    // Skip non-image URLs (videos)
    if (avatarUrl.includes('.mp4') || avatarUrl.includes('.webm') || avatarUrl.includes('video/')) {
      console.log('⏭️ Skipping video avatar - no thumbnail generation');
      return NextResponse.json({
        success: true,
        message: 'Video avatars do not need thumbnails',
        thumbnails: {}
      });
    }

    // Skip non-Supabase URLs
    if (!avatarUrl.includes('supabase.co')) {
      console.log('⏭️ Skipping external URL - cannot generate thumbnails');
      return NextResponse.json({
        success: true,
        message: 'External URLs cannot have thumbnails generated',
        thumbnails: {}
      });
    }

    // Extract storage info
    const storageInfo = extractStorageInfo(avatarUrl);
    if (!storageInfo) {
      console.log('❌ Could not extract storage path from URL:', avatarUrl);
      return NextResponse.json(
        { error: 'Could not parse avatar URL' },
        { status: 400 }
      );
    }

    console.log('📥 Downloading avatar image from:', avatarUrl);

    // Download the original image
    const response = await fetch(avatarUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download image: ${response.status}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const contentType = getContentType(avatarUrl);

    // Generate base filename from path
    const originalFilename = storageInfo.path.split('/').pop()!;
    const baseFilename = originalFilename.replace(/\.[^.]+$/, '');
    const baseDir = storageInfo.path.substring(0, storageInfo.path.lastIndexOf('/'));

    console.log('🔄 Generating profile thumbnails...');

    // Generate thumbnails
    const thumbnails = await generateProfileThumbnails(imageBuffer, baseFilename, contentType);

    if (thumbnails.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate thumbnails' },
        { status: 500 }
      );
    }

    // Upload thumbnails
    const thumbnailUrls: Record<number, string> = {};

    for (const thumb of thumbnails) {
      const thumbPath = `${baseDir}/thumbnails/${thumb.filename}`;

      console.log(`📤 Uploading ${thumb.size}px thumbnail to ${storageInfo.bucket}/${thumbPath}`);

      const { error: uploadError } = await supabase.storage
        .from(storageInfo.bucket)
        .upload(thumbPath, thumb.buffer, {
          contentType: thumb.contentType,
          cacheControl: '31536000', // 1 year cache
          upsert: true
        });

      if (uploadError) {
        console.error(`❌ Failed to upload ${thumb.size}px thumbnail:`, uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(storageInfo.bucket)
        .getPublicUrl(thumbPath);

      thumbnailUrls[thumb.size] = urlData.publicUrl;
      console.log(`✅ Uploaded ${thumb.size}px: ${urlData.publicUrl}`);
    }

    // Update user_profiles with thumbnail URLs
    const updateData: Record<string, string> = {};
    if (thumbnailUrls[48]) updateData.avatar_thumb_48_url = thumbnailUrls[48];
    if (thumbnailUrls[96]) updateData.avatar_thumb_96_url = thumbnailUrls[96];

    if (Object.keys(updateData).length > 0) {
      console.log('💾 Updating user_profiles with thumbnail URLs...');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('wallet_address', walletAddress);

      if (updateError) {
        console.error('❌ Failed to update profile:', updateError);
        return NextResponse.json(
          { error: 'Thumbnails uploaded but failed to update profile' },
          { status: 500 }
        );
      }

      console.log('✅ Profile updated with thumbnail URLs');
    }

    return NextResponse.json({
      success: true,
      thumbnails: thumbnailUrls
    });

  } catch (error: any) {
    console.error('Profile thumbnail generation error:', error);
    return NextResponse.json(
      { error: 'Thumbnail generation failed', details: error.message },
      { status: 500 }
    );
  }
}
