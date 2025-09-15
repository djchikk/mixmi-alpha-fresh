"use client";

import React, { useState, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { Track } from '../types';
import { useToast } from '@/contexts/ToastContext';

interface SimplifiedDeckProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onTrackDrop?: (track: Track) => void;
  deck: 'A' | 'B';
  className?: string;
}

export default function SimplifiedDeckCompact({
  currentTrack,
  isPlaying,
  isLoading = false,
  onTrackDrop,
  deck,
  className = ''
}: SimplifiedDeckProps) {
  const { showToast } = useToast();
  const [isNewTrackLoaded, setIsNewTrackLoaded] = useState(false);
  const [previousTrackId, setPreviousTrackId] = useState(currentTrack?.id);

  // Drop functionality for collection tracks
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD'],
    drop: (item: { track: any; sourceDeck?: string; sourceIndex: number }) => {
      console.log(`🎯 Deck ${deck} received drop:`, item);
      
      if (onTrackDrop) {
        console.log(`✅ Calling onTrackDrop for Deck ${deck}`);
        
        // 🎛️ SMART FILTERING: Only allow loops in mixer
        if (item.track.content_type !== 'loop') {
          const contentTypeName = item.track.content_type === 'loop_pack' ? 'Loop Pack' 
            : item.track.content_type === 'ep' ? 'EP'
            : item.track.content_type === 'full_song' ? 'Song' : 'content';
          
          console.log(`🚫 Mixer: Rejected ${contentTypeName} - Only loops allowed`);
          
          // Show user-friendly error message
          showToast(`🎛️ Only 8-bar loops can be mixed! Try dragging ${contentTypeName}s to the Crate instead.`, 'info');
          return;
        }
        
        // Convert IPTrack format to mixer Track format if needed
        const mixerTrack = {
          id: item.track.id,
          title: item.track.title,
          artist: item.track.artist || item.track.artist_name,
          imageUrl: item.track.imageUrl || (item.track.cover_image_url 
            ? `${item.track.cover_image_url}?t=${Date.now()}&w=64&h=64`
            : ''), // Empty string = fallback to music icon
          audioUrl: item.track.audioUrl || item.track.audio_url, // Fix the audio URL field
          bpm: item.track.bpm || 120,
          content_type: item.track.content_type
        };
        
        console.log('🔄 Converted track for mixer:', mixerTrack);
        onTrackDrop(mixerTrack);
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
    <div className={`relative ${className}`}>
      <div 
        ref={drop as any}
        className="relative"
      >
        <div 
          className={`carousel-track current ${currentTrack ? 'has-track' : ''} ${isPlaying ? 'playing' : ''} ${isNewTrackLoaded ? 'new-track-loaded' : ''} ${isOver && canDrop ? 'drop-target' : ''}`}
          style={{
            border: isOver && canDrop ? '3px solid #00FF88' : undefined
          }}
        >
          {isLoading ? (
            <div className="deck-empty">
              <div className="loading-spinner" />
              <span className="deck-empty-text">Loading...</span>
            </div>
          ) : currentTrack ? (
            <>
              <img src={currentTrack.imageUrl} alt={currentTrack.title} />
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

      <style jsx global>{`
        .carousel-track {
          width: 72px;
          height: 72px;
          border-radius: 8px;
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
        
        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          border-top-color: #81E4F2;
          animation: spin 0.8s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
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
          font-size: 9px;
          font-weight: 500;
          position: relative;
        }
        
        .deck-empty-icon {
          font-size: 16px;
          color: #475569;
          margin-bottom: 4px;
          opacity: 0.8;
        }
        
        .deck-empty-text {
          color: #64748B;
          font-size: 8px;
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