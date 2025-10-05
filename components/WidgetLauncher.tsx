"use client";

import React from 'react';

interface WidgetLauncherProps {
  onMixClick: () => void;
  onPlayClick: () => void;
  onRadioClick: () => void;
  onFillClick: () => void;
  isMixerVisible: boolean;
  isPlaylistVisible: boolean;
  isRadioVisible: boolean;
}

export default function WidgetLauncher({
  onMixClick,
  onPlayClick,
  onRadioClick,
  onFillClick,
  isMixerVisible,
  isPlaylistVisible,
  isRadioVisible
}: WidgetLauncherProps) {
  return (
    <div
      className="fixed z-20"
      style={{
        right: '40px',
        top: '50%',
        transform: 'translateY(-50%)'
      }}
    >
      <div className="flex flex-col gap-3">
        {/* Mix Button */}
        <button
          onClick={onMixClick}
          className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-[#9772F4] transition-all flex items-center justify-center text-white font-mono text-sm"
          style={{ opacity: isMixerVisible ? 0.6 : 1 }}
        >
          Mix
        </button>

        {/* Play Button */}
        <button
          onClick={onPlayClick}
          className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-[#81E4F2] transition-all flex items-center justify-center text-white font-mono text-sm"
          style={{ opacity: isPlaylistVisible ? 0.6 : 1 }}
        >
          Play
        </button>

        {/* Radio Button */}
        <button
          onClick={onRadioClick}
          className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-cyan-400 transition-all flex items-center justify-center text-white font-mono text-sm"
          style={{ opacity: isRadioVisible ? 0.6 : 1 }}
        >
          Radio
        </button>

        {/* Fill Button */}
        <button
          onClick={onFillClick}
          className="w-16 h-16 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-amber-400 transition-all flex items-center justify-center text-white font-mono text-sm"
        >
          Fill
        </button>
      </div>
    </div>
  );
}
