"use client";

import React, { useState, useRef, useEffect } from 'react';
import { UserProfileService } from '@/lib/userProfileService';

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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // State to store the exact width of the button
  const [buttonWidth, setButtonWidth] = useState(0);

  // Update button width when it changes
  useEffect(() => {
    if (buttonRef.current) {
      const updateWidth = () => {
        const width = buttonRef.current?.offsetWidth || 0;
        setButtonWidth(width);
      };

      // Initial measurement
      updateWidth();

      // Update on window resize
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
  }, []);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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
      case 'media': return 'Media';
      case 'shop': return 'Shop';
      case 'gallery': return 'Gallery';
      case 'sticker': return 'Profile Sticker';
      default: return type;
    }
  };

  return (
    <div className="mb-8 flex justify-center relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-slate-800/50 hover:bg-slate-700/50 text-white px-6 py-3 rounded-lg flex items-center space-x-3 transition-all duration-200 border border-gray-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
          <line x1="3" y1="9" x2="21" y2="9"></line>
        </svg>
        <span className="font-medium">Manage Profile Sections</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full mt-2 bg-[#0f172a] border border-gray-700 rounded-lg shadow-2xl overflow-hidden z-50"
          style={{ width: `${buttonWidth}px` }}
        >
          <div className="p-1">
            {sections.map((section) => (
              <button
                key={section.section_type}
                onClick={() => toggleSection(section.section_type)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 rounded transition-colors"
              >
                <span className="text-white font-medium">
                  {getSectionName(section.section_type)}
                </span>
                <div
                  className={`w-12 h-6 rounded-full transition-all duration-200 relative ${
                    section.is_visible ? 'bg-[#81E4F2]' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                      section.is_visible ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}