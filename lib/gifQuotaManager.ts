/**
 * GIF Quota Manager
 * Intelligently manages GIF storage to prevent localStorage quota exceeded errors
 */

import { StorageService } from '@/lib/storage';
import { STORAGE_KEYS } from '@/types';

export interface GifQuotaStatus {
  canAddGif: boolean;
  reason?: string;
  currentGifCount: number;
  maxRecommended: number;
  totalGifSize: number;
  availableSpace: number;
}

export class GifQuotaManager {
  private static readonly SECTION_GIF_LIMITS = {
    gallery: 3,    // MVP: 3 GIFs @ 600KB each (but allow larger for power users)
    spotlight: 3,  // Allow up to 3 GIFs for creative spotlight content
    shop: 0,       // No GIFs - static images only for products
    profile: 1     // MVP: 1 GIF @ 400KB
  };
  private static readonly MAX_TOTAL_GIFS = 6; // Total across all sections
  private static readonly LARGE_GIF_THRESHOLD = 1000000; // 1MB (more permissive)
  private static readonly SAFETY_BUFFER = 512 * 1024; // 512KB safety buffer (reduced)

  /**
   * Check if we can safely add another GIF without exceeding quota
   */
  static canAddGif(sectionType: string, newGifSize?: number, excludeSection?: string): GifQuotaStatus {
    const currentGifs = this.getAllGifsInStorage(excludeSection);
    const storageInfo = StorageService.getStorageInfo();
    
    const totalGifCount = currentGifs.filter(gif => gif.size > this.LARGE_GIF_THRESHOLD).length;
    const sectionGifCount = currentGifs.filter(gif => gif.section === sectionType && gif.size > this.LARGE_GIF_THRESHOLD).length;
    const totalGifSize = currentGifs.reduce((total, gif) => total + gif.size, 0);
    
    // Get section-specific limit
    const sectionLimit = this.SECTION_GIF_LIMITS[sectionType as keyof typeof this.SECTION_GIF_LIMITS] || 1;
    
    // Estimate new total if adding this GIF
    const estimatedNewSize = newGifSize ? totalGifSize + newGifSize : totalGifSize;
    const remainingSpace = storageInfo.available - this.SAFETY_BUFFER;
    
    // Check section-specific limit first
    if (sectionGifCount >= sectionLimit) {
      return {
        canAddGif: false,
        reason: `${sectionType} section allows maximum ${sectionLimit} GIF${sectionLimit > 1 ? 's' : ''}`,
        currentGifCount: totalGifCount,
        maxRecommended: this.MAX_TOTAL_GIFS,
        totalGifSize,
        availableSpace: remainingSpace
      };
    }
    
    // Check total limit across all sections
    if (totalGifCount >= this.MAX_TOTAL_GIFS) {
      return {
        canAddGif: false,
        reason: `Maximum ${this.MAX_TOTAL_GIFS} total GIFs recommended for stable storage`,
        currentGifCount: totalGifCount,
        maxRecommended: this.MAX_TOTAL_GIFS,
        totalGifSize,
        availableSpace: remainingSpace
      };
    }
    
    // Check available storage space
    if (newGifSize && newGifSize > remainingSpace) {
      return {
        canAddGif: false,
        reason: 'This GIF would exceed available storage space',
        currentGifCount: totalGifCount,
        maxRecommended: this.MAX_TOTAL_GIFS,
        totalGifSize,
        availableSpace: remainingSpace
      };
    }
    
    if (estimatedNewSize > remainingSpace) {
      return {
        canAddGif: false,
        reason: 'Total GIF storage would exceed safe limits',
        currentGifCount: totalGifCount,
        maxRecommended: this.MAX_TOTAL_GIFS,
        totalGifSize,
        availableSpace: remainingSpace
      };
    }
    
    return {
      canAddGif: true,
      currentGifCount: totalGifCount,
      maxRecommended: this.MAX_TOTAL_GIFS,
      totalGifSize,
      availableSpace: remainingSpace
    };
  }

  /**
   * Get all GIFs currently stored across all sections
   */
  private static getAllGifsInStorage(excludeSection?: string): Array<{ section: string; id: string; size: number }> {
    const gifs: Array<{ section: string; id: string; size: number }> = [];
    
    // Check each section for GIFs
    const sections = [
      { key: STORAGE_KEYS.SPOTLIGHT, name: 'spotlight' },
      { key: STORAGE_KEYS.GALLERY, name: 'gallery' },
      { key: STORAGE_KEYS.SHOP, name: 'shop' },
      { key: STORAGE_KEYS.PROFILE, name: 'profile' }
    ];
    
    sections.forEach(({ key, name }) => {
      // Skip the excluded section to avoid counting GIFs in the section being saved
      if (excludeSection && name === excludeSection) {
        return;
      }
      
      const items = StorageService.getItem(key, []);
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          if (item.image && typeof item.image === 'string' && item.image.startsWith('data:image/gif')) {
            gifs.push({
              section: name,
              id: item.id || 'unknown',
              size: item.image.length
            });
          }
        });
      } else if (items && typeof items === 'object' && 'image' in items) {
        // Handle profile object
        const item = items as any;
        if (item.image && typeof item.image === 'string' && item.image.startsWith('data:image/gif')) {
          gifs.push({
            section: name,
            id: 'profile',
            size: item.image.length
          });
        }
      }
    });
    
    return gifs;
  }

  /**
   * Get user-friendly recommendations for GIF management
   */
  static getGifRecommendations(): string[] {
    const status = this.canAddGif('gallery'); // Check against gallery (highest limit)
    const recommendations: string[] = [];
    
    if (status.currentGifCount >= this.MAX_TOTAL_GIFS) {
      recommendations.push('💡 Consider removing a GIF before adding another');
      recommendations.push('☁️ Or set up cloud storage for unlimited GIFs');
    } else if (status.currentGifCount >= 1) {
      const remaining = this.MAX_TOTAL_GIFS - status.currentGifCount;
      recommendations.push(`📊 ${remaining} more large GIF${remaining > 1 ? 's' : ''} recommended total`);
    }
    
    // Add section-specific recommendations
    const currentGifs = this.getAllGifsInStorage();
    const galleryGifs = currentGifs.filter(gif => gif.section === 'gallery').length;
    const spotlightGifs = currentGifs.filter(gif => gif.section === 'spotlight').length;
    const shopGifs = currentGifs.filter(gif => gif.section === 'shop').length;
    
    if (galleryGifs < this.SECTION_GIF_LIMITS.gallery) {
      recommendations.push(`🖼️ Gallery: ${this.SECTION_GIF_LIMITS.gallery - galleryGifs} more GIF${this.SECTION_GIF_LIMITS.gallery - galleryGifs > 1 ? 's' : ''} available`);
    }
    
    if (status.totalGifSize > 5 * 1024 * 1024) {
      recommendations.push('🗜️ Your GIFs are using significant storage space');
    }
    
    return recommendations;
  }

  /**
   * Format file size for display
   */
  static formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
} 