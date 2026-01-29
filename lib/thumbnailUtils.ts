import { SupabaseClient } from '@supabase/supabase-js';

// Profile/Persona thumbnail sizes (48px for header, 96px for store/dashboard)
const THUMBNAIL_SIZES = [48, 96] as const;

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

/**
 * Generate thumbnails for an image
 */
async function generateThumbnails(
  imageBuffer: Buffer,
  baseFilename: string,
  contentType: string
): Promise<ThumbnailResult[]> {
  // Dynamic import of sharp to avoid build-time native module issues
  const sharp = (await import('sharp')).default;

  const results: ThumbnailResult[] = [];
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

      results.push({
        size,
        buffer,
        filename,
        contentType: outputType
      });

      console.log(`✅ Generated ${size}px thumbnail: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to generate ${size}px thumbnail:`, error);
    }
  }

  return results;
}

/**
 * Generate thumbnails for a persona avatar inline
 * Returns { avatar_thumb_48_url, avatar_thumb_96_url } or empty object
 */
export async function generatePersonaThumbnailsInline(
  avatarUrl: string,
  personaId: string,
  supabase: SupabaseClient
): Promise<Record<string, string>> {
  console.log('🖼️ Generating persona thumbnails for:', avatarUrl);

  // Extract storage info
  const storageInfo = extractStorageInfo(avatarUrl);
  if (!storageInfo) {
    console.log('❌ Could not extract storage path from URL:', avatarUrl);
    return {};
  }

  // Download the original image
  console.log('📥 Downloading avatar image...');
  const response = await fetch(avatarUrl);
  if (!response.ok) {
    console.error('Failed to download image:', response.status);
    return {};
  }

  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  const contentType = getContentType(avatarUrl);

  // Generate base filename from path
  const originalFilename = storageInfo.path.split('/').pop()!;
  const baseFilename = originalFilename.replace(/\.[^.]+$/, '');
  const baseDir = storageInfo.path.substring(0, storageInfo.path.lastIndexOf('/'));

  console.log('🔄 Generating thumbnails...');

  // Generate thumbnails
  const thumbnails = await generateThumbnails(imageBuffer, baseFilename, contentType);

  if (thumbnails.length === 0) {
    console.error('Failed to generate any thumbnails');
    return {};
  }

  // Upload thumbnails
  const result: Record<string, string> = {};

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

    if (thumb.size === 48) {
      result.avatar_thumb_48_url = urlData.publicUrl;
    } else if (thumb.size === 96) {
      result.avatar_thumb_96_url = urlData.publicUrl;
    }

    console.log(`✅ Uploaded ${thumb.size}px: ${urlData.publicUrl}`);
  }

  return result;
}
