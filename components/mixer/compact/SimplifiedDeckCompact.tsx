"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { Track } from '../types';
import { useToast } from '@/contexts/ToastContext';
import { GripVertical, Radio } from 'lucide-react';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';

interface SimplifiedDeckProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onTrackDrop?: (track: Track) => void;
  onPackDrop?: (pack: any) => void; // New prop for handling pack drops
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
  onPackDrop,
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

  // Video ref for programmatic playback control
  const videoRef = useRef<HTMLVideoElement>(null);

  // Get border color based on content type
  const getBorderColor = () => {
    switch (contentType) {
      case 'loop':
        return '#9772F4'; // Purple - loops
      case 'radio_station':
        return '#FB923C'; // Orange - live radio (official radio orange)
      case 'grabbed_radio':
        return '#FB923C'; // Orange - grabbed moments (official radio orange)
      case 'full_song':
        return '#FFE4B5'; // Gold - songs
      case 'video_clip':
        return '#38BDF8'; // Sky blue - video clips
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
      
      // 📦 Check if this is a pack - if so, unpack it!
      if (item.track.content_type === 'loop_pack' ||
          item.track.content_type === 'ep' ||
          item.track.content_type === 'station_pack') {
        console.log(`📦 Pack detected, unpacking to Deck ${deck} crate:`, item.track);
        if (onPackDrop) {
          onPackDrop(item.track);
        }
        return;
      }

      if (onTrackDrop) {
        console.log(`✅ Calling onTrackDrop for Deck ${deck}`);

        // 🎛️ SMART FILTERING: Allow loops, songs, radio stations, and grabbed radio in mixer
        const allowedTypes = ['loop', 'full_song', 'radio_station', 'grabbed_radio'];
        if (!allowedTypes.includes(item.track.content_type)) {
          const contentTypeName = item.track.content_type;
          console.log(`🚫 Mixer: Rejected ${contentTypeName} - Not a playable type`);
          showToast(`🎛️ ${contentTypeName} cannot be played in the mixer. Try dragging to the Crate or Playlist instead.`, 'info', 5000);
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
        // For radio stations, preserve stream_url as separate field for proxying
        const mixerTrack = {
          id: item.track.id,
          title: item.track.title,
          artist: item.track.artist || item.track.artist_name,
          imageUrl: optimizedImageUrl,
          audioUrl: item.track.audioUrl || item.track.audio_url,
          bpm: item.track.bpm, // Preserve original bpm (may be null for undetected)
          content_type: item.track.content_type,
          pack_position: item.track.pack_position, // Preserve for number badges
          // Preserve stream_url for radio stations (needed for proxying)
          ...(item.track.content_type === 'radio_station' && item.track.stream_url && {
            stream_url: item.track.stream_url
          })
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

  // Sync video playback with transport controls
  useEffect(() => {
    if (!videoRef.current || contentType !== 'video_clip') return;

    const video = videoRef.current;

    if (isPlaying) {
      // Play video when deck is playing
      video.play().catch(err => {
        console.warn(`🎥 Deck ${deck} video autoplay prevented:`, err);
      });
    } else {
      // Pause video when deck is stopped
      video.pause();
    }
  }, [isPlaying, contentType, deck]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={drop as any}
        className="relative p-12 pointer-events-none"
        style={{ margin: '-48px' }}
      >
        <div
          key={currentTrack?.id || 'empty'}
          className={`carousel-track current pointer-events-auto ${currentTrack ? 'has-track' : ''} ${isPlaying ? 'playing' : ''} ${isNewTrackLoaded ? 'new-track-loaded' : ''} ${isOver && canDrop && !isDragging ? 'drop-target-active' : ''}`}
          style={{
            '--border-color': borderColor,
            boxShadow: isOver && canDrop && !isDragging ? `0 0 30px ${borderColor}80, 0 0 60px ${borderColor}40` : undefined
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
              {/* Render video for video_clip content, otherwise image */}
              {contentType === 'video_clip' && (currentTrack as any).video_url ? (
                <video
                  ref={videoRef}
                  src={(currentTrack as any).video_url}
                  className="w-full h-full object-cover"
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img src={currentTrack.imageUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
              )}

              {/* Pack position badge - top left */}
              {currentTrack.pack_position && (
                <div
                  className="absolute top-1 left-1 w-5 h-5 rounded text-xs font-bold flex items-center justify-center pointer-events-none z-10"
                  style={{
                    backgroundColor: contentType === 'radio_station' ? '#FB923C' : '#9772F4',
                    color: '#FFFFFF'
                  }}
                >
                  {currentTrack.pack_position}
                </div>
              )}

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

              {/* BPM display - always visible in lower right (except for radio stations) */}
              {contentType !== 'radio_station' && contentType !== 'grabbed_radio' && (
                <div className="absolute bottom-[2px] right-1 text-[11px] text-white font-mono font-bold leading-none pointer-events-none">
                  {currentTrack.bpm || '~'}
                </div>
              )}

              {/* Radio icon - lower left on hover for radio stations */}
              {(contentType === 'radio_station' || contentType === 'grabbed_radio') && isHovered && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Send to radio player
                    if (typeof window !== 'undefined' && (window as any).loadRadioTrack) {
                      (window as any).loadRadioTrack(currentTrack);
                    }
                  }}
                  className="absolute bottom-0.5 left-0.5 transition-all hover:scale-110 z-10"
                  title="Send station to radio player for continuous play"
                >
                  <Radio className="w-3.5 h-3.5 text-white" />
                </button>
              )}

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
              <span className="deck-empty-text">Drop Here</span>
            </div>
          )}

          {isOver && canDrop && !isDragging && (
            <div className="absolute inset-0 bg-cyan-400 opacity-20 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="text-white font-bold text-xs bg-black bg-opacity-70 px-2 py-1 rounded">
                {currentTrack ? 'Replace' : 'Drop to Load'}
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
        
        .carousel-track.drop-target-active {
          transform: scale(1.1);
          border-width: 3px;
          border-color: var(--border-color, #9772F4) !important;
          animation: pulse-border 1s ease-in-out infinite;
        }

        @keyframes pulse-border {
          0%, 100% {
            border-color: var(--border-color, #9772F4);
            transform: scale(1.1);
          }
          50% {
            border-color: var(--border-color, #9772F4);
            opacity: 0.7;
            transform: scale(1.12);
          }
        }
      `}</style>
    </div>
  );
}