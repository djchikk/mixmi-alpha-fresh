"use client";

import React, { useState, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { Track } from './types';

interface DeckProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onTrackSelect?: (track: Track) => void;
  onTrackDrop?: (track: Track) => void;
  deck?: 'A' | 'B';
  className?: string;
}

export default function Deck({ 
  currentTrack, 
  isPlaying, 
  onTrackSelect,
  onTrackDrop,
  deck,
  className = "" 
}: DeckProps) {
  const [isNewTrackLoaded, setIsNewTrackLoaded] = useState(false);
  const [previousTrackId, setPreviousTrackId] = useState(currentTrack?.id);

  // Drop functionality for crate tracks and collection tracks
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK'],
    drop: (item: { track: Track; sourceDeck?: string; sourceIndex: number }) => {
      console.log(`🎯 Deck ${deck} received drop:`, item);
      
      if (onTrackDrop) {
        console.log(`✅ Calling onTrackDrop for Deck ${deck}`);
        onTrackDrop(item.track);
      } else {
        console.warn(`❌ No onTrackDrop handler for Deck ${deck}`);
      }
    },
    canDrop: (item) => {
      return true; // Allow all drops for now
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  // Detect when a new track is loaded
  useEffect(() => {
    if (currentTrack && currentTrack.id !== previousTrackId) {
      setIsNewTrackLoaded(true);
      setPreviousTrackId(currentTrack.id);
      
      // Reset the animation after a short duration
      const timeout = setTimeout(() => {
        setIsNewTrackLoaded(false);
      }, 1000);
      
      return () => clearTimeout(timeout);
    }
  }, [currentTrack?.id, previousTrackId]);
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Track Display */}
      <div className="relative h-36 flex items-center justify-center">
        <div 
          ref={drop as any}
          className={`carousel-track current ${currentTrack ? 'has-track' : ''} ${isPlaying ? 'playing' : ''} ${isNewTrackLoaded ? 'new-track-loaded' : ''} ${isOver && canDrop ? 'drop-target' : ''}`}
          style={{
            border: isOver && canDrop ? '3px solid #00FF88' : undefined
          }}
        >
          {currentTrack ? (
            <img src={currentTrack.imageUrl} alt={currentTrack.title} />
          ) : (
            <div className="deck-empty">
              <span className="deck-empty-icon">+</span>
              <span className="deck-empty-text">Load Track</span>
            </div>
          )}

          {isOver && canDrop && (
            <div className="absolute inset-0 bg-cyan-400 opacity-10 rounded-lg flex items-center justify-center">
              <div className="text-white font-bold text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
                Drop to Load
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Track Info */}
      {currentTrack && (
        <div className="track-info text-center" style={{ marginTop: '5px', padding: '0' }}>
          <div className={`text-base font-semibold mb-0.5 transition-colors duration-300 ${isNewTrackLoaded ? 'text-slate-100' : 'text-slate-200'}`}>
            {currentTrack.title}
          </div>
          <div className="text-slate-400 text-sm cursor-pointer hover:text-cyan-400 transition-colors" style={{ color: '#94A3B8' }}>
            by <span className="text-slate-300">{currentTrack.artist} →</span>
          </div>
        </div>
      )}



      <style jsx global>{`
        .carousel-track {
          position: absolute;
          width: 140px;
          height: 140px;
          border-radius: 12px;
          overflow: hidden;
          transition: all 0.3s ease;
          cursor: pointer;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
        }
        
        .carousel-track img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .carousel-track.current {
          position: relative;
          z-index: 2;
          border: 2px solid transparent;
        }
        
        .carousel-track.current.has-track {
          border: 2px solid #81E4F2;
          animation: softGlow 4s ease-in-out infinite;
        }
        
        .carousel-track.current.new-track-loaded {
          border-color: #81E4F2 !important;
        }
        
        @keyframes softGlow {
          0%, 100% { 
            box-shadow: 0 0 6px rgba(129, 228, 242, 0.3);
            border-color: #81E4F2;
            opacity: 0.85;
          }
          50% { 
            box-shadow: 0 0 16px rgba(129, 228, 242, 0.5);
            border-color: #93E8F4;
            opacity: 1;
          }
        }
        
        .carousel-track.current.playing {
          border-color: #81E4F2 !important;
        }
        
        .loop-selector:hover .loop-options {
          opacity: 1;
          pointer-events: all;
        }
        
        .carousel-track.drop-target {
          border-color: #81E4F2 !important;
          box-shadow: 0 0 20px rgba(129, 228, 242, 0.6) !important;
          transform: scale(1.05) !important;
        }
      `}</style>
    </div>
  );
} 