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
  isFilled: boolean;
}

export default function WidgetLauncher({
  onMixClick,
  onPlayClick,
  onRadioClick,
  onFillClick,
  isMixerVisible,
  isPlaylistVisible,
  isRadioVisible,
  isFilled
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
          className="group transition-all flex items-center justify-center text-white font-mono text-sm relative overflow-hidden"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '8px',
            backgroundColor: '#000000',
            boxShadow: isMixerVisible ? '0 0 20px 4px rgba(236, 132, 243, 0.6)' : 'none',
          }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at center, #FFFFFF 0%, #F3C2F7 30%, #EC84F3 100%)',
              opacity: isMixerVisible ? 1 : 0.65,
            }}
          />
          <span
            className="relative z-10 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: isMixerVisible ? '#4B5563' : '#FFFFFF' }}
          >
            Mix
          </span>
        </button>

        {/* Radio Button */}
        <button
          onClick={onRadioClick}
          className="group transition-all flex items-center justify-center text-white font-mono text-sm relative overflow-hidden"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '8px',
            backgroundColor: '#000000',
            boxShadow: isRadioVisible ? '0 0 20px 4px rgba(255, 171, 107, 0.6)' : 'none',
          }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFD4A3 30%, #FFAB6B 100%)',
              opacity: isRadioVisible ? 1 : 0.65,
            }}
          />
          <span
            className="relative z-10 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: isRadioVisible ? '#4B5563' : '#FFFFFF' }}
          >
            Radio
          </span>
        </button>

        {/* Play Button */}
        <button
          onClick={onPlayClick}
          className="group transition-all flex items-center justify-center text-white font-mono text-sm relative overflow-hidden"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '8px',
            backgroundColor: '#000000',
            boxShadow: isPlaylistVisible ? '0 0 20px 4px rgba(255, 230, 107, 0.6)' : 'none',
          }}
        >
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: 'radial-gradient(circle at center, #FFFFFF 0%, #FFF9A3 30%, #FFE66B 100%)',
              opacity: isPlaylistVisible ? 1 : 0.65,
            }}
          />
          <span
            className="relative z-10 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ color: isPlaylistVisible ? '#4B5563' : '#FFFFFF' }}
          >
            Play
          </span>
        </button>

        {/* Fill/Reset Button */}
        <button
          onClick={onFillClick}
          className="group transition-all flex items-center justify-center font-mono text-sm relative overflow-hidden"
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '8px',
            backgroundColor: '#000000',
          }}
        >
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{
              background: isFilled
                ? 'radial-gradient(circle at center, #FFFFFF 0%, #FFB8A3 30%, #FF6B6B 100%)'
                : 'radial-gradient(circle at center, #FFFFFF 0%, #A3FFB8 30%, #6BFFAA 100%)',
              opacity: isFilled ? 1 : 0.65,
            }}
          />
          <span
            className="relative z-10 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              color: isFilled ? '#FF3333' : '#FFFFFF'
            }}
          >
            {isFilled ? 'Reset' : 'Fill'}
          </span>
        </button>
      </div>
    </div>
  );
}
