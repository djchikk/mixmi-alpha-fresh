import { useState } from 'react';
import Image from 'next/image';
import { getStickerById } from '@/lib/stickerData';
import StickerSelectionModal from './StickerSelectionModal';

interface ProfileStickerProps {
  stickerId?: string | null;
  stickerVisible?: boolean;
  customSticker?: string | null;
  isOwnProfile: boolean;
  targetWallet: string;
  onUpdate: () => Promise<void>;
}

export default function ProfileSticker({
  stickerId,
  stickerVisible,
  customSticker,
  isOwnProfile,
  targetWallet,
  onUpdate
}: ProfileStickerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Don't show if sticker is not visible
  if (!stickerVisible) return null;

  // Get sticker image from preset stickers or custom
  let stickerImage: string | null = null;
  let stickerAlt = 'Profile sticker';

  if (stickerId === 'custom' && customSticker) {
    stickerImage = customSticker;
    stickerAlt = 'Custom sticker';
  } else if (stickerId) {
    const preset = getStickerById(stickerId as any);
    if (preset) {
      stickerImage = preset.imageUrl;
      stickerAlt = preset.alt;
    }
  }

  // Don't show if no sticker image and not the owner
  if (!stickerImage && !isOwnProfile) return null;
  
  return (
    <>
      <section className="mb-16 py-8 flex justify-center">
        <div className="relative">
          {stickerImage && (
            <Image
              src={stickerImage}
              alt={stickerAlt}
              width={130}
              height={130}
              className="animate-slow-spin"
            />
          )}

          {isOwnProfile && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="absolute -top-2 -right-2 bg-slate-800 hover:bg-slate-700 text-accent px-3 py-1 rounded-md flex items-center space-x-2 transition-colors text-sm"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="14" 
                height="14" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <span>Edit Sticker</span>
            </button>
          )}
        </div>
      </section>

      {/* TODO: Re-enable once StickerModal is adapted
      <StickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targetWallet={targetWallet}
        onUpdate={onUpdate}
      />
      */}
    </>
  );
}