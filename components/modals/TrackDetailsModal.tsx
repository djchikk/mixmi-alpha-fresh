"use client";

import React, { useEffect, useState } from 'react';
import { IPTrack } from '@/types';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useDrag } from 'react-dnd';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';

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

  // Audio playback state for individual loops
  const [playingLoopId, setPlayingLoopId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);

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
          production_split_1_percentage, production_split_1_wallet,
          production_split_2_percentage, production_split_2_wallet,
          production_split_3_percentage, production_split_3_wallet,
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

  // Fetch individual loops if this is a loop pack OR individual songs if this is an EP
  useEffect(() => {
    if (isOpen && (track.content_type === 'loop_pack' || track.content_type === 'ep') && track.id) {
      setLoadingLoops(true);

      // For loop packs and EPs, use the track's own ID to find individual items
      const packId = track.pack_id || track.id.split('-loc-')[0]; // Remove location suffix if present

      // Determine what content type to fetch
      const contentType = track.content_type === 'loop_pack' ? 'loop' : 'full_song';

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
    if (isOpen && track.remix_depth && track.remix_depth > 0 && track.source_track_ids && track.source_track_ids.length > 0) {
      setLoadingSourceTracks(true);

      supabase
        .from('ip_tracks')
        .select('id, title, artist, primary_uploader_wallet')
        .in('id', track.source_track_ids)
        .then(({ data, error }) => {
          if (error) {
            console.error('❌ Error fetching source tracks:', error);
          } else {
            setSourceTracks(data || []);
          }
          setLoadingSourceTracks(false);
        });
    } else {
      setSourceTracks([]);
    }
  }, [isOpen, track.remix_depth, track.source_track_ids]);

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

  // Audio playback functions for individual loops
  const handleLoopPlayPause = async (loop: IPTrack) => {
    if (!loop.audio_url) return;
    
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
      const audio = new Audio(loop.audio_url);
      audio.crossOrigin = 'anonymous';
      
      await audio.play();
      setCurrentAudio(audio);
      setPlayingLoopId(loop.id);
      
      // 20-second preview timeout
      const timeoutId = setTimeout(() => {
        audio.pause();
        setPlayingLoopId(null);
        setCurrentAudio(null);
      }, 20000);
      setPreviewTimeout(timeoutId);
      
      // Handle audio end
      audio.addEventListener('ended', () => {
        setPlayingLoopId(null);
        setCurrentAudio(null);
        if (previewTimeout) {
          clearTimeout(previewTimeout);
        }
      });
      
    } catch (error) {
      console.error('Loop playback failed:', error);
    }
  };

  // Cleanup audio when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
      setPlayingLoopId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Format helpers
  const getTrackType = () => {
    if (track.content_type === 'full_song') return 'Song';
    if (track.content_type === 'ep') return 'EP';
    if (track.content_type === 'loop') return '8-Bar Loop';
    if (track.content_type === 'loop_pack') return 'Loop Pack';
    return 'Track';
  };

  const getGeneration = () => {
    if (track.content_type !== 'loop') return null;
    if (track.remix_depth === 0) return '🌱 Original Seed';
    if (track.remix_depth && track.remix_depth > 0) return `Generation ${track.remix_depth}`;
    return null;
  };

  const getLicense = () => {
    if (track.content_type === 'loop') {
      // Loops have two options
      if (track.license_selection === 'platform_remix') return 'Remix Only';
      if (track.license_selection === 'platform_download') return 'Remix + Download';
      return 'Remix Only'; // Default for loops
    } else {
      // Songs and EPs are download only (no remixing allowed)
      return 'Download Only';
    }
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
                        {loop.bpm && (
                          <div className="text-gray-500 text-xs">
                            {loop.bpm} BPM
                          </div>
                        )}
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
                    <div 
                      key={song.id}
                      className="flex items-center gap-3 p-2 bg-slate-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors"
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
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  No individual songs found for this EP
                </div>
              )}
            </div>
          )}

          {/* Price and License - moved here for better flow */}
          <div>
            <Divider title="PRICE AND LICENSE" />
            <div className="space-y-1 text-xs">
              <div className="flex">
                <span className="text-gray-500 w-24">License:</span>
                <span className="text-gray-300">
                  {track.content_type === 'full_song' || track.content_type === 'ep'
                    ? 'Download Only'
                    : track.content_type === 'loop'
                      ? ipRights?.allow_downloads
                        ? 'Platform Remix + Download'
                        : 'Platform Remix Only'
                      : ipRights?.license_selection === 'platform_download'
                        ? 'Download Only'
                        : 'Platform Remix Only'}
                </span>
              </div>
              {track.content_type === 'loop_pack' ? (
                <>
                  <div className="flex">
                    <span className="text-gray-500 w-24">Pack Price:</span>
                    <span className="text-gray-300">{ipRights?.download_price_stx || ipRights?.price_stx || track.price_stx} STX</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-500 w-24">Per Loop:</span>
                    <span className="text-gray-300">{ipRights?.remix_price_stx || ipRights?.remix_price || '1.0'} STX each remix</span>
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
          
          {/* Basic Info */}
          <div>
            <Divider title="BASIC INFO" />
            <div className="space-y-1 text-xs">
              <div className="flex">
                <span className="text-gray-500 w-24">Title:</span>
                <span className="text-gray-300">{track.title}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-24">{track.remix_depth && track.remix_depth > 0 ? 'Remixer:' : 'Artist:'}</span>
                <span className="text-gray-300">{track.artist}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-24">Type:</span>
                <span className="text-gray-300">{getTrackType()}</span>
              </div>
              {getGeneration() && (
                <div className="flex">
                  <span className="text-gray-500 w-24">Generation:</span>
                  <span className="text-gray-300">{getGeneration()}</span>
                </div>
              )}
            </div>
          </div>

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

          {/* Metadata - Hide BPM/Key for EPs since multiple songs have different values */}
          {(track.bpm || track.key || track.duration) && track.content_type !== 'ep' && (
            <div>
              <Divider title="METADATA" />
              <div className="space-y-1 text-xs">
                {track.bpm && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">BPM:</span>
                    <span className="text-gray-300">{track.bpm}</span>
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


          {/* Description */}
          {track.description && (
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


          {/* IP Rights */}
          <div>
            <Divider title="IP RIGHTS" />

            {/* Composition Rights */}
            <div className="mb-4">
              <div className="text-gray-400 text-xs font-semibold mb-2">IDEA (Composition):</div>
              <div className="space-y-1 text-xs pl-4">
                {ipRights && ipRights.composition_splits.length > 0 ? (
                  ipRights.composition_splits.map((split, index) => (
                    <div key={index} className="flex items-center">
                      <span className="text-gray-300">
                        • {index === 0 && track.remix_depth && track.remix_depth > 0 ? 'Remixer' : 'Creator'}: {split.percentage}%
                      </span>
                      <span className="text-gray-500 ml-2">[{formatWallet(split.wallet)}]</span>
                    </div>
                  ))
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
                  ipRights.production_splits.map((split, index) => (
                    <div key={index} className="flex items-center">
                      <span className="text-gray-300">
                        • {index === 0 && track.remix_depth && track.remix_depth > 0 ? 'Remixer' : 'Creator'}: {split.percentage}%
                      </span>
                      <span className="text-gray-500 ml-2">[{formatWallet(split.wallet)}]</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500">No production splits defined</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}