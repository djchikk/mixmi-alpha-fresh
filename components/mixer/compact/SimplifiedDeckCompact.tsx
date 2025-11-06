"use client";

import React, { useState, useEffect } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { Track } from '../types';
import { useToast } from '@/contexts/ToastContext';
import { GripVertical } from 'lucide-react';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';

interface SimplifiedDeckProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onTrackDrop?: (track: Track) => void;
  onTrackClear?: () => void; // New prop for clearing deck
  deck: 'A' | 'B';
  contentType?: string; // Content type for dynamic border colors
  className?: string;
}

export default function SimplifiedDeckCompact({
  currentTrack,
  isPlaying,
  isLoading = false,
  onTrackDrop,
  onTrackClear,
  deck,
  contentType,
  className = ''
}: SimplifiedDeckProps) {
  const { showToast } = useToast();
  const [isNewTrackLoaded, setIsNewTrackLoaded] = useState(false);
  const [previousTrackId, setPreviousTrackId] = useState(currentTrack?.id);
  const [isHovered, setIsHovered] = useState(false);
  const [dropZoneActive, setDropZoneActive] = useState(false);

  // Get border color based on content type
  const getBorderColor = () => {
    switch (contentType) {
      case 'loop':
        return '#9772F4'; // Purple - loops
      case 'radio_station':
        return '#FF6B35'; // Orange - live radio
      case 'grabbed_radio':
        return '#F72585'; // Hot pink - grabbed moments
      case 'full_song':
        return '#FFE4B5'; // Gold - songs
      default:
        return '#9772F4'; // Default purple
    }
  };

  const borderColor = getBorderColor();

  // Drag functionality for deck tracks back to Crate
  const [{ isDragging }, dragRef] = useDrag(() => ({
    type: 'TRACK_CARD', // Use TRACK_CARD to match Crate expectations
    item: () => {
      if (currentTrack) {
        console.log(`🎛️ Deck ${deck} track being dragged back to Crate:`, currentTrack);
        return { track: currentTrack, sourceIndex: -1 }; // -1 indicates from deck
      }
      return null;
    },
    end: (item, monitor) => {
      const didDrop = monitor.didDrop();
      if (!didDrop && onTrackClear) {
        onTrackClear();
      }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => !!currentTrack, // Only draggable if track exists
  }), [currentTrack, deck, onTrackClear]);

  // Drop functionality for collection tracks  
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD'],
    drop: (item: { track: any; sourceDeck?: string; sourceIndex: number }) => {
      console.log(`🎯 Deck ${deck} received drop:`, item);
      
      if (onTrackDrop) {
        console.log(`✅ Calling onTrackDrop for Deck ${deck}`);
        
        // 🎛️ SMART FILTERING: Allow loops, radio stations, and grabbed radio in mixer
        if (item.track.content_type !== 'loop' &&
            item.track.content_type !== 'radio_station' &&
            item.track.content_type !== 'grabbed_radio') {
          const contentTypeName = item.track.content_type === 'loop_pack' ? 'Loop Pack'
            : item.track.content_type === 'ep' ? 'EP'
            : item.track.content_type === 'full_song' ? 'Song' : 'content';

          console.log(`🚫 Mixer: Rejected ${contentTypeName} - Only loops and radio allowed`);

          // Show user-friendly error message with specific guidance
          let message = '';
          if (item.track.content_type === 'loop_pack') {
            message = '🎛️ This is a Loop Pack! Click the chevron to expand it, or drag it to the Crate or Playlist to add all loops at once.';
          } else if (item.track.content_type === 'ep') {
            message = '🎛️ This is an EP! Click the chevron to expand it, or drag it to the Crate or Playlist to add all songs at once.';
          } else if (item.track.content_type === 'full_song') {
            message = '🎵 Songs can\'t be mixed! Only 8-bar loops work in the mixer. Try dragging songs to the Crate or Playlist instead.';
          } else {
            message = `🎛️ Only 8-bar loops can be mixed! Try dragging ${contentTypeName}s to the Crate or Playlist instead.`;
          }

          showToast(message, 'info', 5000); // Show for 5 seconds
          return;
        }
        
        // Use proper image optimization
        const optimizedImageUrl = getOptimizedTrackImage(item.track, 64);

        console.log('🎛️ DECK DROP DEBUG:', {
          originalUrl: item.track.imageUrl || item.track.cover_image_url,
          optimizedUrl: optimizedImageUrl,
          trackId: item.track.id
        });

        // Convert IPTrack format to mixer Track format if needed
        // For radio stations, prioritize stream_url
        const audioUrl = item.track.content_type === 'radio_station'
          ? (item.track.stream_url || item.track.audioUrl || item.track.audio_url)
          : (item.track.audioUrl || item.track.audio_url);

        const mixerTrack = {
          id: item.track.id,
          title: item.track.title,
          artist: item.track.artist || item.track.artist_name,
          imageUrl: optimizedImageUrl,
          audioUrl: audioUrl,
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

  // Detect when a new track is loaded or cleared
  useEffect(() => {
    if (currentTrack && currentTrack.id !== previousTrackId) {
      setIsNewTrackLoaded(true);
      setPreviousTrackId(currentTrack.id);

      // Reset the animation after a short duration
      const timeout = setTimeout(() => {
        setIsNewTrackLoaded(false);
      }, 1000);

      return () => clearTimeout(timeout);
    } else if (!currentTrack && previousTrackId) {
      // Track was cleared, reset previous track ID
      setPreviousTrackId(null);
      setIsNewTrackLoaded(false);
    }
  }, [currentTrack?.id, previousTrackId]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={drop as any}
        className="relative p-2"
        style={{ margin: '-8px' }}
      >
        <div
          key={currentTrack?.id || 'empty'}
          className={`carousel-track current ${currentTrack ? 'has-track' : ''} ${isPlaying ? 'playing' : ''} ${isNewTrackLoaded ? 'new-track-loaded' : ''} ${isOver && canDrop && !isDragging && !currentTrack ? 'drop-target' : ''}`}
          style={{
            border: isOver && canDrop && !isDragging && !currentTrack ? `3px solid ${borderColor}` : undefined,
            '--border-color': borderColor
          } as React.CSSProperties & { '--border-color': string }}
        >
          {isLoading ? (
            <div className="deck-empty">
              <div className="loading-spinner" />
              <span className="deck-empty-text">Loading...</span>
            </div>
          ) : currentTrack ? (
            <div
              className="relative w-full h-full group"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <img src={currentTrack.imageUrl} alt={currentTrack.title} className="w-full h-full object-cover" />

              {/* Dark overlay on hover */}
              {isHovered && (
                <div className="absolute inset-0 bg-black bg-opacity-70 pointer-events-none" />
              )}

              {/* Invisible drag area - still draggable but no visible handle */}
              <div
                ref={dragRef}
                className="absolute inset-0"
                title={`Drag Deck ${deck} to Crate`}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              />

              {/* BPM display - always visible in lower right */}
              <div className="absolute bottom-[2px] right-1 text-[11px] text-white font-mono font-bold leading-none pointer-events-none">
                {currentTrack.bpm || 120}
              </div>

              {/* Remove button - top right, only on hover */}
              {isHovered && onTrackClear && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTrackClear();
                  }}
                  className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center transition-all hover:scale-110 z-10"
                  title={`Clear Deck ${deck}`}
                >
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div
              className="deck-empty"
              title="Drag loops from the globe, crate, playlist, or search"
            >
              <span className="deck-empty-icon">+</span>
              <span className="deck-empty-text">Load Loop</span>
            </div>
          )}

          {isOver && canDrop && !isDragging && !currentTrack && (
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
        }
        
        .carousel-track.current:not(.has-track) {
          border: 2px solid transparent;
        }

        .carousel-track.current.has-track {
          border: 2px solid var(--border-color, #9772F4);
        }

        .carousel-track.current.new-track-loaded {
          border-color: var(--border-color, #9772F4) !important;
        }


        .carousel-track.current.playing {
          border-color: var(--border-color, #9772F4) !important;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          border-top-color: var(--border-color, #9772F4);
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
          border-color: var(--border-color, #9772F4) !important;
          box-shadow: 0 0 20px rgba(151, 114, 244, 0.3);
        }
      `}</style>
    </div>
  );
}