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

  const color = deck === 'A' ? '#81E4F2' : '#60A5FA';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Previous Section Button */}
      <button
        onClick={handlePrev}
        disabled={!canGoPrev}
        className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
          canGoPrev
            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
            : 'bg-slate-900 text-slate-700 cursor-not-allowed border border-slate-800'
        }`}
        title="Previous section"
      >
        <ChevronLeft size={14} />
      </button>

      {/* Section Display */}
      <div
        className="px-3 py-1 rounded bg-slate-800 border border-slate-600 min-w-[50px] flex items-center justify-center"
        style={{ borderColor: `${color}40` }}
      >
        <div className="text-xs font-bold text-slate-200">
          {startBar}-{endBar}
        </div>
      </div>

      {/* Next Section Button */}
      <button
        onClick={handleNext}
        disabled={!canGoNext}
        className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
          canGoNext
            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-600'
            : 'bg-slate-900 text-slate-700 cursor-not-allowed border border-slate-800'
        }`}
        title="Next section"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
});

export default SectionNavigator;
