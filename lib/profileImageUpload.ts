import { supabase } from './supabase';

/**
 * Uploads a profile image to Supabase Storage and returns the public URL
 * @param file The image file to upload
 * @param walletAddress The user's wallet address for organizing files
 * @returns The public URL of the uploaded image
 */
export async function uploadProfileImage(file: File, walletAddress: string): Promise<string> {
  try {
    // Create a unique filename with wallet address prefix
    const fileExt = file.name.split('.').pop();
    const fileName = `${walletAddress}/avatar-${Date.now()}.${fileExt}`;

    console.log(`📸 Uploading profile image: ${fileName}, Size: ${(file.size / 1024).toFixed(0)}KB`);

    // Upload to the existing 'images' bucket with a profiles subfolder
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(`profiles/${fileName}`, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Image upload failed:', uploadError);
      throw new Error(uploadError.message);
    }

    // Get public URL from images bucket
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(`profiles/${fileName}`);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log('✅ Profile image uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('🚨 Profile image upload failed:', error);
    throw error;
  }
}

/**
 * Processes a base64 image string or blob and uploads it
 * @param imageData Base64 string or Blob
 * @param walletAddress The user's wallet address
 * @returns The public URL of the uploaded image
 */
export async function processAndUploadProfileImage(
  imageData: string | Blob,
  walletAddress: string
): Promise<string> {
  try {
    let file: File;

    if (typeof imageData === 'string') {
      // Handle base64 string
      if (imageData.startsWith('data:')) {
        // Convert base64 to blob
        const response = await fetch(imageData);
        const blob = await response.blob();

        // Create a File from the blob
        const mimeType = imageData.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        const extension = mimeType.split('/')[1] || 'jpg';
        file = new File([blob], `avatar.${extension}`, { type: mimeType });
      } else if (imageData.startsWith('http')) {
        // It's already a URL, just return it
        return imageData;
      } else {
        throw new Error('Invalid image data format');
      }
    } else {
      // It's already a blob/file
      file = imageData as File;
    }

    // Upload the file
    return await uploadProfileImage(file, walletAddress);
  } catch (error) {
    console.error('Error processing profile image:', error);
    throw error;
  }
}