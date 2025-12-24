/**
 * Thumbnail Generation Utility
 *
 * Generates pre-sized thumbnails for images at upload time to eliminate
 * Supabase image transformation quota usage.
 *
 * Sizes: 64px (tiny mixer), 160px (cards), 256px (big mixer decks)
 */

// Sharp is imported dynamically to avoid build-time native module issues

export const THUMBNAIL_SIZES = [64, 160, 256] as const;
export type ThumbnailSize = typeof THUMBNAIL_SIZES[number];

export interface ThumbnailResult {
  size: ThumbnailSize;
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface ThumbnailSet {
  original: string; // Original file path
  thumbnails: {
    [K in ThumbnailSize]?: string; // URL for each size
  };
}

/**
 * Check if file is an animated GIF
 */
async function isAnimatedGif(buffer: Buffer): Promise<boolean> {
  // GIF files have multiple frames if they contain multiple image descriptors
  // A simple check: look for multiple GIF frame markers (0x00 0x21 0xF9)
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
 * Generate thumbnails for a static image (JPG, PNG, WebP)
 */
export async function generateStaticThumbnails(
  imageBuffer: Buffer,
  baseFilename: string,
  contentType: string
): Promise<ThumbnailResult[]> {
  // Dynamic import of sharp to avoid build-time native module issues
  const sharp = (await import('sharp')).default;

  const results: ThumbnailResult[] = [];

  // Determine output format based on input
  const ext = contentType.includes('png') ? 'png'
            : contentType.includes('webp') ? 'webp'
            : 'jpg';

  for (const size of THUMBNAIL_SIZES) {
    try {
      let processor = sharp(imageBuffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        });

      // Apply format-specific options
      if (ext === 'png') {
        processor = processor.png({ quality: 80 });
      } else if (ext === 'webp') {
        processor = processor.webp({ quality: 80 });
      } else {
        processor = processor.jpeg({ quality: 80 });
      }

      const buffer = await processor.toBuffer();
      const filename = `${baseFilename}_${size}.${ext}`;

      results.push({
        size,
        buffer,
        filename,
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`
      });

      console.log(`✅ Generated ${size}px thumbnail: ${filename} (${buffer.length} bytes)`);
    } catch (error) {
      console.error(`❌ Failed to generate ${size}px thumbnail:`, error);
    }
  }

  return results;
}

/**
 * Generate thumbnails for an animated GIF
 * Sharp can resize GIFs while preserving animation
 */
export async function generateAnimatedGifThumbnails(
  gifBuffer: Buffer,
  baseFilename: string
): Promise<ThumbnailResult[]> {
  // Dynamic import of sharp to avoid build-time native module issues
  const sharp = (await import('sharp')).default;

  const results: ThumbnailResult[] = [];

  for (const size of THUMBNAIL_SIZES) {
    try {
      // Sharp supports animated GIF resizing with the animated option
      const buffer = await sharp(gifBuffer, { animated: true })
        .resize(size, size, {
          fit: 'cover',
          position: 'center'
        })
        .gif()
        .toBuffer();

      const filename = `${baseFilename}_${size}.gif`;

      results.push({
        size,
        buffer,
        filename,
        contentType: 'image/gif'
      });

      console.log(`✅ Generated ${size}px animated GIF thumbnail: ${filename} (${buffer.length} bytes)`);
    } catch (error) {
      console.error(`❌ Failed to generate ${size}px GIF thumbnail:`, error);

      // Fallback: extract first frame as static image
      try {
        const staticBuffer = await sharp(gifBuffer)
          .resize(size, size, {
            fit: 'cover',
            position: 'center'
          })
          .png()
          .toBuffer();

        const filename = `${baseFilename}_${size}.png`;

        results.push({
          size,
          buffer: staticBuffer,
          filename,
          contentType: 'image/png'
        });

        console.log(`⚠️ Generated ${size}px static fallback from GIF: ${filename}`);
      } catch (fallbackError) {
        console.error(`❌ Static fallback also failed for ${size}px:`, fallbackError);
      }
    }
  }

  return results;
}

/**
 * Generate a poster image from a video (first frame)
 * Note: This requires ffmpeg to be installed on the server
 * For Vercel deployment, we'll use a different approach -
 * generating poster client-side before upload
 */
export async function generateVideoPoster(
  videoBuffer: Buffer,
  baseFilename: string
): Promise<ThumbnailResult | null> {
  // Video poster generation requires ffmpeg which isn't available in Vercel
  // Instead, we'll handle this client-side or use a video processing service
  console.log('⚠️ Video poster generation not implemented server-side');
  return null;
}

/**
 * Main function to generate all thumbnails for an image
 */
export async function generateThumbnails(
  buffer: Buffer,
  originalFilename: string,
  contentType: string
): Promise<ThumbnailResult[]> {
  // Extract base filename without extension
  const baseFilename = originalFilename.replace(/\.[^.]+$/, '');

  // Check if it's a GIF
  if (contentType === 'image/gif') {
    const animated = await isAnimatedGif(buffer);
    if (animated) {
      console.log('🎬 Detected animated GIF, preserving animation in thumbnails');
      return generateAnimatedGifThumbnails(buffer, baseFilename);
    }
  }

  // Static image (JPG, PNG, WebP, or non-animated GIF)
  return generateStaticThumbnails(buffer, baseFilename, contentType);
}

/**
 * Get the thumbnail URL for a given size from a thumbnail set
 * Falls back to original if thumbnail not available
 */
export function getThumbnailUrl(
  thumbnailSet: ThumbnailSet | undefined,
  size: ThumbnailSize,
  fallbackUrl: string
): string {
  if (!thumbnailSet?.thumbnails?.[size]) {
    return fallbackUrl;
  }
  return thumbnailSet.thumbnails[size]!;
}

/**
 * Parse thumbnail URLs from cover_image_url field
 * Format: original URL with _64, _160, _256 variants
 */
export function parseThumbnailUrls(originalUrl: string): ThumbnailSet {
  if (!originalUrl) {
    return { original: '', thumbnails: {} };
  }

  // Extract base URL and extension
  const match = originalUrl.match(/^(.+)\.([a-z]+)$/i);
  if (!match) {
    return { original: originalUrl, thumbnails: {} };
  }

  const [, basePath, ext] = match;

  return {
    original: originalUrl,
    thumbnails: {
      64: `${basePath}_64.${ext}`,
      160: `${basePath}_160.${ext}`,
      256: `${basePath}_256.${ext}`
    }
  };
}
