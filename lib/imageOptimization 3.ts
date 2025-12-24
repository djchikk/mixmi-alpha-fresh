/**
 * Image Optimization Utilities
 *
 * Adds responsive image sizing to Supabase Storage URLs to improve performance
 */

export type ImageSize = 64 | 160 | 320;

/**
 * Optimizes an image URL for display at a specific size
 * Adds query parameters to request appropriately sized images from Supabase Storage
 *
 * @param imageUrl - Original image URL (cover_image_url or imageUrl)
 * @param targetSize - Display size (64px for crate, 160px for cards, 320px for modals)
 * @returns Optimized URL with size parameters, or original if no URL provided
 */
export function optimizeImageUrl(imageUrl: string | undefined, targetSize: ImageSize): string {
  if (!imageUrl) return '';

  // Already optimized? Return as-is
  if (imageUrl.includes('&w=') || imageUrl.includes('?w=')) {
    return imageUrl;
  }

  // Add responsive sizing params
  // Note: Actual transformation depends on Supabase Storage configuration
  const separator = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${separator}w=${targetSize}&h=${targetSize}&fit=cover`;
}

/**
 * Gets the appropriate image URL from a track object with optimization
 * Handles both cover_image_url and imageUrl field names
 */
export function getOptimizedTrackImage(
  track: any,
  targetSize: ImageSize
): string {
  const imageUrl = track.cover_image_url || track.imageUrl;
  return optimizeImageUrl(imageUrl, targetSize);
}