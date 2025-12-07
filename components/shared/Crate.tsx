'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useMixer } from '@/contexts/MixerContext';
import { useDrop, useDrag } from 'react-dnd';
import { IPTrack } from '@/types';
import { Play, Pause, Info, GripVertical, X, ChevronRight, ChevronLeft, Radio } from 'lucide-react';
import TrackCard from '@/components/cards/TrackCard';
import TrackDetailsModal from '@/components/modals/TrackDetailsModal';
import InfoIcon from '@/components/shared/InfoIcon';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import { supabase } from '@/lib/supabase';

// Extend window interface for global handlers
declare global {
  interface Window {
    handleGlobeComparisonTrack?: (track: any) => void;
  }
}

interface CrateProps {
  className?: string;
}

// Draggable track component for mixer context
interface DraggableTrackProps {
  track: any;
  index: number;
  children: React.ReactNode;
  onRemove: () => void;
}

function DraggableTrack({ track, index, children, onRemove }: DraggableTrackProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'COLLECTION_TRACK',
    item: () => {
      return {
        track: {
          id: track.id,
          title: track.title,
          artist: track.artist,
          imageUrl: track.imageUrl || (track as any).cover_image_url, // Use existing imageUrl or fallback
          cover_image_url: (track as any).cover_image_url, // Keep original high-res URL for preview
          bpm: track.bpm, // Preserve original bpm (may be null for undetected)
          audioUrl: track.audioUrl || track.audio_url || (track as any).stream_url, // Handle both formats, include stream_url for radio!
          audio_url: track.audio_url, // Preserve original property
          stream_url: (track as any).stream_url, // Include stream_url for radio stations
          video_url: (track as any).video_url, // Include video_url for video clips
          notes: track.notes, // Include notes for CC text overlay
          content_type: track.content_type,
          price_stx: track.price_stx,
          license: track.license,
          primary_uploader_wallet: track.primary_uploader_wallet
        },
        sourceIndex: index
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track, index]);

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      {children}
    </div>
  );
}

// Draggable component for expanded pack tracks
interface ExpandedPackTrackProps {
  packTrack: IPTrack;
  packIndex: number;
  parentTrack: any;
  playingTrack: string | null;
  handleTrackClick: (track: any) => void;
  getBorderColor: (track: any) => string;
  getBorderThickness: (track: any) => string;
}

function ExpandedPackTrack({
  packTrack,
  packIndex,
  parentTrack,
  playingTrack,
  handleTrackClick,
  getBorderColor,
  getBorderThickness
}: ExpandedPackTrackProps) {
  const [isPackTrackHovered, setIsPackTrackHovered] = React.useState(false);
  const [{ isDragging: isPackTrackDragging }, packDrag] = useDrag(() => ({
    type: 'COLLECTION_TRACK',
    item: () => ({
      track: {
        id: packTrack.id,
        title: packTrack.title,
        artist: packTrack.artist,
        imageUrl: getOptimizedTrackImage(packTrack, 64),
        cover_image_url: packTrack.cover_image_url,
        bpm: packTrack.bpm, // Preserve original bpm (may be null for undetected)
        audioUrl: packTrack.audio_url || packTrack.stream_url,
        audio_url: packTrack.audio_url,
        stream_url: packTrack.stream_url,
        video_url: (packTrack as any).video_url, // Include video_url for video clips
        notes: packTrack.notes, // Include notes for CC text overlay
        content_type: packTrack.content_type,
        price_stx: packTrack.price_stx,
        license: packTrack.license,
        pack_position: packTrack.pack_position // Preserve pack position for numbered badges
      },
      sourceIndex: -1
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [packTrack]);

  const badgeColor = parentTrack.content_type === 'ep' ? '#D4AF37' : parentTrack.content_type === 'station_pack' ? '#FB923C' : '#9772F4';
  const textColor = parentTrack.content_type === 'ep' ? '#000000' : '#FFFFFF';

  return (
    <div
      ref={packDrag}
      style={{
        position: 'relative',
        flexShrink: 0,
        opacity: isPackTrackDragging ? 0.5 : 1
      }}
    >
      <div
        className={`cursor-grab transition-all ${getBorderColor(packTrack)} ${getBorderThickness(packTrack)}`}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '8px',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#1a1a1a'
        }}
        onClick={() => handleTrackClick({
          ...packTrack,
          audioUrl: packTrack.audio_url || packTrack.stream_url
        })}
        onMouseEnter={() => setIsPackTrackHovered(true)}
        onMouseLeave={() => setIsPackTrackHovered(false)}
      >
        <img
          src={getOptimizedTrackImage(packTrack, 64)}
          alt={packTrack.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />

        {/* Dark overlay on hover */}
        {isPackTrackHovered && (
          <div className="absolute inset-0 bg-black bg-opacity-70" />
        )}

        {/* Track number badge */}
        <div
          className="absolute top-1 left-1 w-4 h-4 rounded text-xs font-bold flex items-center justify-center"
          style={{ backgroundColor: badgeColor, color: textColor }}
        >
          {packIndex + 1}
        </div>

        {/* Cart/Radio button - bottom left - show on hover */}
        {isPackTrackHovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (packTrack.content_type === 'radio_station') {
                if (typeof window !== 'undefined' && (window as any).loadRadioTrack) {
                  (window as any).loadRadioTrack(packTrack);
                }
              } else {
                if (typeof window !== 'undefined' && (window as any).addToCart) {
                  (window as any).addToCart(packTrack);
                }
              }
            }}
            className="absolute bottom-0.5 left-0.5 transition-all hover:scale-110"
            title={packTrack.content_type === 'radio_station' ? "Add to Radio Widget" : "Add to cart"}
          >
            {packTrack.content_type === 'radio_station' ? (
              <Radio className="w-3.5 h-3.5 text-white" />
            ) : (
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            )}
          </button>
        )}

        {/* Play icon - centered - show on hover */}
        {isPackTrackHovered && (packTrack.audio_url || packTrack.stream_url) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        )}

        {/* Playing indicator when playing */}
        {playingTrack === packTrack.id && !isPackTrackHovered && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
            <div className="flex gap-1">
              <div className="w-1 h-3 bg-green-400 animate-pulse" />
              <div className="w-1 h-3 bg-green-400 animate-pulse animation-delay-200" />
              <div className="w-1 h-3 bg-green-400 animate-pulse animation-delay-400" />
            </div>
          </div>
        )}

        {/* BPM - hidden for radio stations */}
        {packTrack.content_type !== 'radio_station' && (
          <div className="absolute bottom-[2px] right-1 text-[11px] text-white font-mono font-bold leading-none">
            {packTrack.bpm || '~'}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Crate({ className = '' }: CrateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { collection, addTrackToCollection, removeTrackFromCollection, clearCollection } = useMixer();
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDropAnimation, setShowDropAnimation] = useState(false);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<any>(null);
  const [trackCount, setTrackCount] = useState(0);

  // Pack expansion state
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const [packTracks, setPackTracks] = useState<{ [key: string]: IPTrack[] }>({});
  
  // Determine current context based on pathname
  const getContext = (): 'store' | 'globe' | 'mixer' => {
    if (pathname.startsWith('/store')) return 'store';
    if (pathname === '/mixer' || pathname === '/globe-mixer-test') return 'mixer';
    return 'globe'; // Default to globe for root path
  };
  
  const context = getContext();
  
  // Update track count after hydration to avoid mismatch
  useEffect(() => {
    setTrackCount(collection.length);
  }, [collection.length]);

  // Set up drop zone
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['TRACK_CARD', 'DECK_TRACK', 'COLLECTION_TRACK'],
    drop: (item: { track: IPTrack }) => {
      // Check if track already exists
      const exists = collection.some(t => t.id === item.track.id);
      if (!exists) {
        // Add to collection (always to the end)
        addTrackToCollection(item.track);

        // Show drop animation
        setShowDropAnimation(true);
        setTimeout(() => setShowDropAnimation(false), 600);

        // Check if this is a pack - if so, auto-expand it!
        const isPack = item.track.content_type === 'loop_pack' ||
                       item.track.content_type === 'ep' ||
                       item.track.content_type === 'station_pack';

        if (isPack && (window as any).expandPackInCrate) {
          console.log('📦 Auto-expanding pack dropped to crate:', item.track.title);

          // Use requestAnimationFrame for reliable timing after render
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Double RAF ensures DOM is fully updated
              try {
                if ((window as any).expandPackInCrate) {
                  (window as any).expandPackInCrate(item.track);
                } else {
                  console.warn('⚠️ expandPackInCrate not available');
                }
              } catch (error) {
                console.error('❌ Failed to auto-expand pack:', error);
              }
            });
          });
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [collection, addTrackToCollection]);
  
  // Expose addToCollection globally for other components
  useEffect(() => {
    (window as any).addToCollection = (track: any) => {
      // Check if track already exists
      const exists = collection.some(t => t.id === track.id);
      if (!exists) {
        addTrackToCollection(track);
      }
    };

    (window as any).removeFromCollection = (trackId: string) => {
      // Find the index of the track with this ID
      const index = collection.findIndex(t => t.id === trackId);
      if (index !== -1) {
        removeTrackFromCollection(index);
      }
    };

    (window as any).clearCollection = () => {
      console.log('🗑️ Crate: Clearing all tracks from collection');
      clearCollection();
    };

    // Expose pack expansion function
    (window as any).expandPackInCrate = async (packTrack: any) => {
      console.log('📦 Crate: Auto-expanding pack:', packTrack.id);

      // Set expanded state
      setExpandedPackId(packTrack.id);

      // If we already have the tracks cached, no need to fetch
      if (packTracks[packTrack.id]) {
        return;
      }

      // Fetch tracks for this pack
      const packId = packTrack.pack_id || packTrack.id.split('-loc-')[0];
      const contentTypeToFetch = packTrack.content_type === 'loop_pack' ? 'loop'
        : packTrack.content_type === 'station_pack' ? 'radio_station'
        : 'full_song';

      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('pack_id', packId)
        .eq('content_type', contentTypeToFetch)
        .order('pack_position', { ascending: true});

      if (data) {
        setPackTracks(prev => ({ ...prev, [packTrack.id]: data as IPTrack[] }));
      }
    };

    // Expose helper function to add pack to crate and auto-expand it
    (window as any).addPackToCrate = (packTrack: any) => {
      console.log('📦 Crate: Adding and unpacking pack:', packTrack.title);

      // Add pack to collection if not already there
      const exists = collection.some(t => t.id === packTrack.id);
      if (!exists) {
        addTrackToCollection(packTrack);

        // Auto-expand the pack after adding
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if ((window as any).expandPackInCrate) {
              (window as any).expandPackInCrate(packTrack);
            }
          });
        });
      } else {
        // Pack already exists, just expand it
        if ((window as any).expandPackInCrate) {
          (window as any).expandPackInCrate(packTrack);
        }
      }
    };

    return () => {
      delete (window as any).addToCollection;
      delete (window as any).removeFromCollection;
      delete (window as any).clearCollection;
      delete (window as any).expandPackInCrate;
      delete (window as any).addPackToCrate;
    };
  }, [collection, addTrackToCollection, removeTrackFromCollection, clearCollection, packTracks]);

  // Handle track preview
  const handleTrackClick = (track: any) => {
    if (!track.audioUrl) return;

    const isRadioStation = track.content_type === 'radio_station' || track.content_type === 'station_pack';
    console.log('🎧 Crate preview:', { trackId: track.id, isRadioStation, audioUrl: track.audioUrl });

    // If clicking the same track that's playing, pause it
    if (playingTrack === track.id && currentAudio) {
      currentAudio.pause();
      setPlayingTrack(null);
      setCurrentAudio(null);
      return;
    }

    // Stop any currently playing track
    if (currentAudio) {
      currentAudio.pause();
    }

    // Start new preview
    const audio = new Audio(track.audioUrl);

    // Only set crossOrigin for regular tracks that need audio analysis
    // Radio stations don't need this and it causes CORS errors
    if (!isRadioStation) {
      audio.crossOrigin = 'anonymous';
    }

    audio.volume = 0.7;

    audio.play()
      .then(() => {
        setPlayingTrack(track.id);
        setCurrentAudio(audio);

        // For radio stations, don't use a timeout (they stream continuously)
        // For regular tracks, auto-stop after 20 seconds
        if (!isRadioStation) {
          setTimeout(() => {
            if (audio && !audio.paused) {
              audio.pause();
              setPlayingTrack(null);
              setCurrentAudio(null);
            }
          }, 20000);
        }
      })
      .catch(error => {
        console.error('Preview playback failed:', error);
      });
  };

  // Handle track removal
  const handleRemoveTrack = (index: number) => {
    removeTrackFromCollection(index);
  };

  // Handle pack expansion
  const handlePackExpansion = async (track: any) => {
    // If clicking the same pack, collapse it
    if (expandedPackId === track.id) {
      setExpandedPackId(null);
      return;
    }

    // Expand this pack
    setExpandedPackId(track.id);

    // If we already have the tracks cached, no need to fetch
    if (packTracks[track.id]) {
      return;
    }

    // Fetch tracks for this pack
    const packId = track.pack_id || track.id.split('-loc-')[0];
    const contentTypeToFetch = track.content_type === 'loop_pack' ? 'loop' : track.content_type === 'station_pack' ? 'radio_station' : 'full_song';

    const { data, error } = await supabase
      .from('ip_tracks')
      .select('*')
      .eq('pack_id', packId)
      .eq('content_type', contentTypeToFetch)
      .order('pack_position', { ascending: true });

    if (data) {
      setPackTracks({ ...packTracks, [track.id]: data as IPTrack[] });
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = ''; // Release the audio resource
        currentAudio.load(); // Force browser to release memory
      }
    };
  }, [currentAudio]);

  // Hide collection bar on profile and docs pages - must be after ALL hooks
  // But show it on certificates (vault) page so users can drag loops into it
  if (pathname === '/profile') {
    return null;
  }

  // Determine border color based on content type
  const getBorderColor = (track: any) => {
    switch (track.content_type) {
      case 'full_song':
        return 'border-[#D4AF37] shadow-[#D4AF37]/50';
      case 'ep':
        return 'border-[#D4AF37] shadow-[#D4AF37]/50';
      case 'loop':
        return 'border-[#9772F4] shadow-[#9772F4]/50';
      case 'loop_pack':
        return 'border-[#9772F4] shadow-[#9772F4]/50';
      case 'radio_station':
        return 'border-[#FB923C] shadow-[#FB923C]/50';
      case 'station_pack':
        return 'border-[#FB923C] shadow-[#FB923C]/50';
      case 'video_clip':
        return 'border-[#2792F5] shadow-[#2792F5]/50';
      default:
        return 'border-[#9772F4] shadow-[#9772F4]/50';
    }
  };

  // Determine border thickness - thicker for multi-content (loop packs, EPs, and station packs)
  const getBorderThickness = (track: any) => {
    return (track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') ? 'border-4' : 'border-2';
  };


  // Collapsed state - minimal bar
  if (isCollapsed) {
    return (
      <div 
        className={`collection-bar-collapsed ${className}`}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40px',
          background: 'rgba(10, 10, 11, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: '20px',
          cursor: 'pointer',
          transition: 'all 0.3s ease'
        }}
        onClick={() => setIsCollapsed(false)}
      >
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flex: 1
        }}>
          <div style={{ 
            color: '#E8E5FF',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            Crate ({trackCount})
          </div>
          <button
            style={{
              background: 'none',
              border: 'none',
              color: '#999',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '4px',
              transition: 'color 0.2s'
            }}
            className="hover:text-white"
            title="Expand crate"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7 14L12 9L17 14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Expanded state
  return (
    <div 
      ref={drop}
      className={`collection-bar ${className} ${isOver ? 'drag-over' : ''}`}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80px',
        background: isOver ? 'rgba(129, 228, 242, 0.1)' : 'rgba(10, 10, 11, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: isOver ? '2px solid #81E4F2' : '1px solid rgba(255, 255, 255, 0.1)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '20px',
        animation: 'slideUp 0.3s ease-out',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Left side: Crate label and collapse button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '200px',
        flexShrink: 0
      }}>
        <div style={{ 
          color: '#E8E5FF',
          fontSize: '16px',
          fontWeight: '600',
          whiteSpace: 'nowrap'
        }}>
          Crate ({trackCount})
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#999',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '4px',
            transition: 'color 0.2s'
          }}
          className="hover:text-white"
          title="Collapse crate"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="rotate-180"
          >
            <path
              d="M7 14L12 9L17 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

      </div>

      {/* Center: Scrollable track list or empty state */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          overflowX: 'auto',
          overflowY: 'hidden',
          scrollBehavior: 'smooth',
          padding: '4px 0',
          // Hide scrollbar but keep functionality
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          // Allow drops to pass through to parent drop zone
          pointerEvents: 'none'
        }}
        className="collection-scroll"
      >
        {trackCount === 0 ? (
          // Empty state
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: '14px',
            fontStyle: 'italic',
            // Re-enable pointer events for empty state text
            pointerEvents: 'auto'
          }}>
            Your persistent collection — drag content here from anywhere, then drag to mixer decks
          </div>
        ) : (
          // Track list
          collection.map((track, index) => {
            // Allow all tracks to be draggable - loops and songs
            // Note: Mixer decks won't accept full_song drops, but Playlist will
            const isDraggable = (context === 'mixer' || context === 'globe' || context === 'store');
            
            const trackElement = (
              <div
                key={`${track.id}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexShrink: 0,
                  // Re-enable pointer events for individual tracks
                  pointerEvents: 'auto'
                }}
              >
              <div
                style={{
                  position: 'relative',
                  flexShrink: 0,
                  group: true
                }}
                className={`track-item group ${showDropAnimation && index === collection.length - 1 ? 'drop-animation' : ''}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if ((window as any).addToCart) {
                    (window as any).addToCart(track);
                  }
                }}
              >
            
            {/* Track thumbnail */}
            <div
              onClick={() => handleTrackClick(track)}
              onMouseEnter={() => setHoveredTrackId(track.id)}
              onMouseLeave={() => setHoveredTrackId(null)}
              className={`cursor-pointer transition-all ${getBorderColor(track)} ${getBorderThickness(track)}`}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: '#1a1a1a'
              }}
            >
              {track.imageUrl ? (
                <img
                  src={getOptimizedTrackImage(track, 64)}
                  alt={track.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}>
                  <svg className="w-6 h-6 text-white opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              )}
              
              {/* Dark overlay on hover */}
              {hoveredTrackId === track.id && (
                <div className="absolute inset-0 bg-black bg-opacity-70 pointer-events-none" />
              )}

              {/* Unified hover overlay - same for all contexts */}
              {hoveredTrackId === track.id && (
                <>
                  {/* Info icon - opens TrackDetailsModal - top left */}
                  <div className="absolute top-1 left-1">
                    <InfoIcon
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Ensure track has primary_uploader_wallet for modal links to work
                        const trackWithWallet = {
                          ...track,
                          primary_uploader_wallet: track.primary_uploader_wallet || track.wallet_address || track.uploader_address
                        };
                        setSelectedTrack(trackWithWallet);
                        setShowInfoModal(true);
                      }}
                      title="View track details"
                    />
                  </div>

                  {/* Remove from crate button - top right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveTrack(index);
                    }}
                    className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center transition-all hover:scale-110 z-10"
                    title="Remove from crate"
                  >
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Cart/Radio button (all contexts) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Check if this is radio content (station or pack)
                      const isRadioContent = track.content_type === 'radio_station' ||
                                           track.content_type === 'station_pack';

                      if (isRadioContent) {
                        // Send radio stations and packs to RadioWidget
                        if ((window as any).loadRadioTrack) {
                          (window as any).loadRadioTrack(track);
                        }
                      } else {
                        // Send regular tracks to cart
                        if ((window as any).addToCart) {
                          (window as any).addToCart(track);
                        }
                      }
                    }}
                    className="absolute bottom-0.5 left-0.5 transition-all hover:scale-110"
                    title={track.content_type === 'radio_station' || track.content_type === 'station_pack' ? "Add to Radio Widget" : "Add to cart"}
                  >
                    {track.content_type === 'radio_station' || track.content_type === 'station_pack' ? (
                      <Radio className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    )}
                  </button>

                  {/* Play icon - centered */}
                  {(track.audioUrl || track.stream_url) && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  )}
                </>
              )}

              {/* Playing indicator (always visible when playing) */}
              {playingTrack === track.id && hoveredTrackId !== track.id && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-green-400 animate-pulse" />
                    <div className="w-1 h-3 bg-green-400 animate-pulse animation-delay-200" />
                    <div className="w-1 h-3 bg-green-400 animate-pulse animation-delay-400" />
                  </div>
                </div>
              )}

              {/* BPM overlay for mixer (always) and store/globe (on hover) contexts - hidden for radio stations */}
              {track.content_type !== 'radio_station' && (context === 'mixer' || ((context === 'store' || context === 'globe') && hoveredTrackId === track.id)) && (
                <div className="absolute bottom-[2px] right-1 text-[11px] text-white font-mono font-bold leading-none">
                  {track.bpm || '~'}
                </div>
              )}

              {/* Chevron button for loop packs, EPs, and station packs - always visible, far right edge */}
              {(track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePackExpansion(track);
                  }}
                  className="absolute right-[1px] top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center transition-all hover:scale-110 z-10 bg-black bg-opacity-80 rounded"
                  title={expandedPackId === track.id ? (track.content_type === 'ep' ? "Collapse tracks" : track.content_type === 'station_pack' ? "Collapse stations" : "Collapse loops") : (track.content_type === 'ep' ? "Expand tracks" : track.content_type === 'station_pack' ? "Expand stations" : "Expand loops")}
                >
                  {expandedPackId === track.id ? (
                    <ChevronLeft
                      className="w-3.5 h-3.5"
                      style={{ color: track.content_type === 'ep' ? '#D4AF37' : track.content_type === 'station_pack' ? '#FB923C' : '#C4AEF8' }}
                      strokeWidth={3}
                    />
                  ) : (
                    <ChevronRight
                      className="w-3.5 h-3.5"
                      style={{ color: track.content_type === 'ep' ? '#D4AF37' : track.content_type === 'station_pack' ? '#FB923C' : '#C4AEF8' }}
                      strokeWidth={3}
                    />
                  )}
                </button>
              )}
            </div>
              </div>

            {/* Expanded pack tracks - displayed horizontally to the right */}
            {expandedPackId === track.id && packTracks[track.id] && (
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  animation: 'slideInRight 0.2s ease-out',
                  // Re-enable pointer events for expanded pack tracks
                  pointerEvents: 'auto'
                }}
              >
                {packTracks[track.id].map((packTrack: IPTrack, packIndex: number) => (
                  <ExpandedPackTrack
                    key={packTrack.id}
                    packTrack={packTrack}
                    packIndex={packIndex}
                    parentTrack={track}
                    playingTrack={playingTrack}
                    handleTrackClick={handleTrackClick}
                    getBorderColor={getBorderColor}
                    getBorderThickness={getBorderThickness}
                  />
                ))}
              </div>
            )}
              </div>
            );

            // Wrap in DraggableTrack if in mixer context and not a song
            return isDraggable ? (
              <DraggableTrack
                key={`${track.id}-${index}`}
                track={track}
                index={index}
                onRemove={() => handleRemoveTrack(index)}
              >
                {trackElement}
              </DraggableTrack>
            ) : trackElement;
          })
        )}
      </div>

      {/* Right side: Navigation and scroll indicator */}
      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: '200px',
        flexShrink: 0
      }}>
        {/* Scroll indicator if needed */}
        {collection.length > 8 && (
          <button
            onClick={() => {
              if (scrollRef.current) {
                scrollRef.current.scrollLeft += 300;
              }
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            className="hover:bg-white/20"
          >
            →
          </button>
        )}
      </div>

      {/* CSS for animations and scrollbar hiding */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .collection-scroll::-webkit-scrollbar {
          display: none;
        }

        .track-item:hover > div:first-child {
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        @keyframes dropBounce {
          0% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          50% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(-20px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .drop-animation {
          animation: dropBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
      `}</style>

      {/* Drop indicator when dragging over */}
      {isOver && (
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 1001 }}
        >
          <div className="text-white text-lg font-semibold bg-black/80 px-6 py-3 rounded-lg">
            Drop to add to crate
          </div>
        </div>
      )}

      {/* Track Details Modal - Unified for all contexts */}
      {showInfoModal && selectedTrack && (
        <TrackDetailsModal
          track={{
            ...selectedTrack,
            cover_image_url: selectedTrack.imageUrl,
            audio_url: selectedTrack.audioUrl,
            // Add any other missing fields that TrackDetailsModal expects
            tags: selectedTrack.tags || [],
            description: selectedTrack.description || '',
            tell_us_more: selectedTrack.tell_us_more || '',
            notes: selectedTrack.notes || ''
          }}
          isOpen={showInfoModal}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedTrack(null);
          }}
        />
      )}
    </div>
  );
}