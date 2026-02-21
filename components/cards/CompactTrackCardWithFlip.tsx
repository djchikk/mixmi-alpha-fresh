"use client";

import React, { useState, useEffect, useRef } from 'react';
import { IPTrack } from '@/types';
// Removed mixer dependency for alpha version
import { useToast } from '@/contexts/ToastContext';
import TrackDetailsModal from '../modals/TrackDetailsModal';
import { useDrag } from 'react-dnd';
import InfoIcon from '../shared/InfoIcon';
import SafeImage from '../shared/SafeImage';
import { GripVertical, ChevronDown, ChevronUp, Radio } from 'lucide-react';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PRICING } from '@/config/pricing';

interface CompactTrackCardWithFlipProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string, isRadioStation?: boolean) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
  onPublishTrack?: (trackId: string) => void;
  ownedBadge?: boolean; // Show "Owned" badge for purchased content
}

// Draggable track component for expanded drawer
interface DraggableDrawerTrackProps {
  track: IPTrack;
  index: number;
  contentType: string;
  onPlay: (track: IPTrack) => void;
  playingLoopId: string | null;
}

function DraggableDrawerTrack({ track, index, contentType, onPlay, playingLoopId }: DraggableDrawerTrackProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => ({
      track: {
        ...track,
        imageUrl: getOptimizedTrackImage(track, 64),
        cover_image_url: track.cover_image_url,
        // For video clips, use video_url as audioUrl since MP4 contains both audio and video
        audioUrl: track.audio_url || (track.content_type === 'video_clip' ? track.video_url : undefined),
        // Preserve video_url for video clips
        ...(track.content_type === 'video_clip' && track.video_url && {
          video_url: track.video_url
        }),
        notes: track.notes, // Preserve notes for CC text overlay
        // AI assistance flags for Creation display
        ai_assisted_idea: (track as any).ai_assisted_idea,
        ai_assisted_implementation: (track as any).ai_assisted_implementation
      },
      source: 'globe'
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track]);

  const badgeColor = contentType === 'ep' ? '#A8E66B' : contentType === 'station_pack' ? '#FFC044' : '#A084F9';
  const textColor = contentType === 'ep' ? '#000000' : '#FFFFFF';

  return (
    <div
      ref={drag}
      className="flex items-center gap-2 px-2 py-1 hover:bg-slate-800 cursor-grab"
      style={{ height: '28px', opacity: isDragging ? 0.75 : 1 }}
    >
      {/* Track number badge */}
      <div
        className="flex-shrink-0 w-5 h-5 rounded text-xs font-bold flex items-center justify-center"
        style={{backgroundColor: badgeColor, color: textColor}}
      >
        {index + 1}
      </div>

      {/* BPM (for loops/songs) or Station Title (for radio stations) */}
      <div className="flex-1 text-white text-xs text-center" style={{ fontFamily: contentType === 'station_pack' ? 'inherit' : 'monospace' }}>
        {contentType === 'station_pack' ? track.title : (track.bpm || '~')}
      </div>

      {/* Play/Pause button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPlay(track);
        }}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center hover:scale-110 transition-transform"
      >
        {playingLoopId === track.id ? (
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
}

export default function CompactTrackCardWithFlip({
  track,
  isPlaying,
  onPlayPreview,
  onStopPreview,
  showEditControls,
  onPurchase,
  onEditTrack,
  onDeleteTrack,
  onPublishTrack,
  ownedBadge = false
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

  // Video playback state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  // Publish state (for drafts)
  const [isPublishing, setIsPublishing] = useState(false);

  // Ref for audio auto-stop timeout (so we can clear it)
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch username and display_name for the track's primary uploader wallet
  // Priority: persona username > user_profiles username
  const [uploaderDisplayName, setUploaderDisplayName] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsername = async () => {
      if (!track.primary_uploader_wallet) return;

      // First check if there's a persona with this wallet (check both wallet_address and sui_address)
      const { data: personaData } = await supabase
        .from('personas')
        .select('username, display_name')
        .or(`wallet_address.eq.${track.primary_uploader_wallet},sui_address.eq.${track.primary_uploader_wallet}`)
        .eq('is_active', true)
        .maybeSingle();

      if (personaData?.username) {
        setUsername(personaData.username);
        setUploaderDisplayName(personaData.display_name || null);
        return;
      }

      // Fall back to user_profiles
      const { data } = await supabase
        .from('user_profiles')
        .select('username, display_name')
        .eq('wallet_address', track.primary_uploader_wallet)
        .single();

      setUsername(data?.username || null);
      setUploaderDisplayName(data?.display_name || null);
    };

    fetchUsername();
  }, [track.primary_uploader_wallet]);

  // Fetch loops when pack is expanded (for loop_pack) or tracks when EP is expanded or stations when station_pack is expanded
  useEffect(() => {
    const fetchPackTracks = async () => {
      if (!isPackExpanded || (track.content_type !== 'loop_pack' && track.content_type !== 'ep' && track.content_type !== 'station_pack')) {
        return;
      }
      if (packLoops.length > 0) {
        return; // Already loaded
      }

      setLoadingLoops(true);
      const packId = track.pack_id || track.id.split('-loc-')[0];

      // For loop packs, fetch loops. For EPs, fetch full songs. For station packs, fetch radio stations
      const contentTypeToFetch = track.content_type === 'loop_pack' ? 'loop' : track.content_type === 'station_pack' ? 'radio_station' : 'full_song';

      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('pack_id', packId)
        .eq('content_type', contentTypeToFetch)
        .order('pack_position', { ascending: true });

      if (error) {
        console.error('❌ Error fetching pack tracks:', error);
      } else if (data) {
        setPackLoops(data as IPTrack[]);
      }
      setLoadingLoops(false);
    };

    fetchPackTracks();
  }, [isPackExpanded, track.content_type, track.id]);

  // Handle loop playback
  const handleLoopPlay = (loop: IPTrack) => {
    // Clear any existing timeout
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }

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

      // Play new loop (support both audio_url and stream_url for radio stations)
      const audioSource = loop.stream_url || loop.audio_url;
      const audio = new Audio(audioSource);
      audio.play();
      setLoopAudio(audio);
      setPlayingLoopId(loop.id);

      // Content-type based auto-stop behavior:
      // - Radio stations: play indefinitely (user controls stop)
      // - Loops: play full length (let audio end naturally)
      // - Other content: 20 second preview
      const isRadio = loop.content_type === 'radio_station';
      const isLoop = loop.content_type === 'loop';

      if (!isRadio && !isLoop) {
        // Auto-stop after 20 seconds for songs, EPs, etc.
        audioTimeoutRef.current = setTimeout(() => {
          audio.pause();
          setLoopAudio(null);
          setPlayingLoopId(null);
        }, 20000);
      }

      // For loops, let the audio end naturally and reset state
      if (isLoop) {
        audio.onended = () => {
          setLoopAudio(null);
          setPlayingLoopId(null);
        };
      }
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (loopAudio) {
        loopAudio.pause();
      }
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
    };
  }, [loopAudio]);

  // Video playback auto-stop after 20 seconds
  useEffect(() => {
    if (isVideoPlaying && videoElement) {
      const timer = setTimeout(() => {
        videoElement.pause();
        setIsVideoPlaying(false);
      }, 20000);

      return () => clearTimeout(timer);
    }
  }, [isVideoPlaying, videoElement]);

  // Cleanup video on unmount
  useEffect(() => {
    return () => {
      if (videoElement) {
        videoElement.pause();
      }
    };
  }, [videoElement]);

  // Set up drag
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      // Preserve original cover_image_url for high-res, optimize imageUrl for crate display
      const optimizedTrack = {
        ...track,
        imageUrl: getOptimizedTrackImage(track, 64),
        cover_image_url: track.cover_image_url, // CRITICAL: Keep original high-res URL
        // Ensure we have audioUrl for mixer compatibility
        // For video clips, use video_url as audioUrl since MP4 contains both audio and video
        // Preserve existing audioUrl if set (e.g., from Globe TrackNode), otherwise use stream_url, audio_url, or video_url
        audioUrl: (track as any).audioUrl || track.stream_url || track.audio_url || (track.content_type === 'video_clip' ? track.video_url : undefined),
        // Preserve video_url for video clips
        ...(track.content_type === 'video_clip' && track.video_url && {
          video_url: track.video_url
        }),
        // Preserve notes for CC text overlay
        notes: track.notes,
        // AI assistance flags for Creation display - explicitly preserve
        ai_assisted_idea: (track as any).ai_assisted_idea,
        ai_assisted_implementation: (track as any).ai_assisted_implementation,
        // Download/licensing fields - explicitly preserve for remix flow
        allow_downloads: (track as any).allow_downloads,
        download_price_stx: (track as any).download_price_stx,
        download_price_usdc: (track as any).download_price_usdc,
        license_type: (track as any).license_type,
      };

      return { track: optimizedTrack, source: 'globe' };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track]);

  // Clear hover state when dragging to prevent overlay in drag preview
  React.useEffect(() => {
    if (isDragging) {
      setIsHovered(false);
    }
  }, [isDragging]);

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
    if (track.content_type === 'radio_station') return 'Radio Station';
    if (track.content_type === 'station_pack') {
      return `Station Pack (${track.total_loops || '?'} stations)`;
    }
    if (track.content_type === 'video_clip') return 'Video Clip';
    return track.sample_type === 'vocals' ? 'Vocal' :
           track.sample_type === 'instrumentals' ? 'Instrumental' :
           'Track';
  };

  // Get border color based on content type
  const getBorderColor = () => {
    if (track.content_type === 'full_song') return 'border-[#A8E66B]';
    if (track.content_type === 'ep') return 'border-[#A8E66B]';
    if (track.content_type === 'loop') return 'border-[#A084F9]';
    if (track.content_type === 'loop_pack') return 'border-[#A084F9]';
    if (track.content_type === 'radio_station') return 'border-[#FFC044]';
    if (track.content_type === 'station_pack') return 'border-[#FFC044]';
    if (track.content_type === 'video_clip') return 'border-[#5BB5F9]';
    // Fallback for legacy data
    return track.sample_type === 'vocals' ? 'border-[#A084F9]' : 'border-[#A8E66B]';
  };

  // Get border thickness - thicker for multi-content (loop packs, EPs, and station packs)
  const getBorderThickness = () => {
    return (track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') ? 'border-4' : 'border-2';
  };

  // Get border style - dashed for drafts, solid for finalized content
  const getBorderStyle = () => {
    return (track as any).is_draft ? 'border-dashed' : 'border-solid';
  };

  // Check if this is a remix (has remix_depth > 0)
  const isRemix = ((track as any).remix_depth || 0) > 0 || ((track as any).generation || 0) > 0;
  const isVideoRemix = isRemix && !!(track as any).video_url;


  // Handle play click - supports audio_url (tracks), stream_url (radio), and video_url (videos)
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Handle video clips differently - play inline
    if (track.content_type === 'video_clip' && (track as any).video_url) {
      if (isVideoPlaying && videoElement) {
        // Pause video
        videoElement.pause();
        setIsVideoPlaying(false);
      } else {
        // Play video
        setIsVideoPlaying(true);
      }
      return;
    }

    // For radio stations, use stream_url; otherwise use audio_url
    const audioSource = track.stream_url || track.audio_url;
    const isRadioStation = track.content_type === 'radio_station' || track.content_type === 'station_pack';

    onPlayPreview(track.id, audioSource, isRadioStation);
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

  // Handle publish click - publishes draft to store
  const handlePublishClick = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isPublishing) return;

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Publish "${track.title}" to your store?\n\n` +
      `This will make it visible to everyone on the globe.`
    );

    if (!confirmed) return;

    setIsPublishing(true);

    try {
      const response = await fetch('/api/drafts/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: track.id,
          walletAddress: track.primary_uploader_wallet
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to publish');
      }

      // Fetch the updated track data to get current artwork/metadata
      const { data: updatedTrack } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('id', track.id)
        .single();

      // Update the track in the crate if it exists there
      if (updatedTrack && (window as any).updateInCollection) {
        (window as any).updateInCollection(track.id, {
          ...updatedTrack,
          is_draft: false,
          imageUrl: updatedTrack.cover_image_url,
          audioUrl: updatedTrack.audio_url
        });
      }

      showToast(`"${track.title}" published to your store!`, 'success');
      onPublishTrack?.(track.id);

    } catch (error: any) {
      console.error('Publish error:', error);
      showToast(error.message || 'Failed to publish', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle info click - opens TrackDetailsModal
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
  };


  return (
    <>
      <div className="relative group w-[160px] h-[160px]">
        {/* Compact Card Container - 160x160px */}
        <div
          ref={drag}
          className={`w-[160px] h-[160px] rounded-lg overflow-hidden transition-all duration-300 ${isRemix ? (isVideoRemix ? 'remix-video-shimmer-border' : 'remix-audio-shimmer-border') : `${getBorderColor()} ${getBorderThickness()}`} ${getBorderStyle()} bg-slate-800 relative`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab',
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
                    {track.content_type === 'video_clip' ? (
                      // Video icon for video clips without cover
                      <svg className="w-12 h-12 text-[#5BB5F9]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      // Music icon for audio content without cover
                      <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    )}
                  </div>
                )}

                {/* Video Player Overlay - only for video_clip content */}
                {track.content_type === 'video_clip' && (track as any).video_url && isVideoPlaying && (
                  <video
                    ref={(el) => {
                      setVideoElement(el);
                      if (el && isVideoPlaying) {
                        el.play().catch(err => console.error('Video play error:', err));
                      }
                    }}
                    src={(track as any).video_url}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    onEnded={() => setIsVideoPlaying(false)}
                  />
                )}

                {/* Draft Badge - for mic recordings not yet finalized */}
                {(track as any).is_draft && (
                  <div
                    className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      color: '#A084F9',
                      border: '1px dashed #A084F9'
                    }}
                  >
                    Draft
                  </div>
                )}

                {/* Track number badge - for individual tracks that are part of a pack/EP */}
                {/* Only show for child items (pack_position >= 1), not for pack containers (pack_position = 0) */}
                {track.pack_id && typeof track.pack_position === 'number' && track.pack_position >= 1 && (
                  <div
                    className="absolute top-1 left-1 w-6 h-6 rounded text-sm font-bold flex items-center justify-center z-10"
                    style={{
                      backgroundColor: track.content_type === 'full_song' ? '#A8E66B' : '#C4AEF8',
                      color: track.content_type === 'full_song' ? '#000000' : '#FFFFFF'
                    }}
                  >
                    {track.pack_position}
                  </div>
                )}

                {/* Licensed Badge - for purchased content in Library */}
                {ownedBadge && (
                  <div
                    className="absolute top-1 right-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide z-10"
                    style={{
                      backgroundColor: '#22c55e',
                      color: '#ffffff'
                    }}
                  >
                    Licensed
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
                {isHovered && !isDragging && (
                  <div className="absolute left-1 top-1/2 transform -translate-y-1/2 z-10">
                    <InfoIcon
                      size="lg"
                      onClick={handleInfoClick}
                      title="Click to see all info + drag individual tracks from Loop Packs/EPs"
                      className="text-white hover:text-white"
                    />
                  </div>
                )}

                {/* Hover Overlay - Hidden when video is playing or dragging */}
                {isHovered && !isVideoPlaying && !isDragging && (
                  <div className="hover-overlay absolute inset-0 bg-black bg-opacity-90 p-2">

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
                            {/* For radio stations, show uploader's display name instead of station name */}
                            {(track.content_type === 'radio_station' || track.content_type === 'station_pack')
                              ? (uploaderDisplayName || username || track.artist)
                              : track.artist}
                          </Link>
                        ) : (
                          <p className="text-white/80 text-xs truncate">{track.artist}</p>
                        )}
                      </div>
                    </div>

                    {/* Edit Button - positioned in upper-right corner (shown when onEditTrack is provided) */}
                    {showEditControls && onEditTrack && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditTrack(track);
                        }}
                        title="Edit track"
                        className="absolute top-1 right-1 w-9 h-9 bg-black/90 hover:bg-[#81E4F2]/30 rounded flex items-center justify-center transition-all border border-[#81E4F2]/60 hover:border-[#81E4F2] group z-20"
                      >
                        <svg className="w-5 h-5 text-[#81E4F2] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    )}

                    {/* Hide Button - positioned in upper-right corner (shown when onDeleteTrack is provided but not onEditTrack) */}
                    {showEditControls && onDeleteTrack && !onEditTrack && (
                      <button
                        onClick={handleDeleteClick}
                        title="Hide from store"
                        className="absolute top-1 right-1 w-9 h-9 bg-black/90 hover:bg-[#81E4F2]/30 rounded flex items-center justify-center transition-all border border-[#81E4F2]/60 hover:border-[#81E4F2] group z-20"
                      >
                        <svg className="w-5 h-5 text-[#81E4F2] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      </button>
                    )}

                    {/* Center: Play Button - Absolutely centered */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                      {/* Play Button - centered (for tracks with audio_url, radio stations with stream_url, or videos with video_url) */}
                      {(track.audio_url || track.stream_url || (track.content_type === 'video_clip' && (track as any).video_url)) && (
                        <button
                          onClick={handlePlayClick}
                          onMouseLeave={() => {
                            // Only stop preview on mouse leave for regular tracks, not radio stations or videos
                            const isRadioStation = track.content_type === 'radio_station';
                            const isVideo = track.content_type === 'video_clip';
                            if (isPlaying && onStopPreview && !isRadioStation && !isVideo) {
                              onStopPreview();
                            }
                          }}
                          className="transition-all hover:scale-110"
                          title={(track.content_type === 'radio_station' || track.content_type === 'station_pack')
                            ? "Preview • Click radio icon for continuous play"
                            : undefined}
                        >
                          {(isPlaying || isVideoPlaying) ? (
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

                    {/* Chevron Button - for loop packs, EPs, and station packs - positioned on right side, vertically centered */}
                    {(track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsPackExpanded(!isPackExpanded);
                        }}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center transition-all hover:scale-110 z-10"
                        title={isPackExpanded ? (track.content_type === 'ep' ? "Collapse tracks" : track.content_type === 'station_pack' ? "Collapse stations" : "Collapse loops") : (track.content_type === 'ep' ? "Expand tracks" : track.content_type === 'station_pack' ? "Expand stations" : "Expand loops")}
                      >
                        {isPackExpanded ? (
                          <ChevronUp className="w-5 h-5" style={{ color: track.content_type === 'ep' ? '#A8E66B' : track.content_type === 'station_pack' ? '#FFC044' : '#C4AEF8' }} strokeWidth={3} />
                        ) : (
                          <ChevronDown className="w-5 h-5" style={{ color: track.content_type === 'ep' ? '#A8E66B' : track.content_type === 'station_pack' ? '#FFC044' : '#C4AEF8' }} strokeWidth={3} />
                        )}
                      </button>
                    )}

                    {/* Payment Pending Warning - REMOVED: No longer needed for simplified payment model */}

                    {/* Publish Button - for drafts in dashboard only */}
                    {showEditControls && (track as any).is_draft && (
                      <button
                        onClick={handlePublishClick}
                        disabled={isPublishing}
                        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all hover:scale-105 disabled:opacity-50 animate-pulse"
                        style={{
                          backgroundColor: '#A084F9',
                          color: '#FFFFFF',
                          border: '1px solid rgba(255,255,255,0.3)',
                          animation: isPublishing ? 'none' : 'pulse 2s ease-in-out infinite'
                        }}
                        title="Publish to your store"
                      >
                        {isPublishing ? 'Publishing...' : 'Publish'}
                      </button>
                    )}

                    {/* Bottom Section: Price/Remix Icon, Content Type Badge, BPM */}
                    <div className="absolute bottom-2 left-0 right-0 flex items-center justify-between">
                      {/* Buy Button OR Remix Icon (left) - compact */}
                      <div className="pl-2">
                      {(() => {
                        // Resolve USDC prices with STX fallback for legacy tracks
                        const downloadPrice = track.download_price_usdc ?? track.download_price_stx ?? null;
                        const totalPrice = track.price_usdc || track.price_stx || null;

                        // Songs and EPs ALWAYS show download price (never mixer icon)
                        if (track.content_type === 'full_song' || track.content_type === 'ep') {
                          if (downloadPrice !== null && downloadPrice !== undefined) {
                            // For EPs, show total pack price; for songs, show per-item price
                            const displayPrice = track.content_type === 'ep'
                              ? (totalPrice || downloadPrice)
                              : downloadPrice;
                            return downloadPrice === 0 ? (
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
                                title={track.content_type === 'ep' ? "Download full EP - click to add to cart" : "Download price in USDC - click to add to cart"}
                              >
                                {displayPrice}
                              </button>
                            );
                          }
                          // Fallback to total price
                          if (totalPrice) {
                            return (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Download price in USDC - click to add to cart"
                              >
                                {totalPrice}
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

                        // Loop Packs: Check if downloadable or remix-only (same logic as individual loops)
                        if (track.content_type === 'loop_pack') {
                          // PRIORITY 1: Check allow_downloads flag first (most reliable indicator)
                          if (track.allow_downloads === false) {
                            // This is a remix-only pack - show "M" badge
                            return (
                              <div
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                                title={`Platform remix only - $${PRICING.mixer.loopRecording} USDC per loop used in remix`}
                              >
                                M
                              </div>
                            );
                          }

                          // PRIORITY 2: Pack has download price — show total pack price
                          if (downloadPrice !== null) {
                            const packTotal = totalPrice || downloadPrice;
                            return downloadPrice === 0 ? (
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
                                title="Download full pack - click to add to cart"
                              >
                                {packTotal}
                              </button>
                            );
                          }

                          // PRIORITY 3: Legacy packs with total price only
                          if (totalPrice && track.allow_downloads !== false) {
                            return (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Download full pack - click to add to cart"
                              >
                                {totalPrice}
                              </button>
                            );
                          }

                          // Fallback: no pricing info, assume remix-only
                          return (
                            <div
                              className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                              title={`Platform remix only - $${PRICING.mixer.loopRecording} USDC per loop used in remix`}
                            >
                              M
                            </div>
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
                                title={`Platform remix only - $${PRICING.mixer.loopRecording} USDC per recorded remix`}
                              >
                                M
                              </div>
                            );
                          }

                          // PRIORITY 2: Loop has download price
                          if (downloadPrice !== null) {
                            return downloadPrice === 0 ? (
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
                                title="Download price in USDC - click to add to cart"
                              >
                                {downloadPrice}
                              </button>
                            );
                          }

                          // PRIORITY 3: Legacy loops with total price only
                          if (totalPrice && track.allow_downloads !== false) {
                            return (
                              <button
                                onClick={handlePurchaseClick}
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                                title="Download price in USDC - click to add to cart"
                              >
                                {totalPrice}
                              </button>
                            );
                          }

                          // Fallback: no pricing info, assume remix-only
                          return (
                            <div
                              className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                              title={`Platform remix only - $${PRICING.mixer.loopRecording} USDC per recorded remix`}
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
                              title={`Platform remix only - $${PRICING.mixer.loopRecording} USDC per recorded remix`}
                            >
                              M
                            </div>
                          );
                        }

                        // For RADIO STATIONS: Show Radio icon button to send to RadioWidget
                        if (track.content_type === 'radio_station' || track.content_type === 'station_pack') {
                          return (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if ((window as any).loadRadioTrack) {
                                  // On home page - load directly
                                  (window as any).loadRadioTrack(track);
                                } else {
                                  // Not on home page - save to localStorage for when they navigate back
                                  localStorage.setItem('mixmi-pending-radio', JSON.stringify(track));
                                  showToast('Radio station saved! It will load when you return to the globe.', 'success');
                                }
                              }}
                              className="text-white hover:text-[#81E4F2] transition-colors p-0 flex items-center"
                              title="Add to Radio Widget"
                            >
                              <Radio className="w-5 h-5" />
                            </button>
                          );
                        }

                        // Fallback for unknown content types: check for any price
                        if (downloadPrice || totalPrice) {
                          return (
                            <button
                              onClick={handlePurchaseClick}
                              className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded transition-all transform hover:scale-105 text-xs"
                              title="Download price in USDC - click to add to cart"
                            >
                              {downloadPrice || totalPrice}
                            </button>
                          );
                        }

                        // Ultimate fallback: no price info
                        return null;
                      })()}
                      </div>

                      {/* Content Type Badge (center) with generation indicators */}
                      <span className="text-xs font-mono font-medium text-white absolute left-1/2 transform -translate-x-1/2">
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
                        {track.content_type === 'radio_station' && 'RADIO'}
                        {track.content_type === 'station_pack' && '📻 PACK'}
                        {track.content_type === 'video_clip' && 'VIDEO'}
                        {!track.content_type && 'TRACK'}
                      </span>

                      {/* BPM Badge OR LIVE indicator (right) - hide for EPs and videos */}
                      <div className="pr-2">
                      {(track.content_type === 'radio_station' || track.content_type === 'station_pack') ? (
                        <span
                          className="text-[#FFC044] font-bold text-xs"
                          title="Live radio stream"
                        >
                          LIVE
                        </span>
                      ) : track.content_type !== 'ep' && track.content_type !== 'video_clip' ? (
                        <span
                          className="text-sm font-mono font-bold text-white"
                          title={track.bpm ? "BPM" : "Free-form / Variable tempo"}
                        >
                          {track.bpm || '~'}
                        </span>
                      ) : (
                        <div className="w-12"></div>
                      )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>

        {/* Expandable Drawer - For loop packs, EPs, and station packs */}
        {(track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') && isPackExpanded && (
          <div
            className="w-[160px] bg-slate-900 border-2 border-t-0 rounded-b-lg overflow-hidden"
            style={{
              borderColor: track.content_type === 'ep' ? '#A8E66B' : track.content_type === 'station_pack' ? '#FFC044' : '#A084F9',
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
                {packLoops.map((loop, index) => (
                  <DraggableDrawerTrack
                    key={loop.id}
                    track={loop}
                    index={index}
                    contentType={track.content_type}
                    onPlay={handleLoopPlay}
                    playingLoopId={playingLoopId}
                  />
                ))}
              </div>
            ) : (
              <div className="p-2 text-xs text-gray-500 text-center">
                {track.content_type === 'ep' ? 'No tracks found' : track.content_type === 'station_pack' ? 'No stations found' : 'No loops found'}
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

        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        /* Audio remix shimmer border — lavender + lime green */
        .remix-audio-shimmer-border {
          position: relative;
          border: 3px solid transparent;
          background:
            linear-gradient(to right, #1e293b, #1e293b) padding-box,
            linear-gradient(135deg, #FFFFFF 0%, #9772F4 14%, #FFFFFF 28%, #A8E66B 42%, #FFFFFF 56%, #A084F9 70%, #FFFFFF 84%, #A8E66B 100%) border-box;
          background-size: 100% 100%, 400% 400%;
          animation: shimmer-border 6s ease-in-out infinite;
        }

        /* Video remix shimmer border — deeper sky blues */
        .remix-video-shimmer-border {
          position: relative;
          border: 3px solid transparent;
          background:
            linear-gradient(to right, #1e293b, #1e293b) padding-box,
            linear-gradient(135deg, #FFFFFF 0%, #2792F5 14%, #FFFFFF 28%, #5BB5F9 42%, #FFFFFF 56%, #2792F5 70%, #FFFFFF 84%, #1E7AD4 100%) border-box;
          background-size: 100% 100%, 400% 400%;
          animation: shimmer-border 6s ease-in-out infinite;
        }

        @keyframes shimmer-border {
          0%, 100% { background-position: 0% 0%, 0% 50%; }
          50% { background-position: 0% 0%, 100% 50%; }
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