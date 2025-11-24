"use client";

import React, { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SectionNavigatorProps {
  currentSection: number; // 0-based section index
  totalSections: number;
  onSectionChange: (section: number) => void;
  deck: 'A' | 'B';
  className?: string;
}

const SectionNavigator = memo(function SectionNavigator({
  currentSection,
  totalSections,
  onSectionChange,
  deck,
  className = ''
}: SectionNavigatorProps) {
  const canGoPrev = currentSection > 0;
  const canGoNext = currentSection < totalSections - 1;

  // Calculate the bar range for display (1-indexed for users)
  const startBar = currentSection * 8 + 1;
  const endBar = Math.min((currentSection + 1) * 8, totalSections * 8);

  const handlePrev = () => {
    if (canGoPrev) {
      onSectionChange(currentSection - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      onSectionChange(currentSection + 1);
    }
  };

  const color = '#FFE4B5'; // Song color (moccasin/wheat)

  return (
    <div className={`flex items-center gap-0.5 w-[72px] h-[20px] ${className}`}>
      {/* Previous Section Button */}
      <button
        onClick={handlePrev}
        disabled={!canGoPrev}
        className="w-[18px] h-[18px] rounded flex items-center justify-center transition-all bg-slate-800 border"
        style={{
          borderColor: canGoPrev ? color : '#1e293b',
          color: canGoPrev ? color : '#475569',
          cursor: canGoPrev ? 'pointer' : 'not-allowed'
        }}
        title="Previous section"
      >
        <ChevronLeft size={10} />
      </button>

      {/* Section Display */}
      <div
        className="flex-1 h-[18px] rounded bg-slate-800 border flex items-center justify-center px-1"
        style={{ borderColor: color }}
      >
        <div className="text-[9px] font-bold leading-tight" style={{ color }}>
          {startBar}-{endBar}
        </div>
      </div>

      {/* Next Section Button */}
      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className="w-[18px] h-[18px] rounded flex items-center justify-center transition-all bg-slate-800 border"
        style={{
          borderColor: canGoNext ? color : '#1e293b',
          color: canGoNext ? color : '#475569',
          cursor: canGoNext ? 'pointer' : 'not-allowed'
        }}
        title="Next section"
      >
        <ChevronRight size={10} />
      </button>
    </div>
  );
});

export default SectionNavigator;
