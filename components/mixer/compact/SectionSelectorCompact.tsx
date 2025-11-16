"use client";

import React, { memo } from 'react';

interface SectionSelectorProps {
  sectionLoopPosition: number;
  onSectionPositionChange: (position: number) => void;
  trackDuration: number;
  trackBPM: number;
  loopLength: number;
  className?: string;
}

const SectionSelectorCompact = memo(function SectionSelectorCompact({
  sectionLoopPosition,
  onSectionPositionChange,
  trackDuration,
  trackBPM,
  loopLength,
  className = ''
}: SectionSelectorProps) {
  // Calculate number of sections
  const calculateSections = (): number => {
    if (!trackDuration || !trackBPM || !loopLength) return 0;
    const barDuration = (60 / trackBPM) * 4; // 4 beats per bar
    const sectionDuration = barDuration * loopLength; // Duration of one section in seconds
    return Math.floor(trackDuration / sectionDuration);
  };
  const numberOfSections = calculateSections();

  if (numberOfSections <= 1) return null;

  return (
    <div className={`section-selector flex items-center justify-center gap-0.5 ${className}`}>
      {Array.from({ length: Math.min(numberOfSections, 12) }, (_, i) => (
        <button
          key={i}
          onClick={() => onSectionPositionChange(i)}
          className={`section-button px-1 py-0.5 rounded text-[8px] font-semibold min-w-[14px] transition-all ${
            sectionLoopPosition === i
              ? 'bg-[#81E4F2] text-slate-900 shadow-sm shadow-[#81E4F2]/50'
              : 'border border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2] hover:bg-slate-700'
          }`}
          title={`Loop section ${i + 1}`}
        >
          {i + 1}
        </button>
      ))}
      {numberOfSections > 12 && (
        <span className="text-[8px] text-slate-500">+{numberOfSections - 12}</span>
      )}
    </div>
  );
});

export default SectionSelectorCompact;
