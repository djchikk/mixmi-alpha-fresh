"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { UserProfileService } from '@/lib/userProfileService';
import { stickers } from '@/lib/stickerData';
import Modal from '@/components/ui/Modal';
import ImageUploader from '../shared/ImageUploader';

type StickerId = typeof stickers[number]['id'] | 'custom';

interface StickerSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStickerId?: string | null;
  currentCustomImage?: string | null;
  stickerVisible?: boolean;
  targetWallet: string;
  onUpdate: () => Promise<void>;
}

export default function StickerSelectionModal({
  isOpen,
  onClose,
  currentStickerId,
  currentCustomImage,
  stickerVisible = true,
  targetWallet,
  onUpdate
}: StickerSelectionModalProps) {
  const [selectedStickerId, setSelectedStickerId] = useState<StickerId>(
    (currentStickerId as StickerId) || 'daisy-blue'
  );
  const [customImage, setCustomImage] = useState<string>(
    currentCustomImage || ''
  );
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>(
    currentStickerId === 'custom' ? 'custom' : 'presets'
  );
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStickerId((currentStickerId as StickerId) || 'daisy-blue');
      setCustomImage(currentCustomImage || '');
      setActiveTab(currentStickerId === 'custom' ? 'custom' : 'presets');
      setIsSaving(false);
    }
  }, [isOpen, currentStickerId, currentCustomImage]);

  const handleStickerSelect = (id: StickerId) => {
    setSelectedStickerId(id);
    if (id !== 'custom') {
      setCustomImage(''); // Clear custom image when selecting a preset
    }
  };

  const handleCustomImageChange = (imageData: string) => {
    setCustomImage(imageData);
    setSelectedStickerId('custom');
    setActiveTab('custom');
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Update the profile with the selected sticker
      const updates: any = {
        sticker_id: selectedStickerId,
        sticker_visible: stickerVisible
      };

      // Only add custom_sticker field if the column exists
      // For now we'll add it but it may fail if column doesn't exist
      if (selectedStickerId === 'custom') {
        updates.custom_sticker = customImage;
      } else {
        updates.custom_sticker = null;
      }

      await UserProfileService.updateProfile(targetWallet, updates);

      // Refresh the parent component
      await onUpdate();

      // Close the modal
      onClose();

    } catch (error) {
      console.error('Failed to save sticker:', error);
      alert('Failed to save sticker. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile Sticker">
      <div className="space-y-4">
        <p className="text-gray-500">
          Choose a preset design or upload your own custom sticker
        </p>

        {/* Tab buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'presets'
                ? 'bg-white text-slate-900'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            Preset Stickers
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'custom'
                ? 'bg-white text-slate-900'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            Custom Upload
          </button>
        </div>

        {/* Preset stickers tab */}
        {activeTab === 'presets' && (
          <div className="grid grid-cols-4 gap-4">
            {stickers.map((sticker) => (
              <div
                key={sticker.id}
                onClick={() => handleStickerSelect(sticker.id)}
                className={`
                  relative aspect-square rounded-lg overflow-hidden cursor-pointer
                  border-2 ${selectedStickerId === sticker.id && selectedStickerId !== 'custom' ? 'border-[#81E4F2]' : 'border-transparent'}
                  bg-slate-900 flex items-center justify-center p-2
                  hover:border-[#81E4F2]/50 transition-colors
                `}
              >
                <Image
                  src={sticker.imageUrl}
                  alt={sticker.alt}
                  width={80}
                  height={80}
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        )}

        {/* Custom upload tab */}
        {activeTab === 'custom' && (
          <div className="space-y-4">
            <ImageUploader
              initialImage={customImage}
              onImageChange={handleCustomImageChange}
              aspectRatio="square"
              section="sticker"
              hideToggle={true}
              walletAddress={targetWallet}
            />

            {customImage && (
              <div className="flex justify-center">
                <div className="relative w-32 h-32 bg-slate-900 rounded-lg p-4">
                  <div className="animate-spin-slow">
                    <img
                      src={customImage}
                      alt="Custom sticker preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-2">Preview (rotating)</p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
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
            disabled={(selectedStickerId === 'custom' && !customImage) || isSaving}
            className="px-4 py-1.5 bg-[#101726] text-white border-2 border-white rounded-lg font-semibold hover:bg-[#1a2030] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}