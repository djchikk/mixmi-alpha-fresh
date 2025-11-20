"use client";

import React from 'react';
import { Music, Radio, Video, X } from 'lucide-react';

interface ContentTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMusic: () => void;
  onSelectRadio: () => void;
  onSelectVideo: () => void;
}

export default function ContentTypeSelector({
  isOpen,
  onClose,
  onSelectMusic,
  onSelectRadio,
  onSelectVideo
}: ContentTypeSelectorProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-[#1a2332] to-[#0f1419] rounded-xl shadow-2xl w-full max-w-2xl border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white">What would you like to upload?</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Music Option - Purple to Gold gradient */}
            <button
              onClick={onSelectMusic}
              className="group relative bg-gradient-to-br from-[#9772F4]/20 via-[#C4A8F4]/15 to-[#FFE4B5]/20 hover:from-[#9772F4]/30 hover:via-[#C4A8F4]/25 hover:to-[#FFE4B5]/30 border-2 border-[#9772F4]/30 hover:border-[#C4A8F4] rounded-xl p-8 transition-all duration-300 hover:scale-105"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#9772F4]/30 to-[#FFE4B5]/30 flex items-center justify-center group-hover:from-[#9772F4]/40 group-hover:to-[#FFE4B5]/40 transition-colors">
                  <Music className="w-8 h-8 text-[#FFE4B5]" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">Music</h3>
                  <p className="text-sm text-gray-400">Upload songs, loops, or packs</p>
                </div>
              </div>
            </button>

            {/* Radio Option */}
            <button
              onClick={onSelectRadio}
              className="group relative bg-gradient-to-br from-[#FB923C]/20 to-[#FB923C]/5 hover:from-[#FB923C]/30 hover:to-[#FB923C]/10 border-2 border-[#FB923C]/30 hover:border-[#FB923C] rounded-xl p-8 transition-all duration-300 hover:scale-105"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#FB923C]/20 flex items-center justify-center group-hover:bg-[#FB923C]/30 transition-colors">
                  <Radio className="w-8 h-8 text-[#FB923C]" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">Radio</h3>
                  <p className="text-sm text-gray-400">Add live radio stations</p>
                </div>
              </div>
            </button>

            {/* Video Option */}
            <button
              onClick={onSelectVideo}
              className="group relative bg-gradient-to-br from-[#38BDF8]/20 to-[#38BDF8]/5 hover:from-[#38BDF8]/30 hover:to-[#38BDF8]/10 border-2 border-[#38BDF8]/30 hover:border-[#38BDF8] rounded-xl p-8 transition-all duration-300 hover:scale-105"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#38BDF8]/20 flex items-center justify-center group-hover:bg-[#38BDF8]/30 transition-colors">
                  <Video className="w-8 h-8 text-[#38BDF8]" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white mb-2">Video</h3>
                  <p className="text-sm text-gray-400">Upload 5-second clips</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
