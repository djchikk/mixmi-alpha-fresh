/**
 * Image Optimization Utilities
 *
 * Adds responsive image sizing to Supabase Storage URLs to improve performance
 */

export type ImageSize = 64 | 160 | 256 | 320 | 512;

/**
 * Optimizes an image URL for display at a specific size
 * Adds query parameters to request appropriately sized images from Supabase Storage
 *
 * @param imageUrl - Original image URL (cover_image_url or imageUrl)
 * @param targetSize - Display size (64px for tiny mixer, 160px for cards, 256px for big mixer decks, 320px for compact cards, 512px for modals)
 * @returns Optimized URL with size parameters, or original if no URL provided
 */
export function optimizeImageUrl(imageUrl: string | undefined, targetSize: ImageSize): string {
  if (!imageUrl) return '';

  // Already optimized? Return as-is
  if (imageUrl.includes('width=') || imageUrl.includes('&width=')) {
    return imageUrl;
  }

  // Only apply transformations to Supabase Storage URLs
  // Supabase uses /render/image/public/ endpoint for transformations
  if (imageUrl.includes('supabase.co/storage/v1/object/public/')) {
    // Convert public URL to render URL for transformations
    const transformedUrl = imageUrl.replace(
      '/storage/v1/object/public/',
      `/storage/v1/render/image/public/`
    );
    return `${transformedUrl}?width=${targetSize}&height=${targetSize}&resize=cover`;
  }

  // For non-Supabase images, return original
  return imageUrl;
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