"use client";

import React from 'react';
import { Music, Video, X, Globe } from 'lucide-react';

interface ContentTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMusic: () => void;
  onSelectRadio: () => void; // Kept in interface for Header compatibility
  onSelectVideo: () => void;
  onSelectChat?: () => void;
}

export default function ContentTypeSelector({
  isOpen,
  onClose,
  onSelectMusic,
  onSelectRadio,
  onSelectVideo,
  onSelectChat
}: ContentTypeSelectorProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1419] rounded-xl shadow-2xl w-full max-w-2xl border border-white/10">
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
          {/* Chat Upload - Hero Option */}
          {onSelectChat && (
            <button
              onClick={onSelectChat}
              className="group relative w-full bg-white/5 hover:bg-white/10 border border-[#81E4F2]/40 hover:border-[#81E4F2] rounded-xl p-6 transition-all duration-200 mb-6"
            >
              <div className="flex items-center gap-6">
                {/* Globe icon */}
                <div className="w-14 h-14 rounded-full bg-[#81E4F2]/15 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-7 h-7 text-[#81E4F2]" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1">Chat Upload</h3>
                  <p className="text-sm text-gray-400">Drop files — I'll help with the rest</p>
                  <p className="text-xs text-gray-500 mt-1">Loops, songs, EPs, video clips</p>
                </div>
              </div>
            </button>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-sm text-gray-500">or use manual forms</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          {/* Manual Form Options - Secondary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Music Option */}
            <button
              onClick={onSelectMusic}
              className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#A084F9]/50 rounded-xl p-5 transition-all duration-200"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                  <Music className="w-6 h-6 text-[#A084F9]" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold text-white mb-1">Music</h3>
                  <p className="text-xs text-gray-500">Songs, loops, packs</p>
                </div>
              </div>
            </button>

            {/* Video Option */}
            <button
              onClick={onSelectVideo}
              className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#5BB5F9]/50 rounded-xl p-5 transition-all duration-200"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                  <Video className="w-6 h-6 text-[#5BB5F9]" />
                </div>
                <div className="text-center">
                  <h3 className="text-base font-semibold text-white mb-1">Video</h3>
                  <p className="text-xs text-gray-500">Video clips</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
