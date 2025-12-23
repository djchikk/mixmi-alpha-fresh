"use client";

import React, { memo, useRef, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SectionSelectorProps {
  sectionLoopPosition: number;
  onSectionPositionChange: (position: number) => void;
  trackDuration: number;
  trackBPM: number;
  loopLength: number;
  className?: string;
  loopEnabled?: boolean; // Whether sectional looping is enabled
  onLoopToggle?: () => void; // Toggle sectional looping on/off
}

const SectionSelectorCompact = memo(function SectionSelectorCompact({
  sectionLoopPosition,
  onSectionPositionChange,
  trackDuration,
  trackBPM,
  loopLength,
  className = '',
  loopEnabled = true,
  onLoopToggle
}: SectionSelectorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // Calculate number of sections
  const calculateSections = (): number => {
    if (!trackDuration || !trackBPM || !loopLength) return 0;
    const barDuration = (60 / trackBPM) * 4; // 4 beats per bar
    const sectionDuration = barDuration * loopLength; // Duration of one section in seconds
    return Math.floor(trackDuration / sectionDuration);
  };
  const numberOfSections = calculateSections();

  // Check scroll position to show/hide arrows
  const checkScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 0);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  };

  // Auto-scroll to active section
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const activeButton = container.querySelector(`[data-section="${sectionLoopPosition}"]`) as HTMLElement;

    if (activeButton) {
      const containerWidth = container.clientWidth;
      const buttonLeft = activeButton.offsetLeft;
      const buttonWidth = activeButton.offsetWidth;
      const scrollLeft = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);

      container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    }

    setTimeout(checkScroll, 100);
  }, [sectionLoopPosition]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const scrollAmount = 80; // Scroll by ~5 buttons
    const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
    scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    setTimeout(checkScroll, 100);
  };

  if (numberOfSections <= 1) return null;

  return (
    <div className={`section-selector-carousel relative flex items-center gap-1 ${className}`}>
      {/* Left Arrow */}
      {showLeftArrow && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 z-10 w-4 h-4 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 rounded-sm transition-colors"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          <ChevronLeft size={10} className="text-slate-400" />
        </button>
      )}

      {/* Center toggle button - shows section range or OFF */}
      <button
        onClick={onLoopToggle}
        className={`px-1.5 py-0.5 rounded text-[8px] font-semibold min-w-[20px] flex-shrink-0 transition-all ${
          loopEnabled
            ? 'bg-[#81E4F2] text-slate-900 shadow-sm shadow-[#81E4F2]/50 hover:scale-105'
            : 'border border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2] hover:bg-slate-700'
        }`}
        title={loopEnabled ? 'Click to disable sectional looping' : 'Click to enable sectional looping'}
      >
        {loopEnabled ? `1-${numberOfSections}` : 'OFF'}
      </button>

      {/* Scrollable section buttons */}
      <div
        ref={scrollContainerRef}
        className="flex gap-0.5 overflow-x-auto scrollbar-hide px-4"
        style={{ maxWidth: '120px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={checkScroll}
      >
        {Array.from({ length: numberOfSections }, (_, i) => (
          <button
            key={i}
            data-section={i}
            onClick={() => onSectionPositionChange(i)}
            className={`section-button px-1 py-0.5 rounded text-[8px] font-semibold min-w-[14px] flex-shrink-0 transition-all ${
              sectionLoopPosition === i
                ? 'bg-[#81E4F2] text-slate-900 shadow-sm shadow-[#81E4F2]/50'
                : 'border border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2] hover:bg-slate-700'
            }`}
            title={`Loop section ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Right Arrow */}
      {showRightArrow && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 z-10 w-4 h-4 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 rounded-sm transition-colors"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          <ChevronRight size={10} className="text-slate-400" />
        </button>
      )}
    </div>
  );
});

export default SectionSelectorCompact;
