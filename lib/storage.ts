import { STORAGE_KEYS } from "@/types";
import { batchCompressImages, getStorageImpact, formatBytes } from "@/lib/imageUtils";

// Add validation helpers
const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

// Check if data would exceed localStorage quota
const getStorageSize = (): number => {
  let total = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      total += localStorage[key].length;
    }
  }
  return total;
};

const estimateStorageAfterSave = (key: string, value: string): number => {
  const currentSize = getStorageSize();
  const existingItemSize = localStorage.getItem(key)?.length || 0;
  return currentSize - existingItemSize + value.length;
};

export const StorageService = {
  getItem: <T,>(key: string, fallback: T): T => {
    if (typeof window === "undefined") return fallback;
    
    try {
      const item = localStorage.getItem(key);
      if (!item) return fallback;
      if (!isValidJSON(item)) return fallback;
      
      return JSON.parse(item) as T;
    } catch (error) {
      console.error(`Error retrieving ${key} from storage:`, error);
      return fallback;
    }
  },
  
  setItem: <T,>(key: string, value: T): boolean => {
    if (typeof window === "undefined") return false;
    
    try {
      // Pre-analyze storage impact
      const impact = getStorageImpact(value);
      
      if (impact.imageCount > 0) {
        console.log(`📊 Storage analysis: ${impact.imageCount} images, ${formatBytes(impact.imageSize)} image data, ${formatBytes(impact.totalSize)} total`);
      }
      
      // If we have images and the data is large, try compression first
      if (impact.wouldExceedQuota && impact.imageCount > 0) {
        console.log('🗜️ Data may exceed quota, applying compression...');
        
        // Apply compression asynchronously
        batchCompressImages(value).then(compressedValue => {
          const compressedStr = JSON.stringify(compressedValue);
          try {
            localStorage.setItem(key, compressedStr);
            console.log('✅ Saved compressed version successfully');
          } catch (error) {
            console.error('❌ Even compressed version failed:', error);
          }
        }).catch(error => {
          console.error('❌ Compression failed:', error);
        });
        
        // For now, continue with fallback logic below
      }
      
      const valueStr = JSON.stringify(value);
      
      // Check if this would exceed localStorage quota (roughly 5-10MB in most browsers)
      const estimatedSize = estimateStorageAfterSave(key, valueStr);
      const QUOTA_LIMIT = 5 * 1024 * 1024; // 5MB conservative estimate
      
      if (estimatedSize > QUOTA_LIMIT) {
        console.warn(`⚠️ localStorage quota likely to be exceeded. Estimated size: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
        
        // Try to save anyway, but catch quota exceeded
        try {
          localStorage.setItem(key, valueStr);
          return true;
        } catch (quotaError: unknown) {
          if (quotaError instanceof Error && quotaError.name === 'QuotaExceededError') {
            console.error(`❌ localStorage quota exceeded for ${key}. Consider using Supabase storage for large images.`);
            
            // Try to clear some space and retry
            if (key === STORAGE_KEYS.SPOTLIGHT || key === STORAGE_KEYS.SHOP || key === STORAGE_KEYS.GALLERY) {
              console.log('🧹 Attempting to clear image data from localStorage to make space...');
              
              // Create a version without base64 images for localStorage
              const cleanedValue = StorageService.removeBase64Images(value);
              const cleanedStr = JSON.stringify(cleanedValue);
              
              try {
                localStorage.setItem(key, cleanedStr);
                console.log('✅ Saved cleaned version without base64 images');
                return true;
              } catch (secondError) {
                console.error(`❌ Even cleaned version failed to save:`, secondError);
                return false;
              }
            }
          }
          throw quotaError;
        }
      }
      
      localStorage.setItem(key, valueStr);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.error(`❌ localStorage quota exceeded for ${key}:`, error);
      } else {
        console.error(`Error saving ${key} to storage:`, error);
      }
      return false;
    }
  },
  
  // Helper method to remove base64 images from data
  removeBase64Images: <T,>(data: T): T => {
    if (!data || typeof data !== 'object') return data;
    
    try {
      const cleaned = JSON.parse(JSON.stringify(data));
      
      const removeBase64FromObject = <T,>(obj: T): T => {
        if (Array.isArray(obj)) {
          return obj.map(removeBase64FromObject) as T;
        } else if (obj && typeof obj === 'object' && obj !== null) {
          const newObj = { ...obj } as Record<string, unknown>;
          
          // Replace base64 images with placeholder paths
          if (newObj.image && typeof newObj.image === 'string' && newObj.image.startsWith('data:image/')) {
            // Keep the original path structure but use placeholders
            if (newObj.id && newObj.id.includes('spotlight')) {
              const itemNum = newObj.id.includes('001') ? '1' : newObj.id.includes('002') ? '2' : '3';
              newObj.image = `/placeholders/spotlight/spotlight-item-${itemNum}.jpeg`;
            } else if (newObj.id && newObj.id.includes('shop')) {
              const itemNum = newObj.id.includes('001') ? '1' : newObj.id.includes('002') ? '2' : '3';
              newObj.image = `/placeholders/shop/product-${itemNum}.jpeg`;
            } else if (newObj.id && newObj.id.includes('gallery')) {
              const itemNum = newObj.id.includes('001') ? '1' : newObj.id.includes('002') ? '2' : '3';
              newObj.image = `/placeholders/gallery/gallery-item-${itemNum}.gif`;
            } else {
              // Generic fallback
              newObj.image = '/placeholders/profile/profile-image.jpeg';
            }
            console.log(`🔧 Replaced base64 image with placeholder: ${newObj.image}`);
          }
          
          // Recursively clean nested objects
          Object.keys(newObj).forEach(key => {
            newObj[key] = removeBase64FromObject(newObj[key]);
          });
          
          return newObj as T;
        }
        return obj;
      };
      
      return removeBase64FromObject(cleaned);
    } catch (error) {
      console.error('Error cleaning base64 images:', error);
      return data;
    }
  },
  
  removeItem: (key: string): boolean => {
    if (typeof window === "undefined") return false;
    
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing ${key} from storage:`, error);
      return false;
    }
  },
  
  // Get current storage usage info
  getStorageInfo: () => {
    if (typeof window === "undefined") return { used: 0, available: 0, percentage: 0 };
    
    const used = getStorageSize();
    const estimated = 5 * 1024 * 1024; // 5MB estimate
    return {
      used,
      available: estimated - used,
      percentage: (used / estimated) * 100
    };
  }
}; 