"use client";

import React from 'react';
import { SkipForward } from 'lucide-react';

interface AudioWidgetControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkip: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  disabled?: boolean;
}

const AudioWidgetControls: React.FC<AudioWidgetControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onSkip,
  volume,
  onVolumeChange,
  disabled = false
}) => {
  return (
    <div className="flex items-center gap-2 bg-[#81E4F2]/10 rounded-lg px-2 py-2">
      {/* Play/Pause */}
      <button
        onClick={onTogglePlay}
        disabled={disabled}
        className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
          isPlaying
            ? 'bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30'
            : 'border-2 border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isPlaying ? (
          <svg className="w-4 h-4 text-[#81E4F2]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        )}
      </button>

      {/* Skip */}
      <button
        onClick={onSkip}
        disabled={disabled}
        className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Skip track"
      >
        <SkipForward className="w-4 h-4 text-white/70" />
      </button>

      {/* Volume Control */}
      <div className="flex items-center gap-2 flex-1">
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-300 [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>
    </div>
  );
};

export default AudioWidgetControls;
