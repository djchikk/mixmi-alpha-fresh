"use client";

import React, { memo, useRef, useState } from 'react';

interface VerticalVolumeSliderProps {
  volume: number; // 0-100
  onVolumeChange: (volume: number) => void;
  deck: 'A' | 'B';
  className?: string;
}

const VerticalVolumeSlider = memo(function VerticalVolumeSlider({
  volume,
  onVolumeChange,
  deck,
  className = ''
}: VerticalVolumeSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateVolume(e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      updateVolume(e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateVolume = (clientY: number) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const percentage = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
    onVolumeChange(Math.round(percentage));
  };

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const color = deck === 'A' ? '#81E4F2' : '#60A5FA'; // Cyan for A, Blue for B

  return (
    <div className={`vertical-volume-slider flex flex-col items-center ${className}`}>
      {/* Volume label */}
      <div className="text-[8px] text-slate-500 mb-0.5 font-mono">
        {volume}
      </div>

      {/* Slider track - ultra minimal */}
      <div
        ref={sliderRef}
        className="relative w-[2px] h-16 bg-slate-700/40 cursor-pointer"
        onMouseDown={handleMouseDown}
        style={{ touchAction: 'none' }}
      >
        {/* Fill */}
        <div
          className="absolute bottom-0 left-0 right-0 transition-all"
          style={{
            height: `${volume}%`,
            backgroundColor: color,
            opacity: 0.7
          }}
        />

        {/* Thumb - minimal rectangle */}
        <div
          className="absolute left-1/2 transform -translate-x-1/2 w-1.5 h-0.5 transition-all"
          style={{
            bottom: `calc(${volume}% - 1px)`,
            backgroundColor: color,
            opacity: isDragging ? 1 : 0.9
          }}
        />
      </div>
    </div>
  );
});

export default VerticalVolumeSlider;
