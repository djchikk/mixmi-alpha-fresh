/**
 * Section limits for MVP
 * 3 cards maximum per section with smart GIF distribution
 */

export interface SectionLimits {
  maxItems: number;
  maxGifs: number;
  maxStaticImages: number;
  maxGifSizeKB: number;
  maxImageSizeKB: number;
}

export const MVP_SECTION_LIMITS = {
  profile: {
    maxItems: 1,
    maxGifs: 1, // Profile can be a GIF for creative expression!
    maxStaticImages: 1, // Or a static image
    maxGifSizeKB: 400, // Slightly larger for main profile
    maxImageSizeKB: 300
  },
  spotlight: {
    maxItems: 3,
    maxGifs: 0, // No GIFs allowed - static images only
    maxStaticImages: 3, // All items must be static images
    maxGifSizeKB: 0, // No GIFs
    maxImageSizeKB: 250
  },
  shop: {
    maxItems: 3,
    maxGifs: 0, // No GIFs allowed - static images only
    maxStaticImages: 3, // All items must be static images
    maxGifSizeKB: 0, // No GIFs
    maxImageSizeKB: 250
  },
  gallery: {
    maxItems: 3,
    maxGifs: 3, // Gallery is for creative GIF showcase
    maxStaticImages: 0, // Gallery is GIF-only for MVP
    maxGifSizeKB: 600, // Slightly smaller for gallery since more GIFs
    maxImageSizeKB: 200
  },
  media: {
    maxItems: 6, // URLs only, no storage impact
    maxGifs: 0,
    maxStaticImages: 0,
    maxGifSizeKB: 0,
    maxImageSizeKB: 0
  },
  sticker: {
    maxItems: 1,
    maxGifs: 1, // Sticker can be a GIF for fun animations
    maxStaticImages: 1, // Or a static image
    maxGifSizeKB: 400, // Similar to profile
    maxImageSizeKB: 200
  }
} as const;

export type SectionType = keyof typeof MVP_SECTION_LIMITS;

/**
 * Check if adding an item would exceed section limits
 */
export function canAddToSection(
  sectionType: SectionType,
  currentItems: any[],
  newItemType: 'gif' | 'image' | 'url'
): { canAdd: boolean; reason?: string } {
  const limits = MVP_SECTION_LIMITS[sectionType];
  
  // Check total items limit
  if (currentItems.length >= limits.maxItems) {
    return {
      canAdd: false,
      reason: `Maximum ${limits.maxItems} items allowed in ${sectionType} section`
    };
  }
  
  // Count current GIFs and images
  const currentGifs = currentItems.filter(item => 
    item.image && item.image.startsWith('data:image/gif')
  ).length;
  
  const currentImages = currentItems.filter(item => 
    item.image && item.image.startsWith('data:image/') && !item.image.startsWith('data:image/gif')
  ).length;
  
  // Check GIF limits
  if (newItemType === 'gif' && currentGifs >= limits.maxGifs) {
    return {
      canAdd: false,
      reason: `Maximum ${limits.maxGifs} GIF${limits.maxGifs > 1 ? 's' : ''} allowed in ${sectionType} section`
    };
  }
  
  // Check static image limits
  if (newItemType === 'image' && currentImages >= limits.maxStaticImages) {
    return {
      canAdd: false,
      reason: `Maximum ${limits.maxStaticImages} static image${limits.maxStaticImages > 1 ? 's' : ''} allowed in ${sectionType} section`
    };
  }
  
  return { canAdd: true };
}

/**
 * Get compression target for section and file type
 */
export function getCompressionTarget(
  sectionType: SectionType,
  isGif: boolean
): number {
  const limits = MVP_SECTION_LIMITS[sectionType];
  return isGif ? limits.maxGifSizeKB * 1024 : limits.maxImageSizeKB * 1024;
}

/**
 * Get user-friendly limit description
 */
export function getSectionLimitDescription(sectionType: SectionType): string {
  const limits = MVP_SECTION_LIMITS[sectionType];
  
  if (sectionType === 'media') {
    return `Up to ${limits.maxItems} media links (YouTube, Spotify, etc.)`;
  }
  
  if (sectionType === 'profile') {
    return 'One profile image (GIF or static image)';
  }
  
  let description = `Up to ${limits.maxItems} items`;
  
  if (limits.maxGifs > 0 && limits.maxStaticImages > 0) {
    description += ` (${limits.maxGifs} GIF${limits.maxGifs > 1 ? 's' : ''} + ${limits.maxStaticImages} image${limits.maxStaticImages > 1 ? 's' : ''})`;
  } else if (limits.maxGifs > 0) {
    description += ` (${limits.maxGifs} GIF${limits.maxGifs > 1 ? 's' : ''} max)`;
  } else if (limits.maxStaticImages > 0) {
    description += ` (${limits.maxStaticImages} image${limits.maxStaticImages > 1 ? 's' : ''} max)`;
  }
  
  return description;
} 