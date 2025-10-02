"use client";

import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import ImageUploader from "../shared/ImageUploader";
import { UserProfileService } from "@/lib/userProfileService";
import { processAndUploadProfileImage } from "@/lib/profileImageUpload";

interface ProfileImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImage?: string;
  targetWallet: string;
  onUpdate: () => Promise<void>;
}

export default function ProfileImageModal({
  isOpen,
  onClose,
  currentImage,
  targetWallet,
  onUpdate
}: ProfileImageModalProps) {
  const [currentImageData, setCurrentImageData] = useState<string>(currentImage || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'complete'>('idle');
  const [isGifUpload, setIsGifUpload] = useState(false);
  
  // Initialize state when modal opens (no cleanup needed since component unmounts on close)
  useEffect(() => {
    console.log('🔧 ProfileImageModal useEffect triggered:', {
      isOpen,
      currentImage,
      currentImageType: currentImage ? (currentImage.startsWith('http') ? 'URL' : 'base64') : 'none'
    });
    if (isOpen) {
      setCurrentImageData(currentImage || "");
      setIsSaving(false);
      setSaveStatus('idle');
      setIsGifUpload(false);
    }
  }, [isOpen, currentImage]); // Include currentImage to ensure preview updates when modal opens
  
  const handleImageChange = (imageData: string) => {
    console.log('🔧 ProfileImageModal.handleImageChange called:', {
      hasImageData: !!imageData,
      imageType: imageData?.startsWith('data:image/') ? 'base64' : (imageData?.startsWith('http') ? 'URL' : 'unknown'),
      imageSize: imageData?.length ? `${Math.round(imageData.length/1024)}KB` : 'no size'
    });

    // ImageUploader already handles the upload and returns a URL
    // Store the URL directly - no need for further processing
    setCurrentImageData(imageData);
  };
  
  const handleSave = async () => {
    if (!currentImageData) return;

    try {
      setIsSaving(true);
      setSaveStatus('saving');

      console.log('🔧 About to update profile image...');

      // ImageUploader already uploaded the image and gave us a URL
      // Just save the URL directly to the database
      const imageUrl = currentImageData.startsWith('http')
        ? currentImageData
        : await processAndUploadProfileImage(currentImageData, targetWallet); // Fallback for base64

      console.log('📸 Saving image URL to profile:', imageUrl);

      // Update the profile with the image URL
      await UserProfileService.updateProfile(targetWallet, {
        avatar_url: imageUrl
      });

      // Call the onUpdate callback to refresh the parent component
      await onUpdate();
      
      // Ensure "Saving..." is visible for at least 500ms (like gallery sections)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Detect if it's a GIF for longer delay
      const isGif = currentImageData?.startsWith('data:image/gif') || 
                   currentImageData?.includes('.gif') ||
                   currentImageData?.toLowerCase().includes('gif');
      
      console.log('🎯 Profile save completed, showing success message...', { isGif });
      
      // Store GIF detection result in state for consistent UI
      setIsGifUpload(isGif);
      
      // Show success state
      setSaveStatus('complete');
      
      // GIFs need more time to load and render
      const delay = isGif ? 3500 : 1500;
      
      console.log(`✨ Showing success message for ${delay}ms:`, isGif ? 'Profile GIF will appear momentarily!' : 'Profile image will appear momentarily!');
      
      // Brief delay to show success message, then close
      setTimeout(() => {
        console.log('✅ updateProfile completed successfully');
        // Set isSaving to false RIGHT before closing to prevent jitter
        setIsSaving(false);
        onClose();
      }, delay);
      
    } catch (error) {
      console.error('❌ updateProfile failed:', error);
      setIsSaving(false);
      setSaveStatus('idle');
      alert('Failed to save profile image. Please try again.');
    }
  };
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile Image">
      <div className="space-y-6">
        <p className="text-sm text-gray-400">
          You can upload an image file or provide a URL.
        </p>
        
        <ImageUploader
          initialImage={currentImageData || currentImage}
          onImageChange={handleImageChange}
          aspectRatio="square"
          section="profile"
          walletAddress={targetWallet}  // Pass wallet for storage upload
          hideToggle={true}  // Hide upload/URL toggle to prevent tab switching from clearing preview
        />
        
        {/* Save Status Indicator */}
        {isSaving && (
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center space-x-2">
              {saveStatus === 'complete' ? (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin"></div>
              )}
              <span className={`font-medium text-gray-300 ${
                saveStatus === 'saving' ? 'text-sm' : 
                isGifUpload ? 'text-base' : 'text-sm'
              }`}>
                {saveStatus === 'saving' ? 'Saving...' : 
                 isGifUpload ? 'Profile GIF will appear momentarily! ✨' : 'Profile image will appear momentarily! ✨'}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-1.5 bg-slate-800 text-gray-400 border border-slate-600 rounded-lg font-medium hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !currentImageData || saveStatus === 'complete'}
            className="px-4 py-1.5 bg-[#101726] text-white border-2 border-white rounded-lg font-semibold hover:bg-[#1a2030] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving && saveStatus === 'saving' && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            )}
            Save Changes
          </button>
        </div>
      </div>
    </Modal>
  );
} 