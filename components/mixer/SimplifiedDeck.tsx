"use client";

import React, { useState, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { Track } from './types';

interface SimplifiedDeckProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onTrackDrop?: (track: Track) => void;
  deck: 'A' | 'B';
  className?: string;
  trackInfoPosition?: 'left' | 'right' | 'bottom' | 'none';
}

export default function SimplifiedDeck({
  currentTrack,
  isPlaying,
  onTrackDrop,
  deck,
  className = '',
  trackInfoPosition = 'bottom'
}: SimplifiedDeckProps) {
  const [isNewTrackLoaded, setIsNewTrackLoaded] = useState(false);
  const [previousTrackId, setPreviousTrackId] = useState(currentTrack?.id);
  const [isHovered, setIsHovered] = useState(false);

  // Drop functionality for collection tracks
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
    <div className={`flex ${trackInfoPosition === 'left' ? 'flex-row-reverse' : trackInfoPosition === 'right' ? 'flex-row' : 'flex-col'} ${trackInfoPosition === 'bottom' ? '' : 'items-center'} ${trackInfoPosition === 'bottom' ? '' : 'gap-4'} ${className}`}>
      <div
        ref={drop as any}
        className="relative flex-shrink-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={`carousel-track current ${currentTrack ? 'has-track' : ''} ${isPlaying ? 'playing' : ''} ${isNewTrackLoaded ? 'new-track-loaded' : ''} ${isOver && canDrop ? 'drop-target' : ''}`}
          style={{
            border: isOver && canDrop ? '3px solid #00FF88' : undefined
          }}
        >
          {currentTrack ? (
            <>
              <img src={currentTrack.imageUrl} alt={currentTrack.title} />

              {/* Subtle dark overlay */}
              <div className="absolute inset-0 bg-black opacity-20 pointer-events-none"></div>

              {/* Hover overlay with track info */}
              {isHovered && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col justify-center items-center p-2 rounded-lg transition-opacity duration-200">
                  <div className="text-white text-sm font-semibold text-center mb-1 line-clamp-2">
                    {currentTrack.title}
                  </div>
                  <div className="text-gray-300 text-xs text-center">
                    {currentTrack.artist}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {currentTrack.bpm} BPM
                  </div>
                </div>
              )}
            </>
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

      {/* Track Info Display */}
      {currentTrack && trackInfoPosition !== 'none' && (
        <div className={`max-w-[140px] ${trackInfoPosition === 'bottom' ? 'mt-2 text-center' : ''} ${trackInfoPosition === 'left' ? 'text-left' : trackInfoPosition === 'right' ? 'text-left' : 'text-center'}`}>
          <div className="text-white text-sm font-bold truncate">
            {currentTrack.title} - {currentTrack.bpm}
          </div>
          <div className="text-slate-400 text-xs truncate">
            by {currentTrack.artist} →
          </div>
        </div>
      )}

      <style jsx global>{`
        .carousel-track {
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
        
        .deck-empty {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #1A1A2E;
          color: #64748B;
          font-size: 13px;
          font-weight: 500;
          position: relative;
        }
        
        .deck-empty-icon {
          font-size: 28px;
          color: #475569;
          margin-bottom: 6px;
          opacity: 0.8;
        }
        
        .deck-empty-text {
          color: #64748B;
          font-size: 12px;
          opacity: 0.9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .carousel-track.drop-target {
          transform: scale(1.05);
          border-color: #00FF88 !important;
          box-shadow: 0 0 20px rgba(0, 255, 136, 0.3);
        }
      `}</style>
    </div>
  );
}