import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Force dynamic - sharp is imported dynamically at runtime
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Initialize Supabase with service role for uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Track thumbnail sizes (64px small, 160px medium grid, 256px large/detail)
const TRACK_THUMBNAIL_SIZES = [64, 160, 256] as const;

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
 * Generate thumbnails for track cover image
 */
async function generateTrackThumbnails(
  imageBuffer: Buffer,
  baseFilename: string,
  contentType: string
): Promise<ThumbnailResult[]> {
  // Dynamic import of sharp to avoid build-time native module issues
  const sharp = (await import('sharp')).default;

  const results: ThumbnailResult[] = [];
  const isGif = contentType === 'image/gif';
  const animated = isGif && await isAnimatedGif(imageBuffer);

  for (const size of TRACK_THUMBNAIL_SIZES) {
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

      console.log(`✅ Generated ${size}px track thumbnail: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to generate ${size}px track thumbnail:`, error);
    }
  }

  return results;
}

/**
 * Extract storage info from Supabase URL
 */
function extractStorageInfo(url: string): { bucket: string; path: string } | null {
  // Try 'user-content' bucket (new track uploads)
  let match = url.match(/\/storage\/v1\/object\/public\/user-content\/(.+)$/);
  if (match) {
    return { bucket: 'user-content', path: match[1] };
  }

  // Try 'track-covers' bucket (dedicated track covers)
  match = url.match(/\/storage\/v1\/object\/public\/track-covers\/(.+)$/);
  if (match) {
    return { bucket: 'track-covers', path: match[1] };
  }

  // Try 'cover-images' bucket (video clip covers)
  match = url.match(/\/storage\/v1\/object\/public\/cover-images\/(.+)$/);
  if (match) {
    return { bucket: 'cover-images', path: match[1] };
  }

  // Try 'images' bucket (generic)
  match = url.match(/\/storage\/v1\/object\/public\/images\/(.+)$/);
  if (match) {
    return { bucket: 'images', path: match[1] };
  }

  return null;
}

/**
 * Get content type from URL extension or buffer
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
  console.log('🖼️ Track thumbnail generation endpoint hit');

  try {
    const body = await request.json();
    const { trackId, coverImageUrl } = body;

    if (!trackId || !coverImageUrl) {
      return NextResponse.json(
        { error: 'trackId and coverImageUrl are required' },
        { status: 400 }
      );
    }

    // Skip non-image URLs (videos)
    if (coverImageUrl.includes('.mp4') || coverImageUrl.includes('.webm') || coverImageUrl.includes('video/')) {
      console.log('⏭️ Skipping video cover - no thumbnail generation');
      return NextResponse.json({
        success: true,
        message: 'Video covers do not need thumbnails',
        thumbnails: {}
      });
    }

    // Skip non-Supabase URLs
    if (!coverImageUrl.includes('supabase.co')) {
      console.log('⏭️ Skipping external URL - cannot generate thumbnails');
      return NextResponse.json({
        success: true,
        message: 'External URLs cannot have thumbnails generated',
        thumbnails: {}
      });
    }

    // Extract storage info
    const storageInfo = extractStorageInfo(coverImageUrl);
    if (!storageInfo) {
      console.log('❌ Could not extract storage path from URL:', coverImageUrl);
      return NextResponse.json(
        { error: 'Could not parse cover image URL' },
        { status: 400 }
      );
    }

    console.log('📥 Downloading cover image from:', coverImageUrl);

    // Download the original image
    const response = await fetch(coverImageUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download image: ${response.status}` },
        { status: 500 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const contentType = getContentType(coverImageUrl);

    // Generate base filename from path
    const originalFilename = storageInfo.path.split('/').pop()!;
    const baseFilename = originalFilename.replace(/\.[^.]+$/, '');
    const baseDir = storageInfo.path.substring(0, storageInfo.path.lastIndexOf('/'));

    console.log('🔄 Generating track thumbnails...');

    // Generate thumbnails
    const thumbnails = await generateTrackThumbnails(imageBuffer, baseFilename, contentType);

    if (thumbnails.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate thumbnails' },
        { status: 500 }
      );
    }

    // Upload thumbnails
    const thumbnailUrls: Record<number, string> = {};

    for (const thumb of thumbnails) {
      // Put thumbnails in a thumbnails subfolder
      const thumbPath = baseDir
        ? `${baseDir}/thumbnails/${thumb.filename}`
        : `thumbnails/${thumb.filename}`;

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

    // Update ip_tracks with thumbnail URLs
    const updateData: Record<string, string> = {};
    if (thumbnailUrls[64]) updateData.thumb_64_url = thumbnailUrls[64];
    if (thumbnailUrls[160]) updateData.thumb_160_url = thumbnailUrls[160];
    if (thumbnailUrls[256]) updateData.thumb_256_url = thumbnailUrls[256];

    if (Object.keys(updateData).length > 0) {
      console.log('💾 Updating ip_tracks with thumbnail URLs for track:', trackId);

      const { error: updateError } = await supabase
        .from('ip_tracks')
        .update(updateData)
        .eq('id', trackId);

      if (updateError) {
        console.error('❌ Failed to update track:', updateError);
        return NextResponse.json(
          { error: 'Thumbnails uploaded but failed to update track record' },
          { status: 500 }
        );
      }

      console.log('✅ Track updated with thumbnail URLs');
    }

    return NextResponse.json({
      success: true,
      thumbnails: {
        thumb_64_url: thumbnailUrls[64],
        thumb_160_url: thumbnailUrls[160],
        thumb_256_url: thumbnailUrls[256]
      }
    });

  } catch (error: any) {
    console.error('Track thumbnail generation error:', error);
    return NextResponse.json(
      { error: 'Thumbnail generation failed', details: error.message },
      { status: 500 }
    );
  }
}
