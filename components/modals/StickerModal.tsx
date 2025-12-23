import { useState } from 'react';
import Image from 'next/image';
import { useProfile } from '@/contexts/ProfileContext';
import { StickerId } from '@/types';
import { stickers } from '@/lib/stickerData';
import Modal from '@/components/ui/Modal';
import ImageUploader from '../shared/ImageUploader';

type StickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function StickerModal({ isOpen, onClose }: StickerModalProps) {
  const { profile, updateProfile } = useProfile();
  const [selectedStickerId, setSelectedStickerId] = useState<StickerId>(
    (profile.sticker.id as StickerId) || 'daisy-blue'
  );
  const [customImage, setCustomImage] = useState<string>(
    profile.sticker.customImage || ''
  );
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>(
    profile.sticker.id === 'custom' ? 'custom' : 'presets'
  );

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

  const handleSave = () => {
    updateProfile({
      sticker: {
        id: selectedStickerId,
        customImage: selectedStickerId === 'custom' ? customImage : undefined,
        visible: profile.sticker.visible
      }
    });
    onClose();
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
            className="px-4 py-1.5 bg-slate-800 text-gray-400 border border-slate-600 rounded-lg font-medium hover:bg-slate-700 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={selectedStickerId === 'custom' && !customImage}
            className="px-4 py-1.5 bg-[#101726] text-white border-2 border-white rounded-lg font-semibold hover:bg-[#1a2030] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}