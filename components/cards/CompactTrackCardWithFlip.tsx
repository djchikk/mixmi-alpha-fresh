"use client";

import React, { useState, useEffect } from 'react';
import { IPTrack } from '@/types';
// Removed mixer dependency for alpha version
import { useToast } from '@/contexts/ToastContext';
import TrackDetailsModal from '../modals/TrackDetailsModal';
import { useDrag } from 'react-dnd';
import InfoIcon from '../shared/InfoIcon';
import SafeImage from '../shared/SafeImage';
import { GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface CompactTrackCardWithFlipProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
}

export default function CompactTrackCardWithFlip({
  track,
  isPlaying,
  onPlayPreview,
  onStopPreview,
  showEditControls,
  onPurchase,
  onEditTrack,
  onDeleteTrack
}: CompactTrackCardWithFlipProps) {
  // Alpha version - no mixer collection functionality
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  // Loop pack expansion state
  const [isPackExpanded, setIsPackExpanded] = useState(false);
  const [packLoops, setPackLoops] = useState<IPTrack[]>([]);
  const [loadingLoops, setLoadingLoops] = useState(false);
  const [playingLoopId, setPlayingLoopId] = useState<string | null>(null);
  const [loopAudio, setLoopAudio] = useState<HTMLAudioElement | null>(null);

  // Fetch username for the track's primary uploader wallet
  useEffect(() => {
    const fetchUsername = async () => {
      if (!track.primary_uploader_wallet) return;

      const { data } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('wallet_address', track.primary_uploader_wallet)
        .single();

      setUsername(data?.username || null);
    };

    fetchUsername();
  }, [track.primary_uploader_wallet]);

  // Fetch loops when pack is expanded
  useEffect(() => {
    const fetchLoops = async () => {
      if (!isPackExpanded || track.content_type !== 'loop_pack') {
        console.log('🔍 Not fetching loops:', { isPackExpanded, content_type: track.content_type });
        return;
      }
      if (packLoops.length > 0) {
        console.log('🔍 Loops already loaded:', packLoops.length);
        return; // Already loaded
      }

      setLoadingLoops(true);
      const packId = track.pack_id || track.id.split('-loc-')[0];
      console.log('🔍 Fetching loops for pack:', packId);

      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('pack_id', packId)
        .eq('content_type', 'loop')
        .order('pack_position', { ascending: true });

      if (error) {
        console.error('❌ Error fetching pack loops:', error);
      } else if (data) {
        console.log('✅ Fetched loops:', data.length, data);
        setPackLoops(data as IPTrack[]);
      }
      setLoadingLoops(false);
    };

    fetchLoops();
  }, [isPackExpanded, track.content_type, track.id]);

  // Handle loop playback
  const handleLoopPlay = (loop: IPTrack) => {
    if (playingLoopId === loop.id) {
      // Stop current loop
      if (loopAudio) {
        loopAudio.pause();
        setLoopAudio(null);
      }
      setPlayingLoopId(null);
    } else {
      // Stop previous audio
      if (loopAudio) {
        loopAudio.pause();
      }

      // Play new loop
      const audio = new Audio(loop.audio_url);
      audio.play();
      setLoopAudio(audio);
      setPlayingLoopId(loop.id);

      // Auto-stop after 20 seconds
      setTimeout(() => {
        audio.pause();
        setLoopAudio(null);
        setPlayingLoopId(null);
      }, 20000);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (loopAudio) {
        loopAudio.pause();
      }
    };
  }, [loopAudio]);

  // Set up drag
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      // Optimize image for crate (64px) when dragging
      const optimizedTrack = {
        ...track,
        imageUrl: getOptimizedTrackImage(track, 64),
        cover_image_url: getOptimizedTrackImage(track, 64),
        // Ensure we have audioUrl for mixer compatibility
        audioUrl: track.audio_url
      };

      return { track: optimizedTrack };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track]);

  // Get track type
  const getTrackType = () => {
    if (track.content_type === 'full_song') return 'Song';
    if (track.content_type === 'ep') {
      return 'EP';
    }
    if (track.content_type === 'loop') {
      return track.loop_category || 'Loop';
    }
    if (track.content_type === 'loop_pack') {
      return `Loop Pack (${(track as any).loops_per_pack || '?'} loops)`;
    }
    return track.sample_type === 'vocals' ? 'Vocal' : 
           track.sample_type === 'instrumentals' ? 'Instrumental' : 
           'Track';
  };

  // Get border color based on content type
  const getBorderColor = () => {
    if (track.content_type === 'full_song') return 'border-[#FFE4B5]';
    if (track.content_type === 'ep') return 'border-[#FFE4B5]';
    if (track.content_type === 'loop') return 'border-[#9772F4]';
    if (track.content_type === 'loop_pack') return 'border-[#9772F4]';
    // Fallback for legacy data
    return track.sample_type === 'vocals' ? 'border-[#9772F4]' : 'border-[#FFE4B5]';
  };

  // Get border thickness - thicker for multi-content (loop packs and EPs)
  const getBorderThickness = () => {
    return (track.content_type === 'loop_pack' || track.content_type === 'ep') ? 'border-4' : 'border-2';
  };


  // Handle play click
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayPreview(track.id, track.audio_url);
  };

  // Handle purchase click - add to cart
  const handlePurchaseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Use global cart function if available (for globe context)
    if ((window as any).addToCart) {
      (window as any).addToCart(track);
    } else {
      // Fallback to onPurchase prop (for other contexts like Creator Store)
      onPurchase?.(track);
    }
  };

  // Handle delete click with confirmation
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Remove "${track.title}" from your store?\n\n` +
      `This will permanently remove it from your store, but you can still find it in your vault under the "Deleted" filter.`
    );
    
    if (confirmed) {
      onDeleteTrack?.(track.id);
      showToast('Track removed from store', 'success');
    }
  };

  // Handle info click - opens TrackDetailsModal
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
  };


  return (
    <>
      <div className="relative group">
        {/* Compact Card Container - 160x160px */}
        <div
          ref={drag}
          className={`w-[160px] h-[160px] rounded-lg overflow-hidden transition-all duration-300 ${getBorderColor()} ${getBorderThickness()} bg-slate-800 ${isDragging ? 'opacity-50' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <div className="relative w-full h-full">
              {/* Cover Image - Full Card */}
              <div className="relative w-full h-full">
                {(track.cover_image_url || track.imageUrl) ? (
                  <SafeImage
                    src={getOptimizedTrackImage(track, 160)}
                    alt={track.title}
                    className="w-full h-full object-cover"
                    fill
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
                
                {/* HIDDEN: Drag Handle - Left side, vertically centered - Uncomment to restore */}
                {/* {isHovered && (
                  <div
                    className="absolute left-1 top-1/2 transform -translate-y-1/2 z-10"
                    title="Drag to crate or mixer (loops only for mixer)"
                  >
                    <GripVertical className="w-5 h-5 text-white" />
                  </div>
                )} */}

                {/* Info Icon - Left side, vertically centered */}
                {isHovered && (
                  <div
                    className="absolute left-1 top-1/2 transform -translate-y-1/2 z-10"
                  >
                    <InfoIcon
                      size="lg"
                      onClick={handleInfoClick}
                      title="Click to see all info + drag individual tracks from Loop Packs/EPs"
                      className="text-white hover:text-white"
                    />
                  </div>
                )}

                {/* Hover Overlay */}
                {isHovered && (
                  <div className="hover-overlay absolute inset-0 bg-black bg-opacity-90 p-2 animate-fadeIn">

                    {/* Top Section: Title, Artist (full width) */}
                    <div className="absolute top-1 left-2 right-2">
                      {/* Title and Artist - full width with truncation */}
                      <div className="flex flex-col">
                        {track.primary_uploader_wallet ? (
                          <Link
                            href={username ? `/store/${username}` : `/store/${track.primary_uploader_wallet}`}
                            className="font-medium text-white text-sm leading-tight truncate hover:text-[#81E4F2] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {track.title}
                          </Link>
                        ) : (
                          <h3 className="font-medium text-white text-sm leading-tight truncate">{track.title}</h3>
                        )}
                        {track.primary_uploader_wallet ? (
                          <Link
                            href={username ? `/profile/${username}` : `/profile/${track.primary_uploader_wallet}`}
                            className="text-white/80 text-xs truncate hover:text-[#81E4F2] transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {track.artist}
                          </Link>
                        ) : (
                          <p className="text-white/80 text-xs truncate">{track.artist}</p>
                        )}
                      </div>
                    </div>

                    {/* Center: Play Button and Delete Button - Absolutely centered */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                      {/* Delete Button - positioned on right side */}
                      {showEditControls && (
                        <button
                          onClick={handleDeleteClick}
                          title="Remove from store"
                          className="absolute right-[-50px] w-6 h-6 bg-red-900/50 hover:bg-red-600 rounded flex items-center justify-center transition-all border border-red-700 hover:border-red-500 group"
                        >
                          <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}

                      {/* Play Button - centered */}
                      {track.audio_url && (
                        <button
                          onClick={handlePlayClick}
                          onMouseLeave={() => {
                            if (isPlaying && onStopPreview) {
                              onStopPreview();
                            }
                          }}
                          className="transition-all hover:scale-110"
                        >
                          {isPlaying ? (
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                            </svg>
                          ) : (
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Chevron Button - only for loop packs - positioned on right side, vertically centered */}
                    {track.content_type === 'loop_pack' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPackExpanded(!isPackExpanded);
                        }}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-all hover:scale-110 z-10"
                        title={isPackExpanded ? "Collapse loops" : "Expand loops"}
                      >
                        {isPackExpanded ? (
                          <ChevronUp className="w-5 h-5" style={{ color: '#C4AEF8' }} strokeWidth={3} />
                        ) : (
                          <ChevronDown className="w-5 h-5" style={{ color: '#C4AEF8' }} strokeWidth={3} />
                        )}
                      </button>
                    )}

                    {/* Bottom Section: Price, Content Type Badge, BPM */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                      {/* Buy Button (left) - compact */}
                      <button
                        onClick={handlePurchaseClick}
                        className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                        title="Price in STX - click to add to cart"
                      >
                        {track.price_stx}
                      </button>

                      {/* Content Type Badge (center) */}
                      <span className="text-xs font-mono font-medium text-white">
                        {track.content_type === 'ep' && 'EP'}
                        {track.content_type === 'loop_pack' && 'PACK'}
                        {track.content_type === 'loop' && 'LOOP'}
                        {track.content_type === 'full_song' && 'SONG'}
                        {!track.content_type && 'TRACK'}
                      </span>
                      
                      {/* BPM Badge (right) - hide for EPs since they have multiple songs with different BPMs */}
                      {track.bpm && track.content_type !== 'ep' ? (
                        <span
                          className="text-sm font-mono font-bold text-white"
                          title="BPM"
                        >
                          {track.bpm}
                        </span>
                      ) : (
                        <div className="w-12"></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Expandable Loop Drawer - Only for loop packs */}
        {track.content_type === 'loop_pack' && isPackExpanded && (
          <div
            className="w-[160px] bg-slate-900 border-2 border-[#9772F4] border-t-0 rounded-b-lg overflow-hidden"
            style={{
              animation: 'slideDown 0.2s ease-out'
            }}
          >
            {loadingLoops ? (
              <div className="p-2 flex items-center justify-center gap-2 text-xs text-gray-400">
                <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                Loading...
              </div>
            ) : packLoops.length > 0 ? (
              <div className="py-1">
                {packLoops.map((loop, index) => {
                  // Create draggable loop item
                  const DraggableLoop = () => {
                    const [{ isDragging }, loopDrag] = useDrag(() => ({
                      type: 'TRACK_CARD',
                      item: () => ({
                        track: {
                          ...loop,
                          imageUrl: getOptimizedTrackImage(loop, 64),
                          cover_image_url: getOptimizedTrackImage(loop, 64),
                          audioUrl: loop.audio_url
                        }
                      }),
                      collect: (monitor) => ({
                        isDragging: monitor.isDragging(),
                      }),
                    }), [loop]);

                    return (
                      <div
                        ref={loopDrag}
                        className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-800 cursor-grab ${isDragging ? 'opacity-50' : ''}`}
                        style={{ height: '28px' }}
                      >
                        {/* Loop number badge */}
                        <div className="flex-shrink-0 w-5 h-5 rounded text-white text-xs font-bold flex items-center justify-center" style={{backgroundColor: '#9772F4'}}>
                          {index + 1}
                        </div>

                        {/* BPM */}
                        <div className="flex-1 text-white text-xs font-mono text-center">
                          {loop.bpm || 120}
                        </div>

                        {/* Play/Pause button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoopPlay(loop);
                          }}
                          className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:scale-110 transition-transform"
                        >
                          {playingLoopId === loop.id ? (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          )}
                        </button>
                      </div>
                    );
                  };

                  return <DraggableLoop key={loop.id} />;
                })}
              </div>
            ) : (
              <div className="p-2 text-xs text-gray-500 text-center">
                No loops found
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Expanded Modal (when expand button is clicked) */}
      <TrackDetailsModal
        track={track}
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
      />
    </>
  );
}