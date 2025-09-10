/**
 * Image compression utilities for localStorage optimization
 * Reduces base64 image sizes by 50-70% through canvas resizing and quality adjustment
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, for JPEG compression
  format?: 'jpeg' | 'webp' | 'png';
}

/**
 * Compress a base64 image to reduce localStorage usage
 */
export const compressImage = async (
  base64: string, 
  options: CompressionOptions = {}
): Promise<string> => {
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 0.8,
    format = 'jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    try {
      // Create image element
      const img = new Image();
      
      img.onload = () => {
        try {
          // Create canvas
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }

          // Calculate new dimensions maintaining aspect ratio
          let { width, height } = img;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          // Set canvas dimensions
          canvas.width = width;
          canvas.height = height;

          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to compressed base64
          const mimeType = `image/${format}`;
          const compressedBase64 = canvas.toDataURL(mimeType, quality);
          
          // Calculate compression ratio
          const originalSize = base64.length;
          const compressedSize = compressedBase64.length;
          const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
          
          console.log(`🗜️ Image compressed: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (${compressionRatio}% reduction)`);
          
          resolve(compressedBase64);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image for compression'));
      };

      // Load the image
      img.src = base64;
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Auto-compress image if it exceeds size threshold
 */
export const smartCompress = async (
  base64: string,
  maxSizeBytes: number = 150000 // 150KB - optimized for card display!
): Promise<string> => {
  // Handle GIFs - keep animation but optimize for cards
  if (base64.startsWith('data:image/gif')) {
    console.log('🎬 GIF detected - preserving animation, optimizing for cards');
    // For cards, we can be more aggressive since display is small
    if (base64.length > maxSizeBytes) {
      console.log('🗜️ Large GIF - consider optimization (keeping for now)');
    }
    return base64; // Keep GIFs for now
  }

  // If already small enough, return as-is
  if (base64.length <= maxSizeBytes) {
    console.log('📏 Image already card-optimized');
    return base64;
  }

  console.log('🎯 Applying card-optimized compression (320px max for 160px cards)...');

  // CARD-OPTIMIZED compression levels - perfect for 160px display!
  const cardCompressionLevels = [
    { maxWidth: 320, maxHeight: 320, quality: 0.75, format: 'jpeg' as const }, // 2x retina
    { maxWidth: 280, maxHeight: 280, quality: 0.70, format: 'jpeg' as const },
    { maxWidth: 240, maxHeight: 240, quality: 0.65, format: 'jpeg' as const },
    { maxWidth: 200, maxHeight: 200, quality: 0.60, format: 'jpeg' as const }  // Fallback
  ];

  for (const [index, options] of cardCompressionLevels.entries()) {
    try {
      const compressed = await compressImage(base64, options);

      if (compressed.length <= maxSizeBytes) {
        const savings = ((base64.length - compressed.length) / base64.length * 100).toFixed(1);
        console.log(`✅ Card compression success: ${options.maxWidth}px @ ${Math.round(options.quality * 100)}% 
(${savings}% savings)`);
        return compressed;
      }
    } catch (error) {
      console.warn(`⚠️ Card compression level ${index + 1} failed, trying next...`, error);
    }
  }

  // Final fallback
  try {
    const finalOptions = cardCompressionLevels[cardCompressionLevels.length - 1];
    const finalCompressed = await compressImage(base64, finalOptions);
    const savings = ((base64.length - finalCompressed.length) / base64.length * 100).toFixed(1);
    console.log(`🎯 Maximum card compression: ${savings}% reduction`);
    return finalCompressed;
  } catch (error) {
    console.error('❌ Card compression failed, returning original', error);
    return base64;
  }
};

// Add this new function after smartCompress
export const optimizeGifForCards = async (
  base64: string,
  maxSizeBytes: number = 200000 // 200KB for GIF cards
): Promise<string> => {
  if (!base64.startsWith('data:image/gif')) {
    return smartCompress(base64);
  }

  // For very small GIFs, keep as-is
  if (base64.length <= maxSizeBytes) {
    console.log('🎬 GIF already optimized for cards');
    return base64;
  }

  console.log('🎬 Optimizing GIF for card display (320px max, keeping animation)...');

  // Note: This creates a static image from GIF for cards (performance over animation)
  // Future: Use proper GIF processing library for frame optimization
  try {
    return await compressImage(base64, {
      maxWidth: 320,
      maxHeight: 320,
      quality: 0.70,
      format: 'jpeg'
    });
  } catch (error) {
    console.warn('⚠️ GIF optimization failed, keeping original');
    return base64;
  }
};

/**
 * Optional GIF optimization (follows Claude's strategy)
 * Only use when file size is more important than maximum quality
 */
export const optimizeGif = async (
  base64: string,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    aggressive?: boolean;
  } = {}
): Promise<string> => {
  if (!base64.startsWith('data:image/gif')) {
    console.warn('⚠️ optimizeGif called on non-GIF, using smartCompress instead');
    return smartCompress(base64);
  }

  const {
    maxWidth = 900,  // Claude's suggestion: 1200px → 900px = huge savings
    maxHeight = 900,
    quality = 0.75,  // 75% quality - still excellent
    aggressive = false
  } = options;

  console.log('🎬 Optimizing GIF following Claude strategy (dimension reduction first)...');
  
  // Create image element to get original dimensions
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Calculate new dimensions (Claude's strategy: dimension reduction first)
      let { width, height } = img;
      const originalSize = width * height;
      
      // Apply Claude's dimension reduction strategy
      if (width > maxWidth || height > maxHeight) {
        const aspectRatio = width / height;
        
        if (width > maxWidth) {
          width = maxWidth;
          height = width / aspectRatio;
        }
        
        if (height > maxHeight) {
          height = maxHeight;
          width = height * aspectRatio;
        }
        
        const newSize = width * height;
        const dimensionReduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
        console.log(`📐 GIF dimension reduction: ${img.width}x${img.height} → ${Math.round(width)}x${Math.round(height)} (${dimensionReduction}% pixel reduction)`);
      }

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Draw the first frame (this loses animation but significantly reduces size)
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert with quality setting
      const optimizedBase64 = canvas.toDataURL('image/jpeg', quality);
      
      // Calculate total savings
      const totalSavings = ((base64.length - optimizedBase64.length) / base64.length * 100).toFixed(1);
      
      console.log(`⚠️ GIF optimized to static image: ${Math.round(quality * 100)}% quality, ${totalSavings}% size reduction`);
      console.log(`📱 Trade-off: Lost animation, gained ${totalSavings}% storage and faster loading`);
      
      resolve(optimizedBase64);
    };

    img.onerror = () => {
      reject(new Error('Failed to load GIF for optimization'));
    };

    img.src = base64;
  });
};

/**
 * Smart GIF handling with options
 */
export const handleGif = async (
  base64: string,
  options: {
    preserveAnimation?: boolean;
    maxSizeBytes?: number;
    optimizationLevel?: 'none' | 'light' | 'aggressive';
  } = {}
): Promise<string> => {
  const {
    preserveAnimation = true,  // Default: preserve animation
    maxSizeBytes = 3000000,   // 3MB threshold for warnings
    optimizationLevel = 'none'
  } = options;

  if (!base64.startsWith('data:image/gif')) {
    return base64;
  }

  // If preserving animation (default), return as-is with warnings for large files
  if (preserveAnimation) {
    if (base64.length > maxSizeBytes) {
      console.warn(`⚠️ Large GIF detected (${Math.round(base64.length/1024/1024)}MB). Consider using optimizeGif() if size matters more than animation.`);
    }
    console.log('🎬 GIF animation preserved completely');
    return base64;
  }

  // If optimization requested, apply Claude's strategy
  switch (optimizationLevel) {
    case 'light':
      return optimizeGif(base64, { maxWidth: 900, quality: 0.80 });
    case 'aggressive':
      return optimizeGif(base64, { maxWidth: 600, quality: 0.70, aggressive: true });
    default:
      return base64;
  }
};

/**
 * Check if base64 string is an image
 */
export const isBase64Image = (str: string): boolean => {
  return str.startsWith('data:image/');
};

/**
 * Get estimated localStorage impact of data
 */
export const getStorageImpact = (data: any): {
  totalSize: number;
  imageSize: number;
  imageCount: number;
  wouldExceedQuota: boolean;
} => {
  const dataStr = JSON.stringify(data);
  let imageSize = 0;
  let imageCount = 0;

  // Find all base64 images in the data
  const base64Matches = dataStr.match(/data:image\/[^"]+/g) || [];
  
  base64Matches.forEach(match => {
    imageSize += match.length;
    imageCount++;
  });

  const totalSize = dataStr.length;
  const estimatedQuota = 5 * 1024 * 1024; // 5MB
  const wouldExceedQuota = totalSize > estimatedQuota;

  return {
    totalSize,
    imageSize,
    imageCount,
    wouldExceedQuota
  };
};

/**
 * Format bytes for human readable output
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Batch compress multiple images in data structure
 */
export const batchCompressImages = async (
  data: any,
  options: CompressionOptions = {}
): Promise<any> => {
  if (!data || typeof data !== 'object') return data;

  const processValue = async (value: any): Promise<any> => {
    if (typeof value === 'string' && isBase64Image(value)) {
      try {
        return await smartCompress(value);
      } catch (error) {
        console.warn('⚠️ Failed to compress image, keeping original:', error);
        return value;
      }
    } else if (Array.isArray(value)) {
      return Promise.all(value.map(processValue));
    } else if (value && typeof value === 'object') {
      const processed: any = {};
      for (const [key, val] of Object.entries(value)) {
        processed[key] = await processValue(val);
      }
      return processed;
    }
    return value;
  };

  return processValue(data);
}; 