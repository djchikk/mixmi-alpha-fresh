/**
 * Power User Storage Manager
 * Implements smart multi-tier storage strategy for users who want to upload lots of GIFs
 */

import { StorageService } from '@/lib/storage';
import { smartCompress, formatBytes, getStorageImpact } from '@/lib/imageUtils';
import { getCompressionTarget, SectionType } from '@/lib/sectionLimits';
import { GifQuotaManager } from '@/lib/gifQuotaManager';
import { getSupabaseAdmin, getSupabaseClient, isSupabaseAvailable } from '@/lib/supabase';
import { STORAGE_KEYS } from '@/types';
import { compressImage } from './imageUtils';
import SupabaseAuthBridge from './auth/supabase-auth-bridge';
import { MVP_SECTION_LIMITS } from './sectionLimits';

export interface StorageStrategy {
  mode: 'auto' | 'local-only' | 'cloud-first';
  compressionLevel: 'high' | 'medium' | 'low';
  maxItemsPerSection: number;
}

export interface PowerUserStorageStatus {
  localStorage: {
    used: number;
    available: number;
    percentage: number;
    nearLimit: boolean;
  };
  cloudStorage: {
    available: boolean;
    configured: boolean;
  };
  recommendation: 'continue' | 'compress-more' | 'upgrade-to-cloud' | 'remove-items';
  message: string;
}

export interface PowerUserUploadResult {
  success: boolean;
  data?: string;
  url?: string;
  size?: number;
  error?: string;
  warning?: string;
  isLargeGif?: boolean;
  usedCloudStorage?: boolean;
}

export interface StorageStatus {
  totalUsed: number;
  percentUsed: number;
  isNearLimit: boolean;
  sections: {
    [key: string]: {
      count: number;
      size: number;
      limit: number;
    };
  };
}

export class PowerUserStorage {
  private static readonly LOCAL_STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB conservative
  private static readonly WARNING_THRESHOLD = 0.8; // 80%
  private static readonly CRITICAL_THRESHOLD = 0.95; // 95%

  /**
   * Upload large content to Supabase Storage
   */
  static async uploadToSupabase(
    key: string,
    value: string | File,
    metadata: { type: string; size: number }
  ): Promise<{ url: string; success: boolean }> {
    try {
      console.log('🌤️ Attempting Supabase upload...');
      console.log('🔧 Debug - isSupabaseAvailable():', isSupabaseAvailable());
      
      // Check if Supabase is available
      if (!isSupabaseAvailable()) {
        console.log('❌ Supabase not available, using localStorage only');
        return { url: '', success: false };
      }

      const adminClient = getSupabaseAdmin();
      const regularClient = getSupabaseClient();
      console.log('🔧 Debug clients:', { admin: !!adminClient, regular: !!regularClient });
      
      const client = adminClient || regularClient;
      if (!client) {
        console.log('❌ No Supabase client available');
        return { url: '', success: false };
      }
      
      console.log('✅ Supabase client available, proceeding with upload');

      // Handle File objects directly (streaming upload)
      if (value instanceof File) {
        console.log('📁 Processing File object for streaming upload');
        
        // Only handle GIFs for now
        if (!value.type.includes('gif')) {
          console.log('❌ Non-GIF File objects not supported yet');
          return { url: '', success: false };
        }

        // Extract user ID from the key (e.g., "profile_userId_data")
        const userId = 'anonymous'; // For MVP, using anonymous storage
        
        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${userId}/gifs/${timestamp}_${Math.random().toString(36).substring(7)}.gif`;

        console.log(`📤 Uploading File directly to Supabase: ${filename} (${metadata.size} bytes)`);
        
        // Upload File directly to Supabase Storage
        const { data, error } = await client.storage
          .from('user-content')
          .upload(filename, value, {
            contentType: metadata.type,
            upsert: true,
            cacheControl: '3600',
          });

        if (error) {
          console.error('🚨 Supabase File upload error:', error);
          console.error('🚨 Error details:', JSON.stringify(error, null, 2));
          return { url: '', success: false };
        }
        
        console.log('📤 File upload successful, getting public URL...');

        // Get public URL
        const { data: { publicUrl } } = client.storage
          .from('user-content')
          .getPublicUrl(filename);

        console.log('✅ File uploaded to Supabase:', publicUrl.substring(0, 50) + '...');
        return { url: publicUrl, success: true };
      }

      // Handle base64 strings (original logic)
      if (typeof value === 'string') {
        console.log('📄 Processing base64 string');
        
        // Only handle GIFs for now
        if (!value.startsWith('data:image/gif')) {
          return { url: '', success: false };
        }

        // Extract user ID from the key (e.g., "profile_userId_data")
        const userId = 'anonymous'; // For MVP, using anonymous storage
        
        // Convert base64 to blob for GIFs
        const base64Data = value.split(',')[1] || value;
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: metadata.type });

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${userId}/gifs/${timestamp}_${Math.random().toString(36).substring(7)}.gif`;

        console.log(`📤 Uploading base64 to Supabase: ${filename} (${metadata.size} bytes)`);
        
        // Upload to Supabase Storage
        const { data, error } = await client.storage
          .from('user-content')
          .upload(filename, blob, {
            contentType: metadata.type,
            upsert: true,
            cacheControl: '3600',
          });

        if (error) {
          console.error('🚨 Supabase upload error:', error);
          console.error('🚨 Error details:', JSON.stringify(error, null, 2));
          return { url: '', success: false };
        }
        
        console.log('📤 Upload successful, getting public URL...');

        // Get public URL
        const { data: { publicUrl } } = client.storage
          .from('user-content')
          .getPublicUrl(filename);

        console.log('✅ Uploaded to Supabase:', publicUrl.substring(0, 50) + '...');
        return { url: publicUrl, success: true };
      }

      console.log('❌ Unsupported value type for upload');
      return { url: '', success: false };
    } catch (error) {
      console.error('❌ Failed to upload to Supabase:', error);
      return { url: '', success: false };
    }
  }

  private static lastAvailabilityCheck = 0;
  private static availabilityCache: { hasSupabaseConfig: boolean; available: boolean } | null = null;

  /**
   * Check current storage status and provide recommendations
   */
  static getStorageStatus(): PowerUserStorageStatus {
    const storageInfo = StorageService.getStorageInfo();
    const percentage = storageInfo.percentage / 100;
    const nearLimit = percentage > this.WARNING_THRESHOLD;
    
    // Check if Supabase is actually available (not just configured) - cache for 5 seconds
    const now = Date.now();
    if (!this.availabilityCache || now - this.lastAvailabilityCheck > 5000) {
      const hasSupabaseConfig = isSupabaseAvailable();
      this.availabilityCache = { hasSupabaseConfig, available: isSupabaseAvailable() };
      this.lastAvailabilityCheck = now;
      console.log('📊 Supabase availability check:', this.availabilityCache);
    }

    const hasSupabaseConfig = this.availabilityCache?.hasSupabaseConfig || false;

    let recommendation: PowerUserStorageStatus['recommendation'] = 'continue';
    let message = 'Storage usage is healthy';

    if (percentage > this.CRITICAL_THRESHOLD) {
      recommendation = hasSupabaseConfig ? 'upgrade-to-cloud' : 'remove-items';
      message = hasSupabaseConfig 
        ? 'Storage almost full. Consider moving large files to cloud storage?'
        : 'Storage almost full. Consider removing some items or compress further.';
    } else if (percentage > this.WARNING_THRESHOLD) {
      recommendation = 'compress-more';
      message = 'Storage getting full. Applying higher compression to new uploads.';
    }

    return {
      localStorage: {
        used: storageInfo.used,
        available: storageInfo.available,
        percentage: storageInfo.percentage,
        nearLimit
      },
      cloudStorage: {
        available: hasSupabaseConfig,
        configured: hasSupabaseConfig
      },
      recommendation,
      message
    };
  }

  /**
   * Smart save with automatic tier selection and section-aware compression
   */
  static async saveWithStrategy<T>(
    key: string, 
    data: T, 
    strategy: StorageStrategy = { mode: 'auto', compressionLevel: 'medium', maxItemsPerSection: 3 },
    sectionType?: SectionType
  ): Promise<{ success: boolean; usedCloud: boolean; error?: string; message?: string }> {
    
    const status = this.getStorageStatus();
    
    // Check GIF quota limits before processing
    if (sectionType && (sectionType === 'gallery' || sectionType === 'spotlight' || sectionType === 'shop' || sectionType === 'profile')) {
      const dataStr = JSON.stringify(data);
      const hasGifs = dataStr.includes('data:image/gif');
      const hasCloudUrls = dataStr.includes('supabase.co/storage/');
      
      // Skip quota check if we have cloud URLs - they don't count toward localStorage quota
      if (hasCloudUrls) {
        console.log('☁️ Cloud URLs detected - skipping GIF quota check');
      } else if (hasGifs) {
        // Calculate the total size of GIFs in this data to pass to quota manager
        let totalGifSize = 0;
        const gifMatches = dataStr.match(/data:image\/gif[^"]+/g);
        if (gifMatches) {
          totalGifSize = gifMatches.reduce((total, gif) => total + gif.length, 0);
        }
        
        console.log(`📊 Calculated GIF size for quota check: ${Math.round(totalGifSize/1024)}KB`);
        
        // For quota checking, exclude the current section being saved to avoid rejecting re-saves
        // Pass the actual GIF size so quota manager can make accurate calculations
        const gifStatus = GifQuotaManager.canAddGif(sectionType, totalGifSize, sectionType);
        if (!gifStatus.canAddGif) {
          console.warn('🎬 GIF quota limit reached:', gifStatus.reason);
          const recommendations = GifQuotaManager.getGifRecommendations();
          recommendations.forEach(rec => console.warn(rec));
          
          // Save without GIFs but preserve text content
          const cleanedData = StorageService.removeBase64Images(data);
          const cleanSaveSuccess = StorageService.setItem(key, cleanedData);
          
          if (cleanSaveSuccess) {
            return {
              success: true,
              usedCloud: false,
              message: 'GIF limit reached. Text content saved, GIFs preserved in memory only.',
              error: `${gifStatus.reason}. Consider removing a GIF or setting up cloud storage.`
            };
          }
        } else {
          console.log('✅ GIF quota check passed - proceeding with save');
        }
      }
    }

    // Apply section-aware compression
    let processedData = data;
    try {
      console.log('🗜️ Applying section-aware compression...');
      processedData = await this.applySectionCompression(data, sectionType);
    } catch (error) {
      console.warn('⚠️ Section compression failed, applying fallback:', error);
      // Fallback to aggressive compression if section-aware fails
      if (status.localStorage.nearLimit && strategy.compressionLevel !== 'low') {
        try {
          processedData = await this.applyAggressiveCompression(data);
        } catch (fallbackError) {
          console.warn('⚠️ Fallback compression also failed:', fallbackError);
        }
      }
    }

    // Check if this would exceed practical limits before attempting save
    const dataStr = JSON.stringify(processedData);
    const estimatedSize = dataStr.length;
    const currentStorage = StorageService.getStorageInfo();
    
    // Skip size check if data contains cloud URLs - they're lightweight
    const hasCloudUrls = dataStr.includes('supabase.co/storage/');
    
    if (estimatedSize > currentStorage.available && !hasCloudUrls) {
      console.warn('📊 Data would exceed localStorage quota, attempting cloud storage first...');
      console.log('📊 Supabase available for cloud storage:', isSupabaseAvailable());
      
      // Try cloud storage first if available
      if (isSupabaseAvailable() && strategy.mode !== 'local-only') {
        console.log('☁️ Attempting cloud storage for large data...');
        
        try {
          // Process data to upload large GIFs to Supabase and replace with URLs
          const cloudProcessedData = await this.processDataForCloudStorage(processedData, key);
          const cloudSaveSuccess = StorageService.setItem(key, cloudProcessedData);
          
          if (cloudSaveSuccess) {
            console.log('✅ Successfully saved with cloud storage!');
            return {
              success: true,
              usedCloud: true,
              message: 'Large GIFs moved to cloud storage. Text content saved locally.',
            };
          }
        } catch (error) {
          console.error('❌ Cloud storage failed:', error);
        }
      }
      
      // Fallback: For sections with GIFs, keep text content and use placeholder paths for large images
      if (key === STORAGE_KEYS.GALLERY || key === STORAGE_KEYS.SPOTLIGHT || key === STORAGE_KEYS.SHOP || key === STORAGE_KEYS.PROFILE) {
        const cleanedData = StorageService.removeBase64Images(processedData);
        const cleanSaveSuccess = StorageService.setItem(key, cleanedData);
        
        if (cleanSaveSuccess) {
          return {
            success: true,
            usedCloud: false,
            message: 'Large GIFs preserved in memory. Text content saved to localStorage.',
            error: 'Some images too large for localStorage - preserved as placeholders'
          };
        }
      }
    }

    // Try localStorage with processed data
    const localSaveSuccess = StorageService.setItem(key, processedData);
    
    if (localSaveSuccess) {
      return { 
        success: true, 
        usedCloud: false, 
        message: 'Saved to local storage successfully' 
      };
    }

    // If localStorage failed and cloud is available, try cloud
    if (status.cloudStorage.available && strategy.mode !== 'local-only') {
      console.log('☁️ Local storage full, attempting cloud storage...');
      console.log('📊 Cloud storage available:', status.cloudStorage.available);
      console.log('📊 Supabase available:', isSupabaseAvailable());
      
      try {
        // Process data to upload large GIFs to Supabase and replace with URLs
        const cloudProcessedData = await this.processDataForCloudStorage(processedData, key);
        const cloudSaveSuccess = StorageService.setItem(key, cloudProcessedData);
        
        if (cloudSaveSuccess) {
          return {
            success: true,
            usedCloud: true,
            message: 'Large GIFs moved to cloud storage. Text content saved locally.',
          };
        }
      } catch (error) {
        console.error('❌ Cloud storage attempt failed:', error);
        
        // Fallback: save without large images
        const cleanedData = this.removeImagesForLocalStorage(processedData);
        const cleanSaveSuccess = StorageService.setItem(key, cleanedData);
        
        if (cleanSaveSuccess) {
          return {
            success: true,
            usedCloud: false,
            message: 'Storage full. Saved text content only.',
            error: 'Cloud storage failed - saved without large images'
          };
        }
      }
    }

    return {
      success: false,
      usedCloud: false,
      error: 'Storage quota exceeded and no cloud storage available'
    };
  }

  /**
   * Apply section-specific compression based on MVP limits
   */
  private static async applySectionCompression<T>(data: T, sectionType?: SectionType): Promise<T> {
    if (!data || typeof data !== 'object' || !sectionType) {
      return data; // No section type provided, return unchanged
    }

    const processValue = async (value: any): Promise<any> => {
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        try {
          const isGif = value.startsWith('data:image/gif');
          const targetSize = getCompressionTarget(sectionType, isGif);
          return await smartCompress(value, targetSize);
        } catch (error) {
          console.warn('⚠️ Section-specific compression failed:', error);
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
  }

  /**
   * Apply more aggressive compression when approaching limits
   */
  private static async applyAggressiveCompression<T>(data: T): Promise<T> {
    if (!data || typeof data !== 'object') return data;

    const processValue = async (value: any): Promise<any> => {
      if (typeof value === 'string' && value.startsWith('data:image/')) {
        try {
          // More aggressive compression for near-limit scenarios
          return await smartCompress(value, 200000); // 200KB max
        } catch (error) {
          console.warn('⚠️ Aggressive compression failed:', error);
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
  }

  /**
   * Process data for cloud storage by uploading large GIFs to Supabase
   */
  private static async processDataForCloudStorage<T>(data: T, key: string): Promise<T> {
    if (!data || typeof data !== 'object') return data;

    // Add specific debugging for profile images
    if (key === STORAGE_KEYS.PROFILE) {
      console.log('🔧 Processing profile data for cloud storage:', {
        hasImage: !!(data as any)?.image,
        imageType: (data as any)?.image?.startsWith('data:image/') ? 'base64' : 'not base64',
        imageSize: (data as any)?.image?.length ? `${Math.round((data as any).image.length/1024)}KB` : 'no size'
      });
    }

    const processValue = async (value: any): Promise<any> => {
      if (typeof value === 'string' && value.startsWith('data:image/gif')) {
        // Estimate size
        const sizeInBytes = Math.ceil(value.length * 0.75); // Base64 to binary conversion
        
        console.log(`🔧 Found GIF for cloud processing: ${Math.round(sizeInBytes/1024)}KB`);
        
        // Only upload large GIFs (>1MB) to cloud storage
        if (sizeInBytes > 1024 * 1024) {
          console.log(`☁️ Attempting cloud upload for large GIF (${Math.round(sizeInBytes/1024)}KB)...`);
          const uploadResult = await this.uploadToSupabase(key, value, {
            type: 'image/gif',
            size: sizeInBytes
          });
          
          if (uploadResult.success && uploadResult.url) {
            console.log('🌤️ Replaced large GIF with cloud URL');
            return uploadResult.url;
          } else {
            console.warn('⚠️ Cloud upload failed, keeping original GIF');
          }
        }
        
        return value; // Keep original if upload failed or file is small
      } else if (Array.isArray(value)) {
        return Promise.all(value.map(processValue));
      } else if (value && typeof value === 'object') {
        const processed: any = {};
        for (const [propKey, val] of Object.entries(value)) {
          processed[propKey] = await processValue(val);
        }
        return processed;
      }
      return value;
    };

    return processValue(data);
  }

  /**
   * Remove base64 images and replace with placeholder paths
   */
  private static removeImagesForLocalStorage<T>(data: T): T {
    return StorageService.removeBase64Images(data);
  }

  /**
   * Get user-friendly storage warnings
   */
  static getStorageWarnings(): string[] {
    const status = this.getStorageStatus();
    const warnings: string[] = [];

    if (status.localStorage.percentage > 95) {
      warnings.push('⚠️ Storage almost full! Consider removing some images or setting up cloud storage.');
    } else if (status.localStorage.percentage > 80) {
      warnings.push('📊 Storage getting full. New uploads will be compressed more aggressively.');
    }

    if (!status.cloudStorage.configured && status.localStorage.percentage > 60) {
      warnings.push('☁️ Tip: Set up cloud storage to upload unlimited GIFs and images!');
    }

    return warnings;
  }

  /**
   * Smart load with cloud storage URL resolution
   */
  static async loadWithStrategy<T>(
    key: string, 
    defaultValue: T | null = null,
    options: { resolveCloudUrls?: boolean } = {}
  ): Promise<T | null> {
    const { resolveCloudUrls = false } = options; // Changed default to false
    
    try {
      // First, try basic localStorage
      const localData = StorageService.getItem<T>(key, defaultValue);
      
      if (!localData) {
        console.log(`📄 No local data found for ${key}`);
        return defaultValue;
      }

      // DEBUG: Log what we actually loaded for all sections
      if (key.includes('shop')) {
        console.log(`🛒 Shop data loaded from storage:`, {
          itemCount: Array.isArray(localData) ? localData.length : 'not array',
          hasImages: Array.isArray(localData) ? localData.map((item: any) => ({
            id: item?.id,
            hasImage: !!item?.image,
            imageType: item?.image?.startsWith('data:image/') ? item.image.substring(0, 20) + '...' : 
                      item?.image?.includes('supabase.co/storage/') ? 'cloud URL' : 'not base64',
            imageSize: item?.image?.length ? `${Math.round(item.image.length/1024)}KB` : 'no size'
          })) : 'N/A'
        });
      }
      
      if (key.includes('spotlight')) {
        console.log(`🌟 Spotlight data loaded from storage:`, {
          itemCount: Array.isArray(localData) ? localData.length : 'not array',
          hasImages: Array.isArray(localData) ? localData.map((item: any) => ({
            id: item?.id,
            hasImage: !!item?.image,
            imageType: item?.image?.startsWith('data:image/') ? item.image.substring(0, 20) + '...' : 
                      item?.image?.includes('supabase.co/storage/') ? 'cloud URL' : 'not base64',
            imageSize: item?.image?.length ? `${Math.round(item.image.length/1024)}KB` : 'no size'
          })) : 'N/A'
        });
      }

      if (key.includes('gallery')) {
        console.log(`🖼️ Gallery data loaded from storage:`, {
          itemCount: Array.isArray(localData) ? localData.length : 'not array',
          hasImages: Array.isArray(localData) ? localData.map((item: any) => ({
            id: item?.id,
            hasImage: !!item?.image,
            imageType: item?.image?.startsWith('data:image/') ? item.image.substring(0, 20) + '...' : 
                      item?.image?.includes('supabase.co/storage/') ? 'cloud URL' : 'not base64',
            imageSize: item?.image?.length ? `${Math.round(item.image.length/1024)}KB` : 'no size'
          })) : 'N/A'
        });
      }

      if (key.includes('profile')) {
        console.log(`👤 Profile data loaded from storage:`, {
          hasImage: !!(localData as any)?.image,
          imageType: (localData as any)?.image?.startsWith('data:image/') ? (localData as any).image.substring(0, 20) + '...' : 
                    (localData as any)?.image?.includes('supabase.co/storage/') ? 'cloud URL' : 'not base64',
          imageSize: (localData as any)?.image?.length ? `${Math.round((localData as any).image.length/1024)}KB` : 'no size'
        });
      }

      // Only resolve cloud URLs if explicitly requested (for editing)
      if (resolveCloudUrls && typeof localData === 'object' && localData !== null) {
        console.log(`🔄 Resolving cloud URLs for ${key} (editing mode)`);
        const processedData = await this.resolveCloudUrls(localData);
        
        // DEBUG: Log processed data for all sections
        if (key.includes('shop')) {
          console.log(`🛒 Shop data after cloud resolution:`, {
            itemCount: Array.isArray(processedData) ? processedData.length : 'not array',
            hasImages: Array.isArray(processedData) ? processedData.map((item: any) => ({
              id: item?.id,
              hasImage: !!item?.image,
              imageType: item?.image?.startsWith('data:image/') ? item.image.substring(0, 20) + '...' : 'not base64',
              imageSize: item?.image?.length ? `${Math.round(item.image.length/1024)}KB` : 'no size'
            })) : 'N/A'
          });
        }

        if (key.includes('gallery')) {
          console.log(`🖼️ Gallery data after cloud resolution:`, {
            itemCount: Array.isArray(processedData) ? processedData.length : 'not array',
            hasImages: Array.isArray(processedData) ? processedData.map((item: any) => ({
              id: item?.id,
              hasImage: !!item?.image,
              imageType: item?.image?.startsWith('data:image/') ? item.image.substring(0, 20) + '...' : 'not base64',
              imageSize: item?.image?.length ? `${Math.round(item.image.length/1024)}KB` : 'no size'
            })) : 'N/A'
          });
        }

        if (key.includes('profile')) {
          console.log(`👤 Profile data after cloud resolution:`, {
            hasImage: !!(processedData as any)?.image,
            imageType: (processedData as any)?.image?.startsWith('data:image/') ? (processedData as any).image.substring(0, 20) + '...' : 'not base64',
            imageSize: (processedData as any)?.image?.length ? `${Math.round((processedData as any).image.length/1024)}KB` : 'no size'
          });
        }
        
        return processedData;
      }

      return localData;
    } catch (error) {
      console.error(`❌ Failed to load data for ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Resolve Supabase URLs back to base64 data for editing
   */
  private static async resolveCloudUrls<T>(data: T): Promise<T> {
    if (!data || typeof data !== 'object') return data;

    const processValue = async (value: any): Promise<any> => {
      // Check if value is a Supabase storage URL
      if (typeof value === 'string' && value.includes('supabase') && value.includes('/storage/')) {
        try {
          console.log('🌤️ Found cloud URL, resolving to base64...', value.substring(0, 50) + '...');
          
          // Fetch the image from the cloud URL
          const response = await fetch(value);
          if (response.ok) {
            const blob = await response.blob();
            const isGif = blob.type === 'image/gif';
            console.log(`🎬 Resolving ${isGif ? 'GIF' : 'image'} from cloud (${Math.round(blob.size/1024)}KB)`);
            
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                console.log(`✅ Cloud ${isGif ? 'GIF' : 'image'} resolved to base64 (${Math.round(result.length/1024)}KB)`);
                resolve(result);
              };
              reader.readAsDataURL(blob);
            });
          } else {
            console.warn('⚠️ Failed to fetch cloud image, keeping URL');
            return value;
          }
        } catch (error) {
          console.warn('⚠️ Error resolving cloud URL:', error);
          return value;
        }
      } else if (typeof value === 'string' && value.startsWith('data:image/gif')) {
        // Log GIF detection in local storage
        const sizeKB = Math.round(value.length * 0.75 / 1024);
        console.log(`🎬 Found local GIF in storage (${sizeKB}KB)`);
        return value;
      } else if (Array.isArray(value)) {
        return Promise.all(value.map(processValue));
      } else if (value && typeof value === 'object') {
        const processed: any = {};
        for (const [propKey, val] of Object.entries(value)) {
          processed[propKey] = await processValue(val);
        }
        return processed;
      }
      return value;
    };

    return processValue(data);
  }

  /**
   * Check if an upload would likely succeed
   */
  static async canUpload(estimatedSize: number): Promise<{ canUpload: boolean; reason?: string; suggestion?: string }> {
    const status = this.getStorageStatus();
    const availableSpace = status.localStorage.available;

    if (estimatedSize > availableSpace) {
      if (status.cloudStorage.available) {
        return {
          canUpload: true,
          reason: 'Local storage full',
          suggestion: 'Will attempt cloud storage upload'
        };
      } else {
        return {
          canUpload: false,
          reason: 'Storage quota exceeded',
          suggestion: 'Try compressing the image or remove some existing content'
        };
      }
    }

    if (estimatedSize > availableSpace * 0.5) {
      return {
        canUpload: true,
        reason: 'Large upload detected',
        suggestion: 'Will apply compression to fit in available space'
      };
    }

    return { canUpload: true };
  }

  /**
   * Enhanced upload method with secure wallet authentication for large files
   * This is the main entry point that replaces the old streaming upload
   */
  static async uploadWithWalletAuth(
    file: File,
    walletAddress: string,
    section: string = 'gallery',
    options: { enableCompression?: boolean; aggressive?: boolean } = {}
  ): Promise<{ success: boolean; data?: string; url?: string; error?: string; usedCloudStorage?: boolean }> {
    
    const { enableCompression = true, aggressive = false } = options;
    
    try {
      console.log(`📤 Starting wallet-authenticated upload:`, {
        fileName: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + 'MB',
        walletAddress: walletAddress.substring(0, 8) + '...',
        section,
        compression: enableCompression ? (aggressive ? 'optimized' : 'balanced') : 'maximum-quality'
      });

      // Check if GIF is allowed in this section
      const sectionType = section as SectionType;
      const sectionLimits = MVP_SECTION_LIMITS[sectionType];
      const isGifFile = file.type === 'image/gif';
      
      if (isGifFile && sectionLimits && sectionLimits.maxGifs === 0) {
        const sectionName = section === 'profile' ? 'Profile' : 
                           section === 'gallery' ? 'Gallery' : 
                           section === 'spotlight' ? 'Spotlight' : 
                           section === 'shop' ? 'Shop' : section;
        const errorMessage = `GIFs are not allowed in the ${sectionName} section. Please use a static image (PNG, JPG, WebP).`;
        console.warn('🚫 GIF upload blocked:', errorMessage);
        return {
          success: false,
          error: errorMessage
        };
      }

      // For files larger than 256KB, use Supabase cloud storage
      if (file.size > 256 * 1024) {
        console.log('📤 Large file detected, using cloud storage');
        
        let fileToUpload = file;
        
        // Apply smart compression if enabled and it's not a GIF
        if (enableCompression && !file.type.includes('gif')) {
          console.log(`🗜️ Applying ${aggressive ? 'optimized' : 'balanced'} compression before cloud upload...`);
          try {
            // Convert file to base64 for compression
            const base64 = await this.fileToBase64(file);
            const { smartCompress } = await import('@/lib/imageUtils');
            
            // Apply compression with size limit based on aggressiveness
            const sizeLimit = aggressive ? 512 * 1024 : 1024 * 1024; // 512KB for optimized, 1MB for balanced
            const compressedBase64 = await smartCompress(base64, sizeLimit);
            
            // Convert back to File if compression was applied
            if (compressedBase64 !== base64) {
              const compressedBlob = await this.base64ToBlob(compressedBase64);
              const originalSize = file.size;
              const compressedSize = compressedBlob.size;
              const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
              
              console.log(`✅ ${aggressive ? 'Optimized' : 'Balanced'} compression applied: ${(originalSize/1024/1024).toFixed(2)}MB → ${(compressedSize/1024/1024).toFixed(2)}MB (${savings}% reduction)`);
              fileToUpload = new File([compressedBlob], file.name, { type: file.type });
            } else {
              console.log('📏 No compression needed - file already optimized');
            }
          } catch (compressionError) {
            console.warn('⚠️ Compression failed, uploading original file:', compressionError);
          }
        } else if (file.type.includes('gif')) {
          console.log('🎬 GIF detected - skipping compression to preserve animation');
        } else {
          console.log('🎨 Maximum quality mode - no compression applied');
        }
        
        console.log('🔧 Using SupabaseAuthBridge for secure upload...');
        
        try {
          console.log('🔐 Calling SupabaseAuthBridge.uploadFileWithAuth...');
          const uploadResult = await SupabaseAuthBridge.uploadFileWithAuth(
            fileToUpload,
            walletAddress,
            `${walletAddress}/${section}/${Date.now()}_${file.name}`
          );
          
          console.log('📤 SupabaseAuthBridge.uploadFileWithAuth completed:', {
            success: !!uploadResult?.url,
            hasUrl: !!uploadResult?.url,
            urlPreview: uploadResult?.url ? uploadResult.url.substring(0, 50) + '...' : 'no url'
          });
          
          if (uploadResult?.url) {
            console.log('✅ Cloud upload successful:', uploadResult.url);
            
            return {
              success: true,
              url: uploadResult.url,
              usedCloudStorage: true
            };
          } else {
            console.warn('⚠️ SupabaseAuthBridge returned no URL');
            throw new Error('Cloud upload returned no URL');
          }
          
        } catch (cloudError) {
          console.warn('⚠️ Cloud upload failed, falling back to local processing:', cloudError);
          console.warn('⚠️ Cloud error details:', {
            message: cloudError instanceof Error ? cloudError.message : 'Unknown error',
            stack: cloudError instanceof Error ? cloudError.stack : 'No stack'
          });
          // Fall through to local processing
        }
      }

      // For smaller files or cloud upload fallback, use local processing
      console.log('🔧 Processing file locally with FileReader');
      
      const result = await this.processFileWithReader(file);
      
      console.log('🔧 processFileWithReader result:', {
        success: result.success,
        hasData: !!result.data,
        dataSize: result.data ? `${Math.round(result.data.length / 1024)}KB` : 'no data',
        error: result.error
      });
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: result.data,
        usedCloudStorage: false
      };

    } catch (error) {
      console.error('🚨 Upload with wallet auth failed:', error);
      console.error('🚨 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Convert File to base64 for compression
   */
  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convert base64 back to Blob
   */
  private static async base64ToBlob(base64: string): Promise<Blob> {
    const response = await fetch(base64);
    return response.blob();
  }

  /**
   * Process file using FileReader for local storage
   */
  private static async processFileWithReader(file: File): Promise<{ success: boolean; data?: string; error?: string }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const result = reader.result as string;
          console.log(`✅ FileReader completed: ${(result.length / 1024).toFixed(2)}KB`);
          resolve({ success: true, data: result });
        } catch (error) {
          console.error('🚨 FileReader processing error:', error);
          resolve({ 
            success: false, 
            error: error instanceof Error ? error.message : 'File processing failed' 
          });
        }
      };
      
      reader.onerror = () => {
        console.error('🚨 FileReader error:', reader.error);
        resolve({ 
          success: false, 
          error: 'Failed to read file' 
        });
      };
      
      reader.readAsDataURL(file);
    });
  }
}

// Export default strategy for power users
export const DEFAULT_POWER_USER_STRATEGY: StorageStrategy = {
  mode: 'auto',
  compressionLevel: 'medium',
  maxItemsPerSection: 15 // Allow more items for power users
}; 