"use client";

import React, { useEffect, useState } from 'react';
import { IPTrack } from '@/types';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useDrag } from 'react-dnd';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import { getAIAssistanceDisplay } from '@/lib/aiAssistanceUtils';

interface TrackDetailsModalProps {
  track: IPTrack;
  isOpen: boolean;
  onClose: () => void;
}

// Draggable individual track component for modal
interface DraggableModalTrackProps {
  track: any; // Individual loop or song
  children: React.ReactNode;
}

function DraggableModalTrack({ track, children }: DraggableModalTrackProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      console.log('🎵 Modal track being dragged:', track);
      return { track };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track]);

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      {children}
    </div>
  );
}

export default function TrackDetailsModal({ track, isOpen, onClose }: TrackDetailsModalProps) {
  // Debug: Track what modal actually receives vs what globe conversion produces
  if (isOpen && track.id === '9f490a13-3966-43db-bce1-54e67b309826-loc-0') {
    console.log('🎭 MODAL RECEIVED TRACK OBJECT:', track);
    console.log('🎭 MODAL IP rights:', {
      composition: track.composition_split,
      production: track.production_split, 
      wallet: track.wallet_address
    });
  }
  const [packLoops, setPackLoops] = useState<IPTrack[]>([]);
  const [loadingLoops, setLoadingLoops] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [sourceTracks, setSourceTracks] = useState<IPTrack[]>([]);
  const [loadingSourceTracks, setLoadingSourceTracks] = useState(false);
  const [ipRights, setIPRights] = useState<{
    composition_splits: Array<{ percentage: number; wallet: string }>;
    production_splits: Array<{ percentage: number; wallet: string }>;
    notes: string;
    price_stx: number;
    remix_price: number;
    license_type: string;
    license_selection: string;
    allow_downloads: boolean;
    remix_price_stx: number;
    download_price_stx: number | null;
  } | null>(null);

  // Pending collaborators state
  const [pendingCollaborators, setPendingCollaborators] = useState<Array<{
    collaborator_name: string;
    split_percentage: number;
    split_type: string;
    split_position: number;
    status: string;
  }>>([]);

  // Derived-from track state (provenance - where this content came from)
  const [derivedFromTrack, setDerivedFromTrack] = useState<{ id: string; title: string; artist: string } | null>(null);

  // Audio playback state for individual loops
  const [playingLoopId, setPlayingLoopId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);

  // Video playback state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [videoTimeout, setVideoTimeout] = useState<NodeJS.Timeout | null>(null);

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

    if (isOpen) {
      fetchUsername();
    }
  }, [track.primary_uploader_wallet, isOpen]);

  // Fetch pending collaborators from database
  useEffect(() => {
    if (isOpen && track.id) {
      const baseId = track.id.split('-loc-')[0];
      console.log('🔍 Fetching pending collaborators for track ID:', baseId);

      supabase
        .from('pending_collaborators')
        .select('collaborator_name, split_percentage, split_type, split_position, status')
        .eq('track_id', baseId)
        .order('split_position', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.log('📝 No pending_collaborators table or no records:', error.message);
            setPendingCollaborators([]);
          } else {
            console.log('✅ Pending collaborators:', data);
            setPendingCollaborators(data || []);
          }
        });
    }
  }, [isOpen, track.id]);

  // Fetch derived-from track (provenance) if this track has one
  useEffect(() => {
    if (isOpen && track.id) {
      const baseId = track.id.split('-loc-')[0];

      // First get the derived_from_track_id from this track
      supabase
        .from('ip_tracks')
        .select('derived_from_track_id')
        .eq('id', baseId)
        .single()
        .then(({ data, error }) => {
          if (error || !data?.derived_from_track_id) {
            setDerivedFromTrack(null);
            return;
          }

          // Now fetch the derived-from track's details
          supabase
            .from('ip_tracks')
            .select('id, title, artist')
            .eq('id', data.derived_from_track_id)
            .single()
            .then(({ data: trackData, error: trackError }) => {
              if (trackError || !trackData) {
                console.log('⚠️ Could not fetch derived-from track:', trackError);
                setDerivedFromTrack(null);
              } else {
                console.log('✅ Found derived-from track:', trackData.title);
                setDerivedFromTrack(trackData);
              }
            });
        });
    }
  }, [isOpen, track.id]);

  // Fetch IP rights directly from database
  useEffect(() => {
    if (isOpen && track.id) {
      const baseId = track.id.split('-loc-')[0]; // Remove location suffix
      console.log('🔍 Fetching IP rights for track ID:', baseId);

      supabase
        .from('ip_tracks')
        .select(`
          composition_split_1_percentage, composition_split_1_wallet,
          composition_split_2_percentage, composition_split_2_wallet,
          composition_split_3_percentage, composition_split_3_wallet,
          composition_split_4_percentage, composition_split_4_wallet,
          composition_split_5_percentage, composition_split_5_wallet,
          composition_split_6_percentage, composition_split_6_wallet,
          composition_split_7_percentage, composition_split_7_wallet,
          production_split_1_percentage, production_split_1_wallet,
          production_split_2_percentage, production_split_2_wallet,
          production_split_3_percentage, production_split_3_wallet,
          production_split_4_percentage, production_split_4_wallet,
          production_split_5_percentage, production_split_5_wallet,
          production_split_6_percentage, production_split_6_wallet,
          production_split_7_percentage, production_split_7_wallet,
          uploader_address, primary_uploader_wallet, notes, price_stx, remix_price,
          license_type, license_selection, source_track_ids,
          allow_downloads, remix_price_stx, download_price_stx
        `)
        .eq('id', baseId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('❌ Error fetching IP rights:', error);
          } else {
            console.log('✅ IP rights from database:', data);

            // Collect all composition splits
            const compositionSplits = [];
            if (data.composition_split_1_wallet && data.composition_split_1_percentage) {
              compositionSplits.push({
                percentage: data.composition_split_1_percentage,
                wallet: data.composition_split_1_wallet
              });
            }
            if (data.composition_split_2_wallet && data.composition_split_2_percentage) {
              compositionSplits.push({
                percentage: data.composition_split_2_percentage,
                wallet: data.composition_split_2_wallet
              });
            }
            if (data.composition_split_3_wallet && data.composition_split_3_percentage) {
              compositionSplits.push({
                percentage: data.composition_split_3_percentage,
                wallet: data.composition_split_3_wallet
              });
            }

            // Collect all production splits
            const productionSplits = [];
            if (data.production_split_1_wallet && data.production_split_1_percentage) {
              productionSplits.push({
                percentage: data.production_split_1_percentage,
                wallet: data.production_split_1_wallet
              });
            }
            if (data.production_split_2_wallet && data.production_split_2_percentage) {
              productionSplits.push({
                percentage: data.production_split_2_percentage,
                wallet: data.production_split_2_wallet
              });
            }
            if (data.production_split_3_wallet && data.production_split_3_percentage) {
              productionSplits.push({
                percentage: data.production_split_3_percentage,
                wallet: data.production_split_3_wallet
              });
            }

            setIPRights({
              composition_splits: compositionSplits,
              production_splits: productionSplits,
              notes: data.notes || '',
              price_stx: data.price_stx || 0,
              remix_price: data.remix_price || 0,
              license_type: data.license_type || '',
              license_selection: data.license_selection || '',
              allow_downloads: data.allow_downloads || false,
              remix_price_stx: data.remix_price_stx || 1.0,
              download_price_stx: data.download_price_stx || null
            });
          }
        });
    }
  }, [isOpen, track.id]);

  // Fetch individual loops if this is a loop pack OR individual songs if this is an EP OR individual stations if this is a station pack
  useEffect(() => {
    if (isOpen && (track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') && track.id) {
      setLoadingLoops(true);

      // For loop packs, EPs, and station packs, use the track's own ID to find individual items
      const packId = track.pack_id || track.id.split('-loc-')[0]; // Remove location suffix if present

      // Determine what content type to fetch
      const contentType = track.content_type === 'loop_pack' ? 'loop' : track.content_type === 'station_pack' ? 'radio_station' : 'full_song';

      supabase
        .from('ip_tracks')
        .select('*')
        .eq('pack_id', packId)
        .eq('content_type', contentType)
        .order('pack_position', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.error(`❌ Error fetching pack ${contentType}s:`, error);
          } else {
            setPackLoops(data || []);
          }
          setLoadingLoops(false);
        });
    } else {
      setPackLoops([]);
    }
  }, [isOpen, track.content_type, track.pack_id]);

  // Fetch source tracks for remixes
  useEffect(() => {
    const isRemix = track.remix_depth && track.remix_depth > 0;
    const hasLegacyIds = track.source_track_ids && track.source_track_ids.length > 0;
    const hasNewIds = track.parent_track_1_id || track.parent_track_2_id;

    if (isOpen && isRemix && (hasLegacyIds || hasNewIds)) {
      setLoadingSourceTracks(true);

      // Build list of source track IDs from either legacy or new fields
      let sourceIds: string[] = [];
      if (hasLegacyIds) {
        sourceIds = track.source_track_ids;
      } else if (hasNewIds) {
        // Use new parent fields
        if (track.parent_track_1_id) sourceIds.push(track.parent_track_1_id);
        if (track.parent_track_2_id) sourceIds.push(track.parent_track_2_id);
      }

      console.log('🔍 Fetching source tracks for remix:', {
        trackId: track.id,
        remixDepth: track.remix_depth,
        sourceIds
      });

      supabase
        .from('ip_tracks')
        .select(`
          id, title, artist, primary_uploader_wallet,
          composition_split_1_wallet, composition_split_1_percentage,
          composition_split_2_wallet, composition_split_2_percentage,
          composition_split_3_wallet, composition_split_3_percentage,
          production_split_1_wallet, production_split_1_percentage,
          production_split_2_wallet, production_split_2_percentage,
          production_split_3_wallet, production_split_3_percentage
        `)
        .in('id', sourceIds)
        .then(({ data, error }) => {
          if (error) {
            console.error('❌ Error fetching source tracks:', error);
          } else {
            console.log('✅ Fetched source tracks with IP splits:', data);
            setSourceTracks(data || []);
          }
          setLoadingSourceTracks(false);
        });
    } else {
      setSourceTracks([]);
    }
  }, [isOpen, track.remix_depth, track.source_track_ids, track.parent_track_1_id, track.parent_track_2_id]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // Video playback function
  const handleVideoPlayPause = () => {
    if (!videoElement) return;

    if (isVideoPlaying) {
      // Pause video
      videoElement.pause();
      setIsVideoPlaying(false);
      if (videoTimeout) {
        clearTimeout(videoTimeout);
        setVideoTimeout(null);
      }
    } else {
      // Play video
      videoElement.play().catch(err => console.error('Video play error:', err));
      setIsVideoPlaying(true);

      // 20-second auto-stop
      const timeout = setTimeout(() => {
        videoElement.pause();
        setIsVideoPlaying(false);
      }, 20000);
      setVideoTimeout(timeout);
    }
  };

  // Audio playback functions for individual loops
  const handleLoopPlayPause = async (loop: IPTrack) => {
    const audioSource = loop.audio_url || loop.stream_url;
    if (!audioSource) return;

    const isRadioStation = loop.content_type === 'radio_station';

    // If clicking the same loop that's playing, pause it
    if (playingLoopId === loop.id && currentAudio) {
      currentAudio.pause();
      setPlayingLoopId(null);
      setCurrentAudio(null);
      if (previewTimeout) {
        clearTimeout(previewTimeout);
        setPreviewTimeout(null);
      }
      return;
    }

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      setPreviewTimeout(null);
    }

    try {
      // Create and play new audio
      const audio = new Audio(audioSource);

      // Only set crossOrigin for regular tracks that need audio analysis
      // Radio stations don't need this and it causes CORS errors
      if (!isRadioStation) {
        audio.crossOrigin = 'anonymous';
      }

      await audio.play();
      setCurrentAudio(audio);
      setPlayingLoopId(loop.id);

      // 20-second preview timeout for ALL tracks (including radio stations)
      // Only the Radio Widget should play indefinitely
      const timeoutId = setTimeout(() => {
        audio.pause();
        setPlayingLoopId(null);
        setCurrentAudio(null);
      }, 20000);
      setPreviewTimeout(timeoutId);

      // Handle audio end (only for non-radio tracks)
      if (!isRadioStation) {
        audio.addEventListener('ended', () => {
          setPlayingLoopId(null);
          setCurrentAudio(null);
          if (previewTimeout) {
            clearTimeout(previewTimeout);
          }
        });
      }

    } catch (error) {
      console.error('Playback failed:', error);
    }
  };

  // Cleanup audio and video when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
      if (videoElement) {
        videoElement.pause();
        setVideoElement(null);
      }
      if (videoTimeout) {
        clearTimeout(videoTimeout);
      }
      setPlayingLoopId(null);
      setIsVideoPlaying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Format helpers
  const getTrackType = () => {
    if (track.content_type === 'full_song') return 'Song';
    if (track.content_type === 'ep') return 'EP';
    if (track.content_type === 'loop') return '8-Bar Loop';
    if (track.content_type === 'mix') return 'Mix';
    if (track.content_type === 'loop_pack') return 'Loop Pack';
    if (track.content_type === 'radio_station') return 'Radio Station';
    if (track.content_type === 'station_pack') return 'Radio Station Pack';
    if (track.content_type === 'video_clip') return 'Video Clip';
    return 'Track';
  };

  // Check if this is a radio station (simplified modal)
  const isRadioStation = track.content_type === 'radio_station' || track.content_type === 'station_pack';

  const getGeneration = () => {
    // Only show generation for loops and mixes (not songs, EPs, etc.)
    if (track.content_type !== 'loop' && track.content_type !== 'mix') return null;

    if (track.remix_depth === 0) return '🌱 Original Seed';
    if (track.remix_depth === 1) return '🌿 Generation 1';
    if (track.remix_depth === 2) return '🌳 Generation 2';
    if (track.remix_depth && track.remix_depth > 2) return `🌳 Generation ${track.remix_depth}`;
    return null;
  };

  const getLicense = () => {
    // All content types now support platform remix (mixer accepts loops, songs, videos)
    // The only distinction is whether downloads are also allowed
    if (track.allow_downloads || ipRights?.allow_downloads) {
      return 'Platform Remix + Download';
    }
    return 'Platform Remix Only';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const formatWallet = (wallet: string) => {
    if (!wallet) return '';
    if (wallet.length > 20) {
      return `${wallet.slice(0, 8)}...${wallet.slice(-8)}`;
    }
    return wallet;
  };

  // Get collaborator display info - resolves name from pending: prefix or pending_collaborators table
  const getCollaboratorDisplay = (wallet: string, splitType: 'composition' | 'production', position: number): { name: string; isPending: boolean } => {
    // Check if wallet has pending: prefix (name-only collaborator)
    if (wallet.startsWith('pending:')) {
      const name = wallet.replace('pending:', '');
      return { name, isPending: true };
    }

    // Check pending_collaborators table for this position
    const pendingCollab = pendingCollaborators.find(
      pc => pc.split_type === splitType && pc.split_position === position
    );
    if (pendingCollab) {
      return { name: pendingCollab.collaborator_name, isPending: pendingCollab.status === 'pending' };
    }

    // Check if it's the creator's wallet (primary uploader)
    if (wallet === track.primary_uploader_wallet) {
      return { name: track.artist || 'Creator', isPending: false };
    }

    // Default: show "Creator" with wallet
    return { name: 'Creator', isPending: false };
  };

  // Create section divider
  const Divider = ({ title }: { title: string }) => (
    <div className="mb-3">
      <div className="text-gray-400 text-xs font-bold tracking-wider mb-1">{title}</div>
      <div className="border-b border-gray-700" style={{ borderBottomWidth: '1px' }}>
        <div className="h-px bg-gradient-to-r from-gray-600 to-transparent" />
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="relative z-10 bg-slate-900 rounded-lg w-full max-w-[320px] max-h-[70vh] overflow-hidden shadow-2xl border border-gray-800"
        style={{ fontFamily: 'monospace' }}
      >
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white text-sm font-bold tracking-wider">TRACK DETAILS</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(70vh-120px)] p-6 space-y-4">

          {/* Track Title and Artist - Top Section */}
          <div className="mb-4">
            {track.primary_uploader_wallet ? (
              <Link
                href={username ? `/store/${username}` : `/store/${track.primary_uploader_wallet}`}
                className="font-bold text-white text-lg leading-tight hover:text-[#81E4F2] transition-colors block mb-1"
              >
                {track.title}
              </Link>
            ) : (
              <h3 className="font-bold text-white text-lg leading-tight mb-1">{track.title}</h3>
            )}
            {track.primary_uploader_wallet ? (
              <Link
                href={username ? `/profile/${username}` : `/profile/${track.primary_uploader_wallet}`}
                className="text-gray-400 text-sm hover:text-[#81E4F2] transition-colors"
              >
                {track.artist}
              </Link>
            ) : (
              <p className="text-gray-400 text-sm">{track.artist}</p>
            )}
          </div>

          {/* Video Player Section - For Video Clips Only */}
          {track.content_type === 'video_clip' && (track as any).video_url && (
            <div className="mb-6">
              <Divider title="VIDEO PLAYER" />
              <div className="relative w-full bg-black rounded-lg overflow-hidden border-2 border-[#2792F5]">
                {/* Video Element */}
                <video
                  ref={(el) => setVideoElement(el)}
                  src={(track as any).video_url}
                  className="w-full"
                  style={{ aspectRatio: '16/9' }}
                  muted
                  playsInline
                  onEnded={() => {
                    setIsVideoPlaying(false);
                    if (videoTimeout) {
                      clearTimeout(videoTimeout);
                      setVideoTimeout(null);
                    }
                  }}
                />

                {/* Play/Pause Overlay Button */}
                {!isVideoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <button
                      onClick={handleVideoPlayPause}
                      className="w-16 h-16 rounded-full bg-[#2792F5] hover:bg-[#2792F5]/80 flex items-center justify-center transition-all hover:scale-110"
                      title="Play video"
                    >
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Control Bar - Always visible when playing */}
                {isVideoPlaying && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleVideoPlayPause}
                        className="w-10 h-10 rounded-full bg-[#2792F5] hover:bg-[#2792F5]/80 flex items-center justify-center transition-all"
                        title="Pause video"
                      >
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                      </button>
                      <span className="text-white text-xs">
                        20-second preview
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Individual Loops Section - For Loop Packs Only */}
          {track.content_type === 'loop_pack' && (
            <div>
              <Divider title="INDIVIDUAL LOOPS" />
              {loadingLoops ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                  Loading loops...
                </div>
              ) : packLoops.length > 0 ? (
                <div className="space-y-2">
                  {packLoops.map((loop, index) => (
                    <DraggableModalTrack key={loop.id} track={loop}>
                      <div 
                        className="group flex items-center gap-3 p-2 bg-slate-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors cursor-grab"
                      >
                      {/* Loop Number */}
                      <div className="flex-shrink-0 w-6 h-6 rounded text-white text-xs font-bold flex items-center justify-center" style={{backgroundColor: '#9772F4'}}>
                        {index + 1}
                      </div>
                      
                      {/* Loop Name */}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 text-xs font-medium truncate">
                          {loop.title || `Loop ${index + 1}`}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {loop.bpm || '~'} BPM
                        </div>
                      </div>
                      
                      {/* Drag Handle - appears on hover */}
                      <div 
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all cursor-grab"
                        title="Drag to Crate or Mixer"
                      >
                        <GripVertical className="w-3 h-3 text-gray-400 hover:text-white" />
                      </div>
                      
                      {/* Play/Pause Button */}
                      <button
                        onClick={() => handleLoopPlayPause(loop)}
                        disabled={!loop.audio_url}
                        className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center transition-colors disabled:bg-gray-700"
                        style={{
                          backgroundColor: loop.audio_url ? '#9772F4' : '#374151',
                          opacity: playingLoopId === loop.id ? 0.8 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (loop.audio_url) {
                            (e.target as HTMLElement).style.opacity = '0.8';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (loop.audio_url) {
                            (e.target as HTMLElement).style.opacity = playingLoopId === loop.id ? '0.8' : '1';
                          }
                        }}
                        title={
                          !loop.audio_url 
                            ? 'Audio not available'
                            : playingLoopId === loop.id 
                              ? `Pause ${loop.title}` 
                              : `Play ${loop.title}`
                        }
                      >
                        {playingLoopId === loop.id ? (
                          // Pause icon
                          <svg 
                            className="w-3 h-3 text-white" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                          </svg>
                        ) : (
                          // Play icon  
                          <svg 
                            className="w-3 h-3 text-white ml-0.5" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4v12l10-6z" />
                          </svg>
                        )}
                      </button>
                      </div>
                    </DraggableModalTrack>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  No individual loops found for this pack
                </div>
              )}
            </div>
          )}

          {/* Individual Songs Section - For EPs Only */}
          {track.content_type === 'ep' && (
            <div>
              <Divider title="INDIVIDUAL SONGS" />
              {loadingLoops ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                  Loading songs...
                </div>
              ) : packLoops.length > 0 ? (
                <div className="space-y-2">
                  {packLoops.map((song, index) => (
                    <DraggableModalTrack key={song.id} track={song}>
                      <div
                        className="group flex items-center gap-3 p-2 bg-slate-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors cursor-grab"
                      >
                      {/* Song Number */}
                      <div className="flex-shrink-0 w-6 h-6 bg-[#FFE4B5] text-slate-900 rounded text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </div>
                      
                      {/* Song Name */}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 text-xs font-medium truncate">
                          {song.title || `Song ${index + 1}`}
                        </div>
                        {song.duration && (
                          <div className="text-gray-500 text-xs">
                            {formatDuration(song.duration)}
                          </div>
                        )}
                      </div>
                      
                      {/* Play/Pause Button */}
                      <button
                        onClick={() => handleLoopPlayPause(song)}
                        disabled={!song.audio_url}
                        className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center transition-colors ${
                          playingLoopId === song.id
                            ? 'bg-[#FFE4B5] hover:bg-[#FFE4B5]/80 text-slate-900' 
                            : 'bg-[#FFE4B5] hover:bg-[#FFE4B5]/80 text-slate-900'
                        } disabled:bg-gray-700`}
                        title={
                          !song.audio_url 
                            ? 'Audio not available'
                            : playingLoopId === song.id 
                              ? `Pause ${song.title}` 
                              : `Play ${song.title}`
                        }
                      >
                        {playingLoopId === song.id ? (
                          // Pause icon
                          <svg 
                            className="w-3 h-3" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                          </svg>
                        ) : (
                          // Play icon  
                          <svg 
                            className="w-3 h-3 ml-0.5" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4v12l10-6z" />
                          </svg>
                        )}
                      </button>
                      </div>
                    </DraggableModalTrack>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  No individual songs found for this EP
                </div>
              )}
            </div>
          )}

          {/* Individual Stations Section - For Station Packs Only */}
          {track.content_type === 'station_pack' && (
            <div>
              <Divider title="INDIVIDUAL STATIONS" />
              {loadingLoops ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                  Loading stations...
                </div>
              ) : packLoops.length > 0 ? (
                <div className="space-y-2">
                  {packLoops.map((station, index) => (
                    <DraggableModalTrack key={station.id} track={station}>
                      <div
                        className="group flex items-center gap-3 p-2 bg-slate-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors cursor-grab"
                      >
                      {/* Station Number */}
                      <div className="flex-shrink-0 w-6 h-6 rounded text-white text-xs font-bold flex items-center justify-center" style={{backgroundColor: '#FB923C'}}>
                        {index + 1}
                      </div>

                      {/* Station Name */}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 text-xs font-medium truncate">
                          {station.title || `Station ${index + 1}`}
                        </div>
                        {station.artist && (
                          <div className="text-gray-500 text-xs truncate">
                            {station.artist}
                          </div>
                        )}
                      </div>

                      {/* Drag Handle - appears on hover */}
                      <div
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all cursor-grab"
                        title="Drag to Radio Widget"
                      >
                        <GripVertical className="w-3 h-3 text-gray-400 hover:text-white" />
                      </div>

                      {/* Play/Pause Button */}
                      <button
                        onClick={() => handleLoopPlayPause(station)}
                        disabled={!station.stream_url}
                        className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center transition-colors disabled:bg-gray-700"
                        style={{
                          backgroundColor: station.stream_url ? '#FB923C' : '#374151',
                          opacity: playingLoopId === station.id ? 0.8 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (station.stream_url) {
                            (e.target as HTMLElement).style.opacity = '0.8';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (station.stream_url) {
                            (e.target as HTMLElement).style.opacity = playingLoopId === station.id ? '0.8' : '1';
                          }
                        }}
                        title={
                          !station.stream_url
                            ? 'Stream not available'
                            : playingLoopId === station.id
                              ? `Pause ${station.title}`
                              : `Play ${station.title}`
                        }
                      >
                        {playingLoopId === station.id ? (
                          // Pause icon
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                          </svg>
                        ) : (
                          // Play icon
                          <svg
                            className="w-3 h-3 text-white ml-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4v12l10-6z" />
                          </svg>
                        )}
                      </button>
                      </div>
                    </DraggableModalTrack>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  No individual stations found for this pack
                </div>
              )}
            </div>
          )}

          {/* Price and License - moved here for better flow - Skip for radio stations */}
          {!isRadioStation && (
          <div>
            <Divider title="PRICE AND LICENSE" />
            <div className="space-y-1 text-xs">
              <div className="flex">
                <span className="text-gray-500 w-24">License:</span>
                <span className="text-gray-300">
                  {ipRights?.allow_downloads
                    ? 'Platform Remix + Download'
                    : 'Platform Remix Only'}
                </span>
              </div>
              {track.content_type === 'loop_pack' ? (
                <>
                  {ipRights?.allow_downloads && ipRights?.download_price_stx !== null ? (
                    // Downloadable pack: Show total download price
                    <div className="flex">
                      <span className="text-gray-500 w-24">Download:</span>
                      <span className="text-gray-300">{ipRights.download_price_stx} STX (full pack)</span>
                    </div>
                  ) : (
                    // Remix-only pack: Show per-loop remix price
                    <div className="flex">
                      <span className="text-gray-500 w-24">Remix Fee:</span>
                      <span className="text-gray-300">1 STX per loop</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="text-gray-500 w-24">Loops:</span>
                    <span className="text-gray-300">{packLoops.length || '?'} loops in pack</span>
                  </div>
                </>
              ) : track.content_type === 'loop' ? (
                // Loops: Show different pricing based on allow_downloads
                <>
                  {ipRights?.allow_downloads && ipRights?.download_price_stx !== null ? (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Download:</span>
                      <span className="text-gray-300">{ipRights.download_price_stx} STX</span>
                    </div>
                  ) : (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Remix Fee:</span>
                      <span className="text-gray-300">1 STX per mix</span>
                    </div>
                  )}
                </>
              ) : (
                // Songs/EPs: Always show download price
                (ipRights?.download_price_stx !== null || ipRights?.price_stx) && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">Download:</span>
                    <span className="text-gray-300">{ipRights?.download_price_stx || ipRights?.price_stx} STX</span>
                  </div>
                )
              )}
              {track.open_to_commercial && (
                <div className="flex">
                  <span className="text-gray-500 w-24">Commercial:</span>
                  <span className="text-green-400">
                    ✓ {track.collab_contact_fee ? `(Contact: ${track.collab_contact_fee} STX)` : ''}
                  </span>
                </div>
              )}
              {track.open_to_collaboration && (
                <div className="flex">
                  <span className="text-gray-500 w-24">Collaboration:</span>
                  <span className="text-green-400">
                    ✓ {track.collab_contact_fee ? `(Contact: ${track.collab_contact_fee} STX)` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Basic Info */}
          <div>
            <Divider title="BASIC INFO" />
            <div className="space-y-1 text-xs">
              <div className="flex">
                <span className="text-gray-500 w-24">{isRadioStation ? 'Station:' : 'Title:'}</span>
                <span className="text-gray-300">{track.title}</span>
              </div>
              {!isRadioStation && (
                <div className="flex">
                  <span className="text-gray-500 w-24">{track.remix_depth && track.remix_depth > 0 ? 'Remixer:' : 'Artist:'}</span>
                  <span className="text-gray-300">{track.artist}</span>
                </div>
              )}
              <div className="flex">
                <span className="text-gray-500 w-24">Type:</span>
                <span className="text-gray-300">{getTrackType()}</span>
              </div>
              {isRadioStation && (
                <>
                  <div className="flex">
                    <span className="text-gray-500 w-24">Status:</span>
                    <span className="text-[#FB923C] font-bold">🔴 LIVE</span>
                  </div>
                  {track.genre && (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Genre:</span>
                      <span className="text-gray-300">{track.genre}</span>
                    </div>
                  )}
                  {track.location && (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Location:</span>
                      <span className="text-gray-300">{track.location}</span>
                    </div>
                  )}
                  {track.description && (
                    <div className="flex flex-col">
                      <span className="text-gray-500 mb-1">Description:</span>
                      <span className="text-gray-300 text-xs leading-relaxed">{track.description}</span>
                    </div>
                  )}
                </>
              )}
              {!isRadioStation && getGeneration() && (
                <div className="flex">
                  <span className="text-gray-500 w-24">Generation:</span>
                  <span className="text-gray-300">{getGeneration()}</span>
                </div>
              )}
              {/* AI Assistance Display - Only for non-radio content */}
              {!isRadioStation && (
                <div className="flex">
                  <span className="text-gray-500 w-24">Creation:</span>
                  <span className="text-gray-300">
                    {(() => {
                      const aiDisplay = getAIAssistanceDisplay(track);
                      return `${aiDisplay.emoji} ${aiDisplay.text}`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Derived From - Shows where this content came from (NOT remixes) */}
          {derivedFromTrack && (
            <div>
              <Divider title="DERIVED FROM" />
              <div className="p-2 bg-slate-800/50 rounded border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">This content was extracted from:</div>
                <Link
                  href={`/store/${track.primary_uploader_wallet}`}
                  className="text-[#81E4F2] hover:underline text-sm font-medium"
                >
                  {derivedFromTrack.title}
                </Link>
                <div className="text-gray-500 text-xs">by {derivedFromTrack.artist}</div>
              </div>
            </div>
          )}

          {/* Source Tracks - For Remixes Only */}
          {track.remix_depth && track.remix_depth > 0 && (
            <div>
              <Divider title="SOURCE TRACKS" />
              {loadingSourceTracks ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                  Loading source tracks...
                </div>
              ) : sourceTracks.length > 0 ? (
                <div className="space-y-2">
                  {sourceTracks.map((sourceTrack, index) => (
                    <div
                      key={sourceTrack.id}
                      className="flex items-center gap-2 p-2 bg-slate-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 text-xs font-medium truncate">
                          {sourceTrack.title}
                        </div>
                        <div className="text-gray-500 text-xs truncate">
                          by {sourceTrack.artist}
                        </div>
                      </div>
                      {sourceTrack.primary_uploader_wallet && (
                        <Link
                          href={`/store/${sourceTrack.primary_uploader_wallet}`}
                          className="flex-shrink-0 px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white text-xs rounded transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  No source tracks found
                </div>
              )}
            </div>
          )}

          {/* Tags (including location tags) */}
          {track.tags && track.tags.length > 0 && (
            <div>
              <Divider title="TAGS" />
              <div className="flex flex-wrap gap-1">
                {track.tags.map((tag, index) => (
                  <span 
                    key={index} 
                    className={`px-2 py-1 rounded text-xs ${
                      tag.startsWith('🌍') 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-slate-700 text-gray-300'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata - Hide BPM/Key for EPs since multiple songs have different values - Skip for radio stations */}
          {(track.bpm || track.key || track.duration) && track.content_type !== 'ep' && !isRadioStation && (
            <div>
              <Divider title="METADATA" />
              <div className="space-y-1 text-xs">
                {track.content_type !== 'ep' && track.content_type !== 'radio_station' && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">BPM:</span>
                    <span className="text-gray-300">{track.bpm || '~'}</span>
                  </div>
                )}
                {track.key && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">Key:</span>
                    <span className="text-gray-300">{track.key}</span>
                  </div>
                )}
                {track.duration && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">Duration:</span>
                    <span className="text-gray-300">{formatDuration(track.duration)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* EP-Specific Metadata - Show duration only, no BPM/Key */}
          {track.content_type === 'ep' && track.duration && (
            <div>
              <Divider title="METADATA" />
              <div className="space-y-1 text-xs">
                <div className="flex">
                  <span className="text-gray-500 w-24">Total Duration:</span>
                  <span className="text-gray-300">{formatDuration(track.duration)}</span>
                </div>
              </div>
            </div>
          )}


          {/* Description - Skip for radio stations (already shown in BASIC INFO) */}
          {track.description && !isRadioStation && (
            <div>
              <Divider title="DESCRIPTION" />
              <p className="text-xs text-gray-300 leading-relaxed">
                {track.description}
              </p>
            </div>
          )}

          {/* Notes & Credits */}
          {(track.tell_us_more || track.notes) && (
            <div>
              <Divider title="NOTES & CREDITS" />
              <p className="text-xs text-gray-300 leading-relaxed">
                {track.tell_us_more || track.notes}
              </p>
            </div>
          )}


          {/* IP Rights - Skip for radio stations */}
          {!isRadioStation && (
          <div>
            <Divider title="IP RIGHTS" />

            {/* For Remixes: Show IP splits grouped by source loop */}
            {track.remix_depth && track.remix_depth > 0 && sourceTracks.length > 0 ? (
              <>
                {/* Loop through each source track and display its contributors */}
                {sourceTracks.map((sourceLoop, loopIndex) => {
                  // Collect composition splits from this source loop
                  const compSplits = [];
                  if (sourceLoop.composition_split_1_wallet && sourceLoop.composition_split_1_percentage) {
                    compSplits.push({ wallet: sourceLoop.composition_split_1_wallet, percentage: sourceLoop.composition_split_1_percentage });
                  }
                  if (sourceLoop.composition_split_2_wallet && sourceLoop.composition_split_2_percentage) {
                    compSplits.push({ wallet: sourceLoop.composition_split_2_wallet, percentage: sourceLoop.composition_split_2_percentage });
                  }
                  if (sourceLoop.composition_split_3_wallet && sourceLoop.composition_split_3_percentage) {
                    compSplits.push({ wallet: sourceLoop.composition_split_3_wallet, percentage: sourceLoop.composition_split_3_percentage });
                  }

                  // Collect production splits from this source loop
                  const prodSplits = [];
                  if (sourceLoop.production_split_1_wallet && sourceLoop.production_split_1_percentage) {
                    prodSplits.push({ wallet: sourceLoop.production_split_1_wallet, percentage: sourceLoop.production_split_1_percentage });
                  }
                  if (sourceLoop.production_split_2_wallet && sourceLoop.production_split_2_percentage) {
                    prodSplits.push({ wallet: sourceLoop.production_split_2_wallet, percentage: sourceLoop.production_split_2_percentage });
                  }
                  if (sourceLoop.production_split_3_wallet && sourceLoop.production_split_3_percentage) {
                    prodSplits.push({ wallet: sourceLoop.production_split_3_wallet, percentage: sourceLoop.production_split_3_percentage });
                  }

                  return (
                    <div key={sourceLoop.id} className="mb-4">
                      {/* Source Loop Header */}
                      <div className="text-cyan-400 text-xs font-semibold mb-2">
                        From: {sourceLoop.title}
                      </div>

                      {/* Composition from this loop */}
                      <div className="mb-3">
                        <div className="text-gray-400 text-xs font-medium mb-1 pl-2">IDEA (Composition): contributes 50%</div>
                        <div className="space-y-1 text-xs pl-4">
                          {compSplits.length > 0 ? (
                            compSplits.map((split, index) => (
                              <div key={index} className="flex items-center">
                                <span className="text-gray-300">
                                  • Creator: {split.percentage}% → {Math.floor(split.percentage * 0.5)}% of remix
                                </span>
                                <span className="text-gray-500 ml-2 text-xs">[{formatWallet(split.wallet)}]</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-500">No composition splits</div>
                          )}
                        </div>
                      </div>

                      {/* Production from this loop */}
                      <div>
                        <div className="text-gray-400 text-xs font-medium mb-1 pl-2">IMPLEMENTATION (Recording): contributes 50%</div>
                        <div className="space-y-1 text-xs pl-4">
                          {prodSplits.length > 0 ? (
                            prodSplits.map((split, index) => (
                              <div key={index} className="flex items-center">
                                <span className="text-gray-300">
                                  • Creator: {split.percentage}% → {Math.floor(split.percentage * 0.5)}% of remix
                                </span>
                                <span className="text-gray-500 ml-2 text-xs">[{formatWallet(split.wallet)}]</span>
                              </div>
                            ))
                          ) : (
                            <div className="text-gray-500">No production splits</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Remixer Note */}
                <div className="mt-4 p-2 bg-slate-800/50 rounded border border-gray-700">
                  <div className="text-xs text-gray-400">
                    <span className="font-semibold">Note:</span> Remixer ({track.artist}) receives 20% commission on sales, separate from IP ownership.
                  </div>
                </div>
              </>
            ) : (
              /* For Non-Remixes: Show standard IP splits */
              <>
                {/* Composition Rights */}
                <div className="mb-4">
                  <div className="text-gray-400 text-xs font-semibold mb-2">IDEA (Composition):</div>
                  <div className="space-y-1 text-xs pl-4">
                    {ipRights && ipRights.composition_splits.length > 0 ? (
                      ipRights.composition_splits.map((split, index) => {
                        const { name, isPending } = getCollaboratorDisplay(split.wallet, 'composition', index + 1);
                        const showWallet = !split.wallet.startsWith('pending:') && split.wallet.length > 10;
                        return (
                          <div key={index} className="flex items-center flex-wrap">
                            <span className="text-gray-300">
                              • {name}: {split.percentage}%
                            </span>
                            {isPending && (
                              <span className="text-yellow-500 ml-2 text-xs">[wallet pending]</span>
                            )}
                            {showWallet && !isPending && (
                              <span className="text-gray-500 ml-2">[{formatWallet(split.wallet)}]</span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-gray-500">No composition splits defined</div>
                    )}
                  </div>
                </div>

                {/* Production Rights */}
                <div>
                  <div className="text-gray-400 text-xs font-semibold mb-2">IMPLEMENTATION (Recording):</div>
                  <div className="space-y-1 text-xs pl-4">
                    {ipRights && ipRights.production_splits.length > 0 ? (
                      ipRights.production_splits.map((split, index) => {
                        const { name, isPending } = getCollaboratorDisplay(split.wallet, 'production', index + 1);
                        const showWallet = !split.wallet.startsWith('pending:') && split.wallet.length > 10;
                        return (
                          <div key={index} className="flex items-center flex-wrap">
                            <span className="text-gray-300">
                              • {name}: {split.percentage}%
                            </span>
                            {isPending && (
                              <span className="text-yellow-500 ml-2 text-xs">[wallet pending]</span>
                            )}
                            {showWallet && !isPending && (
                              <span className="text-gray-500 ml-2">[{formatWallet(split.wallet)}]</span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-gray-500">No production splits defined</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}