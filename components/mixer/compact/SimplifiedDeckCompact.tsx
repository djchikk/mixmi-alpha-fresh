"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import { Track } from '../types';
import { useToast } from '@/contexts/ToastContext';
import { GripVertical, Radio, Music2 } from 'lucide-react';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';

interface SimplifiedDeckProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading?: boolean;
  onTrackDrop?: (track: Track) => void;
  onPackDrop?: (pack: any) => void; // New prop for handling pack drops
  onTrackClear?: () => void; // New prop for clearing deck
  onDragOver?: (isOver: boolean) => void; // Callback when drag is over this deck
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
  onDragOver,
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
        return '#A084F9'; // Purple - loops
      case 'radio_station':
        return '#FFC044'; // Orange - live radio (official radio orange)
      case 'grabbed_radio':
        return '#FFC044'; // Orange - grabbed moments (official radio orange)
      case 'full_song':
        return '#A8E66B'; // Gold - songs
      case 'video_clip':
        return '#5BB5F9'; // Sky blue - video clips
      default:
        return '#A084F9'; // Default purple
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
  const [{ isOver, canDrop, isGlobeDrag, isVideoDrag }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD', 'GLOBE_CARD', 'RADIO_TRACK'],
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

        // 🎛️ SMART FILTERING: Allow loops, songs, radio stations, grabbed radio, and video clips in mixer
        const allowedTypes = ['loop', 'full_song', 'radio_station', 'grabbed_radio', 'video_clip'];
        if (!allowedTypes.includes(item.track.content_type)) {
          const contentTypeName = item.track.content_type;
          console.log(`🚫 Mixer: Rejected ${contentTypeName} - Not a playable type`);
          showToast(`🎛️ ${contentTypeName} cannot be played in the mixer. Try dragging to the Crate or Playlist instead.`, 'info', 5000);
          return;
        }

        // 🎬 Video redirect notification - let user know video goes to Video Widget
        if (item.track.content_type === 'video_clip') {
          console.log(`🎬 Video clip detected on Deck ${deck} - will display in Video Widget`);
          showToast(`🎬 Video loaded to Deck ${deck}! Check the Video Widget for playback.`, 'success', 3000);
        }

        // Use proper image optimization
        const optimizedImageUrl = getOptimizedTrackImage(item.track, 64);

        // Debug logging removed - video integration working

        // Convert IPTrack format to mixer Track format if needed
        // For radio stations, preserve stream_url as separate field for proxying
        // For video clips, preserve video_url for video playback
        // IMPORTANT: Preserve ALL metadata for remix genealogy and aggregation
        const mixerTrack = {
          id: item.track.id,
          title: item.track.title,
          artist: item.track.artist || item.track.artist_name,
          imageUrl: optimizedImageUrl,
          cover_image_url: item.track.cover_image_url, // Preserve original cover URL
          audioUrl: item.track.audioUrl || item.track.audio_url,
          bpm: item.track.bpm, // Preserve original bpm (may be null for undetected)
          content_type: item.track.content_type,
          pack_position: item.track.pack_position, // Preserve for number badges
          is_draft: (item.track as any).is_draft, // Preserve draft status for badge
          notes: item.track.notes, // Preserve notes for CC text overlay
          // Preserve metadata for remix aggregation
          tags: item.track.tags,
          primary_location: item.track.primary_location,
          locations: item.track.locations,
          location_lat: item.track.location_lat,
          location_lng: item.track.location_lng,
          // Preserve remix genealogy fields
          remix_depth: item.track.remix_depth,
          generation: item.track.generation,
          source_track_ids: item.track.source_track_ids,
          source_tracks_metadata: item.track.source_tracks_metadata,
          // Preserve ownership fields
          primary_uploader_wallet: item.track.primary_uploader_wallet,
          composition_split_1_wallet: item.track.composition_split_1_wallet,
          composition_split_1_percentage: item.track.composition_split_1_percentage,
          composition_split_1_sui_address: item.track.composition_split_1_sui_address,
          production_split_1_wallet: item.track.production_split_1_wallet,
          production_split_1_percentage: item.track.production_split_1_percentage,
          production_split_1_sui_address: item.track.production_split_1_sui_address,
          // Preserve stream_url for radio stations (needed for proxying)
          ...(item.track.content_type === 'radio_station' && item.track.stream_url && {
            stream_url: item.track.stream_url
          }),
          // Preserve video_url for video clips (needed for video playback)
          // If video_url is missing, use audioUrl since it points to the same MP4 file
          ...(item.track.content_type === 'video_clip' && {
            video_url: (item.track as any).video_url || item.track.audioUrl
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
    collect: (monitor) => {
      const item = monitor.getItem() as { track: any; source?: string } | null;
      const isVideoDrag = item?.track?.content_type === 'video_clip';
      return {
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
        isGlobeDrag: item?.source === 'globe',
        isVideoDrag,
      };
    },
  }));

  // Notify parent when drag is over this deck (but not for video drags)
  useEffect(() => {
    onDragOver?.(isOver && !isVideoDrag);
  }, [isOver, isVideoDrag, onDragOver]);

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
    <div className={`relative ${className}`} style={{ overflow: 'visible' }}>
      <div
        ref={drop as any}
        className="relative p-16"
        style={{ margin: '-64px', overflow: 'visible' }}
      >

        <div
          key={currentTrack?.id || 'empty'}
          className={`carousel-track current pointer-events-auto ${currentTrack ? 'has-track' : ''} ${isPlaying ? 'playing' : ''} ${isNewTrackLoaded ? 'new-track-loaded' : ''} ${isOver && canDrop && !isDragging && !isVideoDrag ? 'drop-target-active' : ''}`}
          style={{
            '--border-color': borderColor,
            zIndex: 2,
            position: 'relative'
          } as React.CSSProperties & { '--border-color': string }}
        >
          {isLoading ? (
            <div className="deck-empty">
              <div className="loading-spinner" />
              <span className="deck-empty-text">Loading...</span>
            </div>
          ) : currentTrack && contentType !== 'video_clip' ? (
            /* Only show track content for non-video content (videos go to Video Widget) */
            <div
              className="relative w-full h-full group"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              {/* Image or gradient fallback for tracks without images */}
              {currentTrack.imageUrl ? (
                <img src={currentTrack.imageUrl} alt={currentTrack.title} className="w-full h-full object-cover" />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
                >
                  <svg className="w-6 h-6 text-white opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}

              {/* Draft badge - top left for draft tracks */}
              {(currentTrack as any).is_draft && (
                <div
                  className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded text-[6px] font-bold uppercase tracking-wide pointer-events-none z-10"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    color: '#A084F9',
                    border: '1px dashed #A084F9'
                  }}
                >
                  Draft
                </div>
              )}

              {/* Pack position badge - top left (shifted if draft badge present) - uses content type color */}
              {currentTrack.pack_position && !(currentTrack as any).is_draft && (
                <div
                  className="absolute top-1 left-1 w-5 h-5 rounded text-xs font-bold flex items-center justify-center pointer-events-none z-10"
                  style={{
                    backgroundColor: borderColor,
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
                style={{
                  cursor: isDragging ? 'grabbing' : 'grab',
                  pointerEvents: (isGlobeDrag || (isOver && canDrop)) ? 'none' : 'auto' // Allow drops to pass through when dragging from globe
                }}
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
              <Music2 size={18} strokeWidth={1.5} className="deck-empty-icon" />
              <span className="deck-empty-text">Drop Here</span>
            </div>
          )}

          {/* Subtle content-type colored fill overlay when dragging over (not for videos) */}
          {isOver && canDrop && !isDragging && !isVideoDrag && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{ backgroundColor: `${borderColor}30` }}
            />
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
          border: 2px solid var(--border-color, #A084F9);
        }

        .carousel-track.current.new-track-loaded {
          border-color: var(--border-color, #A084F9) !important;
        }


        .carousel-track.current.playing {
          border-color: var(--border-color, #A084F9) !important;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          border-top-color: var(--border-color, #A084F9);
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
          margin-bottom: 4px;
          animation: pulse-grey 5s ease-in-out infinite;
        }

        @keyframes pulse-grey {
          0%, 100% {
            color: rgba(148, 163, 184, 0.5); /* slate-400 at 50% */
          }
          50% {
            color: rgba(203, 213, 225, 0.8); /* slate-300 at 80% */
          }
        }

        .deck-empty-text {
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          animation: pulse-grey 5s ease-in-out infinite;
        }
        
        .carousel-track.drop-target-active {
          transform: scale(1.1);
          border-width: 3px;
          border-color: var(--border-color, #A084F9) !important;
          animation: pulse-border 1s ease-in-out infinite;
        }

        @keyframes pulse-border {
          0%, 100% {
            border-color: var(--border-color, #A084F9);
            transform: scale(1.1);
          }
          50% {
            border-color: var(--border-color, #A084F9);
            opacity: 0.7;
            transform: scale(1.12);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}