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

  // Fetch loops when pack is expanded (for loop_pack) or tracks when EP is expanded
  useEffect(() => {
    const fetchPackTracks = async () => {
      if (!isPackExpanded || (track.content_type !== 'loop_pack' && track.content_type !== 'ep')) {
        console.log('🔍 Not fetching pack tracks:', { isPackExpanded, content_type: track.content_type });
        return;
      }
      if (packLoops.length > 0) {
        console.log('🔍 Pack tracks already loaded:', packLoops.length);
        return; // Already loaded
      }

      setLoadingLoops(true);
      const packId = track.pack_id || track.id.split('-loc-')[0];
      console.log('🔍 Fetching pack tracks for:', packId, track.content_type);

      // For loop packs, fetch loops. For EPs, fetch full songs
      const contentTypeToFetch = track.content_type === 'loop_pack' ? 'loop' : 'full_song';

      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('pack_id', packId)
        .eq('content_type', contentTypeToFetch)
        .order('pack_position', { ascending: true });

      if (error) {
        console.error('❌ Error fetching pack tracks:', error);
      } else if (data) {
        console.log('✅ Fetched pack tracks:', data.length, data);
        setPackLoops(data as IPTrack[]);
      }
      setLoadingLoops(false);
    };

    fetchPackTracks();
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
                    src={getOptimizedTrackImage(track, 320)}
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

                {/* Track number badge - for individual tracks that are part of a pack/EP */}
                {track.pack_id && typeof track.pack_position === 'number' && (
                  <div
                    className="absolute top-1 left-1 w-6 h-6 rounded text-sm font-bold flex items-center justify-center z-10"
                    style={{
                      backgroundColor: track.content_type === 'full_song' ? '#FFE4B5' : '#C4AEF8',
                      color: track.content_type === 'full_song' ? '#000000' : '#FFFFFF'
                    }}
                  >
                    {track.pack_position}
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

                    {/* Delete Button - positioned in upper-right corner */}
                    {showEditControls && (
                      <button
                        onClick={handleDeleteClick}
                        title="Remove from store"
                        className="absolute top-1 right-1 w-6 h-6 bg-red-900/50 hover:bg-red-600 rounded flex items-center justify-center transition-all border border-red-700 hover:border-red-500 group z-20"
                      >
                        <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}

                    {/* Center: Play Button - Absolutely centered */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
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

                    {/* Chevron Button - for loop packs and EPs - positioned on right side, vertically centered */}
                    {(track.content_type === 'loop_pack' || track.content_type === 'ep') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPackExpanded(!isPackExpanded);
                        }}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-all hover:scale-110 z-10"
                        title={isPackExpanded ? (track.content_type === 'ep' ? "Collapse tracks" : "Collapse loops") : (track.content_type === 'ep' ? "Expand tracks" : "Expand loops")}
                      >
                        {isPackExpanded ? (
                          <ChevronUp className="w-5 h-5" style={{ color: track.content_type === 'ep' ? '#FFE4B5' : '#C4AEF8' }} strokeWidth={3} />
                        ) : (
                          <ChevronDown className="w-5 h-5" style={{ color: track.content_type === 'ep' ? '#FFE4B5' : '#C4AEF8' }} strokeWidth={3} />
                        )}
                      </button>
                    )}

                    {/* Payment Pending Warning - REMOVED: No longer needed for simplified payment model */}

                    {/* Bottom Section: Price/Remix Icon, Content Type Badge, BPM */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                      {/* Buy Button OR Remix Icon (left) - compact */}
                      {(() => {
                        // Songs, EPs, and Loop Packs ALWAYS show download price (never mixer icon)
                        if (track.content_type === 'full_song' || track.content_type === 'ep' || track.content_type === 'loop_pack') {
                          // Check new download_price_stx field first
                          if (track.download_price_stx !== null && track.download_price_stx !== undefined) {
                            return track.download_price_stx === 0 ? (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Free download - click to add to cart"
                              >
                                Free
                              </button>
                            ) : (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Download price in STX - click to add to cart"
                              >
                                {track.download_price_stx}
                              </button>
                            );
                          }
                          // Fallback to legacy price_stx
                          if (track.price_stx) {
                            return (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Download price - click to add to cart"
                              >
                                {track.price_stx}
                              </button>
                            );
                          }
                          // No price set - show as free
                          return (
                            <button
                              onClick={handlePurchaseClick}
                              className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                              title="Free download - click to add to cart"
                            >
                              Free
                            </button>
                          );
                        }

                        // For LOOPS: Check if downloadable or remix-only
                        if (track.content_type === 'loop') {
                          // PRIORITY 1: Check allow_downloads flag first (most reliable indicator)
                          if (track.allow_downloads === false) {
                            // This is a remix-only loop - show "M" badge
                            return (
                              <div
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                                title="Platform remix only - 1 STX per recorded remix"
                              >
                                M
                              </div>
                            );
                          }

                          // PRIORITY 2: Check if loop has download_price_stx (new model)
                          if (track.download_price_stx !== null && track.download_price_stx !== undefined) {
                            // Loop has download price - show buy button
                            return track.download_price_stx === 0 ? (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Free download - click to add to cart"
                              >
                                Free
                              </button>
                            ) : (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Download price in STX - click to add to cart"
                              >
                                {track.download_price_stx}
                              </button>
                            );
                          }

                          // PRIORITY 3: Check allow_downloads === true with legacy price_stx
                          if (track.allow_downloads === true && track.price_stx) {
                            return (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Download price - click to add to cart"
                              >
                                {track.price_stx}
                              </button>
                            );
                          }

                          // PRIORITY 4: Legacy tracks with price_stx but no allow_downloads flag set
                          // These are old tracks - assume downloadable
                          if (track.price_stx && track.allow_downloads !== false) {
                            return (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Download price - click to add to cart"
                              >
                                {track.price_stx}
                              </button>
                            );
                          }

                          // Fallback: no pricing info, assume remix-only
                          return (
                            <div
                              className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                              title="Platform remix only - 1 STX per recorded remix"
                            >
                              M
                            </div>
                          );
                        }

                        // For MIXES: Always show "M" badge (mixes don't have downloads for MVP)
                        if (track.content_type === 'mix') {
                          return (
                            <div
                              className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                              title="Platform remix only - 1 STX per recorded remix"
                            >
                              M
                            </div>
                          );
                        }

                        // Fallback for unknown content types: check for price_stx
                        if (track.price_stx) {
                          return (
                            <button
                              onClick={handlePurchaseClick}
                              className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                              title="Download price - click to add to cart"
                            >
                              {track.price_stx}
                            </button>
                          );
                        }

                        // Ultimate fallback: no price info
                        return null;
                      })()}

                      {/* Content Type Badge (center) with generation indicators */}
                      <span className="text-xs font-mono font-medium text-white">
                        {track.content_type === 'ep' && 'EP'}
                        {track.content_type === 'loop_pack' && 'PACK'}
                        {track.content_type === 'loop' && (
                          <>
                            {track.generation === 0 || track.remix_depth === 0 ? (
                              '🌱 LOOP'
                            ) : track.generation === 1 || track.remix_depth === 1 ? (
                              '🌿 LOOP'
                            ) : track.generation === 2 || track.remix_depth === 2 ? (
                              '🌳 LOOP'
                            ) : (
                              'LOOP'
                            )}
                          </>
                        )}
                        {track.content_type === 'mix' && (
                          <>
                            {track.generation === 1 || track.remix_depth === 1 ? (
                              '🌿 MIX'
                            ) : track.generation === 2 || track.remix_depth === 2 ? (
                              '🌳 MIX'
                            ) : (
                              'MIX'
                            )}
                          </>
                        )}
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

        {/* Expandable Drawer - For loop packs and EPs */}
        {(track.content_type === 'loop_pack' || track.content_type === 'ep') && isPackExpanded && (
          <div
            className="w-[160px] bg-slate-900 border-2 border-t-0 rounded-b-lg overflow-hidden"
            style={{
              borderColor: track.content_type === 'ep' ? '#FFE4B5' : '#9772F4',
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
                  // Create draggable track item
                  const DraggableTrack = () => {
                    const [{ isDragging }, trackDrag] = useDrag(() => ({
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

                    const badgeColor = track.content_type === 'ep' ? '#FFE4B5' : '#9772F4';
                    const textColor = track.content_type === 'ep' ? '#000000' : '#FFFFFF';

                    return (
                      <div
                        ref={trackDrag}
                        className={`flex items-center gap-2 px-2 py-1 hover:bg-slate-800 cursor-grab ${isDragging ? 'opacity-50' : ''}`}
                        style={{ height: '28px' }}
                      >
                        {/* Track number badge */}
                        <div
                          className="flex-shrink-0 w-5 h-5 rounded text-xs font-bold flex items-center justify-center"
                          style={{backgroundColor: badgeColor, color: textColor}}
                        >
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

                  return <DraggableTrack key={loop.id} />;
                })}
              </div>
            ) : (
              <div className="p-2 text-xs text-gray-500 text-center">
                {track.content_type === 'ep' ? 'No tracks found' : 'No loops found'}
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