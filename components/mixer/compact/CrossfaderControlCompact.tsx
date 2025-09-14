"use client";

import React, { useRef, memo, useState, useEffect } from 'react';
import { useDebouncedCallback } from '@/hooks/useDebounce';

interface CrossfaderControlProps {
  position: number; // 0-100 (0 = full A, 100 = full B)
  onPositionChange: (position: number) => void;
  className?: string;
}

const CrossfaderControlCompact = memo(function CrossfaderControlCompact({ 
  position, 
  onPositionChange, 
  className = "" 
}: CrossfaderControlProps) {
  const crossfaderRef = useRef<HTMLDivElement>(null);
  
  // Local state for immediate UI updates
  const [localPosition, setLocalPosition] = useState(position);
  
  // Debounced callback for expensive state updates
  const debouncedPositionChange = useDebouncedCallback(onPositionChange, 30);

  const updatePosition = (clientX: number) => {
    if (crossfaderRef.current) {
      const rect = crossfaderRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      
      // Update local state immediately for smooth UI
      setLocalPosition(percentage);
      
      // Debounce the actual state update
      debouncedPositionChange(percentage);
    }
  };
  
  // Sync local position with prop changes
  useEffect(() => {
    setLocalPosition(position);
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    updatePosition(e.clientX);

    const handleMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleClick = (e: React.MouseEvent) => {
    updatePosition(e.clientX);
  };

  return (
    <div className={className}>
      <div 
        ref={crossfaderRef}
        className="crossfader-container"
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div className="crossfader-track">
          <div className="track-marker left"></div>
          <div className="track-marker center"></div>
          <div className="track-marker right"></div>
        </div>
        
        {/* Deck labels removed for compact version */}
        
        {/* Crossfader handle */}
        <div 
          className="crossfader-handle"
          style={{ 
            left: `calc(20px + (100% - 40px) * ${localPosition / 100})`,
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>

      <style jsx global>{`
        .crossfader-container {
          width: 100%; /* Fill parent container */
          height: 34px; /* Match knob height exactly */
          background: transparent;
          position: relative;
          cursor: pointer;
          /* border removed for compact version */
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .crossfader-track {
          position: absolute;
          top: 50%;
          left: 20px;
          right: 20px;
          height: 4px;
          background: rgba(71, 85, 105, 0.5);
          transform: translateY(-50%);
        }
        
        .track-marker {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 1px;
          height: 8px;
          background: #64748B;
          opacity: 0.6;
        }
        
        .track-marker.left { 
          left: 25%; 
        }
        
        .track-marker.center { 
          left: 50%; 
          height: 12px;
          width: 1px;
          background: #64748B;
          opacity: 0.8;
          transform: translate(-50%, -50%);
        }
        
        .track-marker.right { 
          right: 25%; 
        }
        
        .crossfader-handle {
          position: absolute;
          top: 50%;
          width: 15px;
          height: 34px;
          background: #334155;
          border: 2px solid #94A3B8;
          border-radius: 10px;
          cursor: grab;
          z-index: 10;
          transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        
        .crossfader-handle::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 3px;
          height: 70%;
          background: #81E4F2;
          box-shadow: 0 0 4px rgba(129, 228, 242, 0.5);
        }
        
        .crossfader-handle:hover {
          border-color: #81E4F2;
        }
        
        .crossfader-handle:active {
          cursor: grabbing;
          border-color: #81E4F2;
        }
      `}</style>
    </div>
  );
});

export default CrossfaderControlCompact; 