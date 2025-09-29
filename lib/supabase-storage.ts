import { supabase, getSupabaseAdmin, isSupabaseAvailable } from './supabase';

export type ImageType = 'profile' | 'spotlight' | 'shop' | 'gallery';

export interface UploadResult {
  success: boolean;
  data?: {
    path: string;
    publicUrl: string;
    fileName: string;
  };
  error?: string;
  details?: any;
}

export class SupabaseStorageService {
  
  /**
   * Get bucket name - using single bucket with folder organization
   */
  static getBucketName(): string {
    // Use 'images' bucket which likely has simpler RLS policies
    return 'images';
  }

  /**
   * Upload image to appropriate bucket based on type
   * @param userId - User ID for organizing files
   * @param file - Image file to upload
   * @param imageType - Type of image (profile, spotlight, shop, gallery)
   * @param itemId - Optional item ID for non-profile images
   * @returns Promise with upload result and public URL
   */
  static async uploadImage(
    userId: string,
    file: File,
    imageType: ImageType,
    itemId?: string
  ): Promise<UploadResult> {
    try {
      const bucket = this.getBucketName();
      
      // Generate unique filename based on image type
      const fileExt = file.name.split('.').pop();
      let fileName: string;
      
      switch (imageType) {
        case 'profile':
          fileName = `${userId}/profile/avatar-${Date.now()}.${fileExt}`;
          break;
        case 'spotlight':
          fileName = `${userId}/spotlight/${itemId || Date.now()}-${Date.now()}.${fileExt}`;
          break;
        case 'shop':
          fileName = `${userId}/shop/${itemId || Date.now()}-${Date.now()}.${fileExt}`;
          break;
        case 'gallery':
          fileName = `${userId}/gallery/${itemId || Date.now()}-${Date.now()}.${fileExt}`;
          break;
      }
      
      console.log(`Uploading ${imageType} image: ${fileName}, Size: ${file.size} bytes`);
      
      // Upload file to Supabase Storage (use regular client for uploads)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true // Replace if exists
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return { 
          success: false, 
          error: uploadError.message,
          details: uploadError
        };
      }

      // Get public URL  
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        return { 
          success: false, 
          error: 'Failed to get public URL' 
        };
      }

      console.log(`✅ ${imageType} image uploaded successfully:`, urlData.publicUrl);

      return {
        success: true,
        data: {
          path: uploadData.path,
          publicUrl: urlData.publicUrl,
          fileName: fileName
        }
      };

    } catch (error) {
      console.error('Storage service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown storage error' 
      };
    }
  }

  /**
   * Upload profile image (convenience function)
   */
  static async uploadProfileImage(userId: string, file: File): Promise<UploadResult> {
    return this.uploadImage(userId, file, 'profile');
  }

  /**
   * Upload spotlight item image
   */
  static async uploadSpotlightImage(userId: string, file: File, itemId?: string): Promise<UploadResult> {
    return this.uploadImage(userId, file, 'spotlight', itemId);
  }

  /**
   * Upload shop item image
   */
  static async uploadShopImage(userId: string, file: File, itemId?: string): Promise<UploadResult> {
    return this.uploadImage(userId, file, 'shop', itemId);
  }

  /**
   * Upload gallery image
   */
  static async uploadGalleryImage(userId: string, file: File, itemId?: string): Promise<UploadResult> {
    return this.uploadImage(userId, file, 'gallery', itemId);
  }

  /**
   * Delete image from storage
   * @param imagePath - Path to the image in storage
   * @param imageType - Type of image to determine bucket
   */
  static async deleteImage(imagePath: string, imageType: ImageType) {
    try {
      const bucket = this.getBucketName();
      
      const { error } = await supabase.storage
        .from(bucket)
        .remove([imagePath]);

      if (error) {
        console.error('Delete error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Storage delete error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown delete error' 
      };
    }
  }

  /**
   * Check if storage bucket exists and is accessible
   */
  static async checkAllBucketsAccess() {
    const bucket = this.getBucketName();
    
    try {
      // Try to list files in the bucket
      const { data, error } = await supabase.storage
        .from(bucket)
        .list('', { limit: 1 });

      if (error) {
        return { 
          'user-content': {
            success: false, 
            error: error.message,
            suggestion: `Create the '${bucket}' bucket in Supabase Dashboard > Storage`
          }
        };
      }

      return {
        'user-content': { success: true, bucketExists: true }
      };
    } catch (error) {
      return {
        'user-content': { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
          suggestion: 'Check Supabase configuration and storage permissions'
        }
      };
    }
  }

  /**
   * Check if specific storage bucket exists and is accessible
   */
  static async checkStorageAccess() {
    const bucket = this.getBucketName();
    try {
      // Try to list files in the bucket
      const { data, error } = await supabase.storage
        .from(bucket)
        .list('', { limit: 1 });

      if (error) {
        return { 
          success: false, 
          error: error.message,
          suggestion: `Create the '${bucket}' bucket in Supabase Dashboard > Storage`
        };
      }

      return { success: true, bucketExists: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check Supabase configuration and storage permissions'
      };
    }
  }

  /**
   * Get image upload configuration and limits
   */
  static getUploadConfig() {
    return {
      maxFileSize: 50 * 1024 * 1024, // 50MB default Supabase limit
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    };
  }

  /**
   * Validate file before upload
   */
  static validateImageFile(file: File) {
    const config = this.getUploadConfig();
    
    // Check file size
    if (file.size > config.maxFileSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is ${Math.round(config.maxFileSize / (1024 * 1024))}MB`
      };
    }

    // Check file type
    if (!config.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid file type. Allowed types: ${config.allowedTypes.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Extract file path from public URL for deletion
   */
  static extractFilePathFromUrl(publicUrl: string): string | null {
    try {
      const bucket = this.getBucketName();
      // URLs are typically: https://project.supabase.co/storage/v1/object/public/bucket-name/path
      const parts = publicUrl.split(`/object/public/${bucket}/`);
      return parts.length > 1 ? parts[1] : null;
    } catch {
      return null;
    }
  }
}

// Export convenience functions for each image type
export const uploadProfileImage = SupabaseStorageService.uploadProfileImage.bind(SupabaseStorageService);
export const uploadSpotlightImage = SupabaseStorageService.uploadSpotlightImage.bind(SupabaseStorageService);
export const uploadShopImage = SupabaseStorageService.uploadShopImage.bind(SupabaseStorageService);
export const uploadGalleryImage = SupabaseStorageService.uploadGalleryImage.bind(SupabaseStorageService);
export const deleteImage = SupabaseStorageService.deleteImage.bind(SupabaseStorageService);
export const checkStorageAccess = SupabaseStorageService.checkStorageAccess.bind(SupabaseStorageService);
export const checkAllBucketsAccess = SupabaseStorageService.checkAllBucketsAccess.bind(SupabaseStorageService);
export const validateImageFile = SupabaseStorageService.validateImageFile.bind(SupabaseStorageService); 