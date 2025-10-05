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
      <div className="flex flex-col gap-4">
        {/* Mix Button */}
        <button
          onClick={onMixClick}
          className="transition-all flex items-center justify-center text-white font-mono text-sm relative overflow-hidden"
          style={{
            width: '124px',
            height: '124px',
            borderRadius: '8px',
            backgroundColor: '#000000',
          }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at center, #FFFFFF 0%, #F3C2F7 30%, #EC84F3 100%)',
              opacity: isMixerVisible ? 1 : 0.65,
            }}
          />
          <span className="relative z-10 uppercase">Mix</span>
        </button>

        {/* Play Button */}
        <button
          onClick={onPlayClick}
          className="transition-all flex items-center justify-center text-white font-mono text-sm relative overflow-hidden"
          style={{
            width: '124px',
            height: '124px',
            borderRadius: '8px',
            backgroundColor: '#000000',
          }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFD4A3 30%, #FFAB6B 100%)',
              opacity: isPlaylistVisible ? 1 : 0.65,
            }}
          />
          <span className="relative z-10 uppercase">Play</span>
        </button>

        {/* Radio Button */}
        <button
          onClick={onRadioClick}
          className="transition-all flex items-center justify-center text-white font-mono text-sm relative overflow-hidden"
          style={{
            width: '124px',
            height: '124px',
            borderRadius: '8px',
            backgroundColor: '#000000',
          }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFF9A3 30%, #FFE66B 100%)',
              opacity: isRadioVisible ? 1 : 0.65,
            }}
          />
          <span className="relative z-10 uppercase">Radio</span>
        </button>

        {/* Fill Button */}
        <button
          onClick={onFillClick}
          className="transition-all flex items-center justify-center text-white font-mono text-sm relative overflow-hidden"
          style={{
            width: '124px',
            height: '124px',
            borderRadius: '8px',
            backgroundColor: '#000000',
          }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)',
              opacity: 0.65,
            }}
          />
          <span className="relative z-10 uppercase">Fill</span>
        </button>
      </div>
    </div>
  );
}
