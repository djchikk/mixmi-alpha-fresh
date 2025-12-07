"use client";

import React from 'react';
import { UserProfileService } from '@/lib/userProfileService';
import { Check } from 'lucide-react';

interface SectionManagerProps {
  sections: Array<{
    section_type: string;
    is_visible: boolean;
    display_order: number;
    config: any;
  }>;
  targetWallet: string;
  stickerVisible?: boolean;
  onUpdate: () => Promise<void>;
}

export default function SectionManager({ sections, targetWallet, stickerVisible = true, onUpdate }: SectionManagerProps) {

  const toggleSection = async (sectionType: string) => {
    // Handle sticker visibility separately
    if (sectionType === 'sticker') {
      try {
        const result = await UserProfileService.updateProfile(targetWallet, {
          sticker_visible: !stickerVisible
        });

        if (result) {
          await onUpdate();
        } else {
          console.error('Failed to update sticker visibility');
        }
      } catch (error) {
        console.error('Failed to toggle sticker:', error);
      }
      return;
    }

    // Handle regular sections
    const section = sections.find(s => s.section_type === sectionType);
    if (!section) return;

    try {
      const result = await UserProfileService.updateSectionVisibility(
        targetWallet,
        sectionType,
        !section.is_visible
      );

      if (result) {
        await onUpdate();
      } else {
        console.error('Failed to update section visibility');
      }
    } catch (error) {
      console.error('Failed to toggle section:', error);
    }
  };

  const getSectionName = (type: string) => {
    switch(type) {
      case 'spotlight': return 'Spotlight';
      case 'media': return 'Streams';
      case 'shop': return 'Shop';
      case 'gallery': return 'Gallery';
      case 'sticker': return 'Sticker';
      default: return type;
    }
  };

  const isVisible = (sectionType: string) => {
    if (sectionType === 'sticker') return stickerVisible;
    const section = sections.find(s => s.section_type === sectionType);
    return section?.is_visible ?? false;
  };

  const allSections = ['spotlight', 'media', 'shop', 'gallery', 'sticker'];

  return (
    <div className="mb-8 flex justify-center">
      <div className="inline-flex items-center gap-1 px-2 py-1.5 bg-slate-800/30 rounded-lg border border-gray-700/50">
        <span className="text-gray-200 text-xs font-semibold px-2">Show:</span>
        {allSections.map((sectionType) => {
          const visible = isVisible(sectionType);
          return (
            <button
              key={sectionType}
              onClick={() => toggleSection(sectionType)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                visible
                  ? 'bg-[#81E4F2]/20 text-gray-100 border border-[#81E4F2]/40'
                  : 'bg-transparent text-gray-500 hover:text-gray-400 hover:bg-slate-700/50'
              }`}
            >
              {visible && <Check size={12} className="text-[#81E4F2]" />}
              {getSectionName(sectionType)}
            </button>
          );
        })}
      </div>
    </div>
  );
}