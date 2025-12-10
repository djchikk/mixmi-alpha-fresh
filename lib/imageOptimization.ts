/**
 * Image Optimization Utilities
 *
 * Uses pre-generated thumbnails when available, falling back to
 * Supabase image transformations only for legacy content.
 *
 * Thumbnail sizes: 64px (tiny mixer), 160px (cards), 256px (big mixer decks)
 */

export type ImageSize = 64 | 160 | 256 | 320 | 512;

// Map requested sizes to available thumbnail sizes
const SIZE_MAP: Record<ImageSize, 64 | 160 | 256> = {
  64: 64,
  160: 160,
  256: 256,
  320: 256, // Use 256 for 320px requests
  512: 256  // Use 256 for 512px requests (upscale is ok for large displays)
};

/**
 * Track object with optional thumbnail URLs
 */
interface TrackWithThumbnails {
  cover_image_url?: string;
  imageUrl?: string;
  thumb_64_url?: string;
  thumb_160_url?: string;
  thumb_256_url?: string;
  [key: string]: any;
}

/**
 * Gets the appropriate thumbnail URL for a track based on requested size
 * Priority:
 * 1. Pre-generated thumbnail at the requested size
 * 2. Fallback to original image (no transformation - saves quota)
 *
 * @param track - Track object with thumbnail URLs
 * @param targetSize - Display size (64, 160, 256, 320, or 512)
 * @returns Best available image URL
 */
export function getOptimizedTrackImage(
  track: TrackWithThumbnails | null | undefined,
  targetSize: ImageSize
): string {
  if (!track) return '';

  const thumbnailSize = SIZE_MAP[targetSize];
  const originalUrl = track.cover_image_url || track.imageUrl || '';

  // Check for pre-generated thumbnail at the appropriate size
  if (thumbnailSize === 64 && track.thumb_64_url) {
    return track.thumb_64_url;
  }
  if (thumbnailSize === 160 && track.thumb_160_url) {
    return track.thumb_160_url;
  }
  if (thumbnailSize === 256 && track.thumb_256_url) {
    return track.thumb_256_url;
  }

  // No pre-generated thumbnail available
  // For legacy content, return original URL without transformation
  // This saves quota - users will see full-size images for old content
  // until we run the backfill script
  return originalUrl;
}

/**
 * Optimizes an image URL for display at a specific size
 * DEPRECATED: Use getOptimizedTrackImage() instead when you have track data
 *
 * This function is kept for backwards compatibility but no longer
 * uses Supabase transformations to avoid quota issues.
 *
 * @param imageUrl - Original image URL
 * @param targetSize - Display size (unused - returns original)
 * @returns Original URL without transformation
 */
export function optimizeImageUrl(imageUrl: string | undefined, targetSize: ImageSize): string {
  if (!imageUrl) return '';

  // No longer apply transformations - return original URL
  // Pre-generated thumbnails should be used via getOptimizedTrackImage()
  return imageUrl;
}

/**
 * Helper to check if a track has pre-generated thumbnails
 */
export function hasThumbnails(track: TrackWithThumbnails | null | undefined): boolean {
  if (!track) return false;
  return !!(track.thumb_64_url || track.thumb_160_url || track.thumb_256_url);
}

/**
 * Get all available thumbnail URLs for a track
 */
export function getThumbnailUrls(track: TrackWithThumbnails | null | undefined): {
  original: string;
  thumb_64?: string;
  thumb_160?: string;
  thumb_256?: string;
} {
  if (!track) {
    return { original: '' };
  }

  return {
    original: track.cover_image_url || track.imageUrl || '',
    thumb_64: track.thumb_64_url,
    thumb_160: track.thumb_160_url,
    thumb_256: track.thumb_256_url
  };
}
