"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ListMusic, Play, Pause, Volume2, VolumeX, X, GripVertical, Clock, Ticket } from 'lucide-react';
import { useDrag, useDrop, useDragLayer } from 'react-dnd';
import type { Identifier } from 'dnd-core';
import { IPTrack } from '@/types';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  checkDayPassStatus,
  logPlay,
  formatTimeRemaining,
  DayPassStatus,
  DAY_PASS_PRICE_USDC,
  DAY_PASS_DURATION_HOURS,
} from '@/lib/dayPass';
import DayPassPurchaseModal from '@/components/playlist/DayPassPurchaseModal';

interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  audioUrl: string;
  content_type: string;
  bpm?: number;
  stream_url?: string; // For radio stations
  uploaderAddress?: string; // For profile/store links
  primary_uploader_wallet?: string; // Alternative wallet field
}

export default function SimplePlaylistPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  // Day Pass state
  const [dayPassStatus, setDayPassStatus] = useState<DayPassStatus>({ hasActivePass: false });
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [totalPlays, setTotalPlays] = useState<number>(0);
  const [showDayPassModal, setShowDayPassModal] = useState(false);

  // Auth context for user address
  const { suiAddress, walletAddress } = useAuth();
  const userAddress = suiAddress || walletAddress;

  // Global drag state - only enable drop zone when dragging
  const { isDraggingGlobal } = useDragLayer((monitor) => ({
    isDraggingGlobal: monitor.isDragging(),
  }));

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playStartTimeRef = useRef<number>(0); // Track when current song started

  // Initialize audio element and restore state
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    // Load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('simple-playlist');
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setPlaylist(data.playlist || []);
          setCurrentIndex(data.currentIndex ?? -1);
          if (data.savedVolume !== undefined) setVolume(data.savedVolume);
          if (data.savedMuted !== undefined) setIsMuted(data.savedMuted);
          if (data.savedExpanded !== undefined) setIsExpanded(data.savedExpanded);

          // Set up audio volume
          if (audioRef.current) {
            audioRef.current.volume = data.savedMuted ? 0 : (data.savedVolume ?? 0.7);
          }

          // Auto-resume playback if it was playing
          if (data.wasPlaying && data.currentIndex >= 0 && data.playlist?.[data.currentIndex]) {
            const track = data.playlist[data.currentIndex];
            if (audioRef.current && track.audioUrl) {
              audioRef.current.src = track.audioUrl;
              audioRef.current.play()
                .then(() => {
                  setIsPlaying(true);
                  console.log('📃 Playlist: Restored and playing:', track.title);
                })
                .catch(error => {
                  console.error('📃 Playlist: Auto-play blocked:', error);
                  setIsPlaying(false);
                });
            }
          }
        } catch (e) {
          console.error('Error loading playlist:', e);
        }
      }
      setHasRestoredState(true);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Check day pass status on mount and when user changes
  useEffect(() => {
    if (!userAddress) {
      setDayPassStatus({ hasActivePass: false });
      return;
    }

    const checkStatus = async () => {
      const status = await checkDayPassStatus(userAddress);
      setDayPassStatus(status);
      if (status.hasActivePass && status.remainingSeconds) {
        setRemainingTime(status.remainingSeconds);
        setTotalPlays(status.totalPlays || 0);
      }
    };

    checkStatus();
    // Re-check every minute
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, [userAddress]);

  // Countdown timer for active day pass
  useEffect(() => {
    if (!dayPassStatus.hasActivePass || remainingTime <= 0) return;

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          // Pass expired
          setDayPassStatus({ hasActivePass: false });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [dayPassStatus.hasActivePass, remainingTime]);

  // Log play when track completes (for day pass revenue sharing)
  const logTrackPlay = useCallback(async (track: PlaylistTrack, durationSeconds: number) => {
    if (!dayPassStatus.hasActivePass || !dayPassStatus.dayPassId) return;

    const success = await logPlay(
      dayPassStatus.dayPassId,
      track.id,
      track.content_type,
      durationSeconds
    );

    if (success) {
      setTotalPlays(prev => prev + 1);
      console.log(`🎵 [DayPass] Logged play: ${track.title}`);
    }
  }, [dayPassStatus.hasActivePass, dayPassStatus.dayPassId]);

  // Save to localStorage (includes playback state)
  useEffect(() => {
    if (typeof window !== 'undefined' && hasRestoredState) {
      localStorage.setItem('simple-playlist', JSON.stringify({
        playlist,
        currentIndex,
        wasPlaying: isPlaying,
        savedVolume: volume,
        savedMuted: isMuted,
        savedExpanded: isExpanded
      }));
    }
  }, [playlist, currentIndex, isPlaying, volume, isMuted, isExpanded, hasRestoredState]);

  // Helper to fetch pack tracks
  const fetchPackTracks = async (packTrack: any): Promise<IPTrack[]> => {
    const packId = packTrack.pack_id || packTrack.id.split('-loc-')[0];
    const contentTypeToFetch = packTrack.content_type === 'loop_pack' ? 'loop' : 'full_song';

    const { data, error } = await supabase
      .from('ip_tracks')
      .select('*')
      .eq('pack_id', packId)
      .eq('content_type', contentTypeToFetch)
      .order('pack_position', { ascending: true });

    if (error) {
      console.error('📃 Playlist: Error fetching pack tracks:', error);
      return [];
    }

    return (data as IPTrack[]) || [];
  };

  // Large invisible drop zone for playlist - similar to cart/radio drop zone pattern
  const [{ isOverPlaylist, canDropPlaylist }, playlistDropRef] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD', 'GLOBE_CARD', 'RADIO_TRACK'],
    drop: async (item: { track: any }) => {
      console.log('📃 Playlist drop zone received:', item);
      handlePlaylistDrop(item.track);
    },
    collect: (monitor) => ({
      isOverPlaylist: monitor.isOver(),
      canDropPlaylist: monitor.canDrop(),
    }),
  }), []);

  // Helper function to handle playlist drops (extracted for reuse)
  const handlePlaylistDrop = async (track: any) => {
    const contentType = track.content_type;

    // Handle packs - unpack them
    if (contentType === 'loop_pack' || contentType === 'ep') {
      console.log('📦 Unpacking', contentType, 'into playlist');
      const packTracks = await fetchPackTracks(track);

      if (packTracks.length > 0) {
        const newTracks: PlaylistTrack[] = packTracks.map(t => ({
          id: t.id,
          title: t.title,
          artist: t.artist || t.artist_name || 'Unknown',
          imageUrl: t.cover_image_url || '',
          audioUrl: t.audio_url || t.stream_url,
          content_type: t.content_type,
          bpm: t.bpm,
          stream_url: t.stream_url,
          uploaderAddress: t.uploader_address,
          primary_uploader_wallet: t.primary_uploader_wallet
        }));

        setPlaylist(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const uniqueNewTracks = newTracks.filter(t => !existingIds.has(t.id));
          return [...uniqueNewTracks, ...prev];
        });

        setIsExpanded(true);
      }
    } else {
      // Single track (including radio stations)
      const newTrack: PlaylistTrack = {
        id: track.id,
        title: track.title,
        artist: track.artist || track.artist_name || 'Unknown',
        imageUrl: track.cover_image_url || track.imageUrl || '',
        audioUrl: track.audio_url || track.audioUrl || track.stream_url,
        content_type: track.content_type,
        bpm: track.bpm,
        stream_url: track.stream_url,
        uploaderAddress: track.uploaderAddress || track.uploader_address,
        primary_uploader_wallet: track.primary_uploader_wallet
      };

      setPlaylist(prev => {
        if (prev.some(t => t.id === newTrack.id)) return prev;
        return [newTrack, ...prev];
      });

      setIsExpanded(true);
    }
  };

  // Drop functionality for tracks (on expanded player)
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD', 'GLOBE_CARD', 'RADIO_TRACK'],
    drop: async (item: { track: any }) => {
      console.log('📃 Playlist expanded player received drop:', item);
      handlePlaylistDrop(item.track);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  // Combine isOver states for visual feedback
  const isOverAny = isOverPlaylist || isOver;
  const canDropAny = canDropPlaylist || canDrop;

  // Handle playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying && currentIndex >= 0 && playlist[currentIndex]) {
      const track = playlist[currentIndex];
      audio.src = track.audioUrl;
      playStartTimeRef.current = Date.now(); // Track when playback started

      audio.play()
        .then(() => {
          const hasPass = dayPassStatus.hasActivePass;
          console.log(`📃 Playing: ${track.title}${hasPass ? ' (Day Pass active - full song)' : ''}`);
        })
        .catch(error => {
          console.error('📃 Playback failed:', error);
          setIsPlaying(false);
        });

      // For full songs: 20-second preview UNLESS day pass is active
      if (track.content_type === 'full_song' && !dayPassStatus.hasActivePass) {
        const timeUpdateHandler = () => {
          if (audio.currentTime >= 20) {
            // Log the 20-second preview play (even without day pass, for analytics)
            playNext();
          }
        };
        audio.addEventListener('timeupdate', timeUpdateHandler);
        return () => audio.removeEventListener('timeupdate', timeUpdateHandler);
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentIndex, playlist, dayPassStatus.hasActivePass]);

  // Handle track end - log play for day pass and advance
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = async () => {
      console.log('🎵 [Playlist] Track ended, checking day pass status:', {
        hasActivePass: dayPassStatus.hasActivePass,
        dayPassId: dayPassStatus.dayPassId,
        currentIndex,
        trackTitle: playlist[currentIndex]?.title
      });

      // Log the play if day pass is active
      if (dayPassStatus.hasActivePass && dayPassStatus.dayPassId && currentIndex >= 0 && playlist[currentIndex]) {
        const track = playlist[currentIndex];
        const durationSeconds = Math.floor((Date.now() - playStartTimeRef.current) / 1000);
        console.log('🎵 [Playlist] Logging play for:', track.title, 'duration:', durationSeconds);
        await logTrackPlay(track, durationSeconds);
      } else {
        console.log('🎵 [Playlist] Not logging play - day pass not active or missing dayPassId');
      }
      playNext();
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentIndex, playlist, dayPassStatus.hasActivePass, dayPassStatus.dayPassId, logTrackPlay]);

  const playNext = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setCurrentIndex(-1);
    }
  };

  const togglePlayPause = () => {
    if (playlist.length === 0) return;

    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (currentIndex === -1) {
        setCurrentIndex(0);
      }
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume > 0) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.volume = volume;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const removeTrack = (index: number) => {
    setPlaylist(prev => prev.filter((_, i) => i !== index));
    if (index === currentIndex) {
      setIsPlaying(false);
      setCurrentIndex(-1);
    } else if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const moveTrack = (fromIndex: number, toIndex: number) => {
    const newPlaylist = [...playlist];
    const [moved] = newPlaylist.splice(fromIndex, 1);
    newPlaylist.splice(toIndex, 0, moved);
    setPlaylist(newPlaylist);

    // Adjust current index if needed
    if (currentIndex === fromIndex) {
      setCurrentIndex(toIndex);
    } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
      setCurrentIndex(prev => prev - 1);
    } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const clearPlaylist = () => {
    setPlaylist([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  // Update volume when volume state changes
  useEffect(() => {
    if (audioRef.current && !isMuted) {
      audioRef.current.volume = volume;
    }
  }, [volume, isMuted]);

  // Expose API for other components (e.g., mixer) to add tracks programmatically
  useEffect(() => {
    (window as any).addTrackToPlaylist = (track: any) => {
      const newTrack: PlaylistTrack = {
        id: track.id,
        title: track.title,
        artist: track.artist || track.artist_name || 'Unknown',
        imageUrl: track.cover_image_url || track.imageUrl || '',
        audioUrl: track.audio_url || track.audioUrl || track.stream_url,
        content_type: track.content_type,
        bpm: track.bpm,
        stream_url: track.stream_url,
        uploaderAddress: track.uploaderAddress || track.uploader_address,
        primary_uploader_wallet: track.primary_uploader_wallet
      };

      setPlaylist(prev => {
        if (prev.some(t => t.id === newTrack.id)) return prev;
        return [newTrack, ...prev];
      });

      setIsExpanded(true);
    };

    return () => {
      delete (window as any).addTrackToPlaylist;
    };
  }, []);

  const currentTrack = playlist[currentIndex];

  return (
    <>
      {/* Large invisible drop zone for playlist - extends right and up from playlist position */}
      <div
        ref={playlistDropRef}
        className="fixed bottom-[100px] left-4 z-[998] w-[200px] h-[200px] playlist-widget"
        style={{ pointerEvents: isDraggingGlobal ? 'auto' : 'none' }}
      >
        {/* Playlist icon/widget pinned to bottom-left corner of drop zone */}
        <div className="absolute bottom-0 left-2" style={{ pointerEvents: 'auto' }}>
          <div id="onborda-playlist">
            {/* Playlist Icon Button - Always Visible like cart/radio icons */}
            {!isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className={`p-1.5 hover:bg-[#1E293B] rounded transition-all ${isOverAny && canDropAny ? 'animate-wiggle' : ''} ${isPlaying && playlist.length > 0 ? 'playlist-playing-pulse' : ''}`}
                style={isOverAny && canDropAny ? {
                  filter: 'drop-shadow(0 0 8px #A8E66B) drop-shadow(0 0 16px #A084F9)',
                } : {}}
                title={playlist.length > 0 ? (isPlaying ? `Playing: ${currentTrack?.title || 'Track'}` : `Playlist (${playlist.length} tracks)`) : "Open Playlist"}
              >
                <ListMusic
                  className={`w-6 h-6 transition-colors ${
                    isOverAny && canDropAny
                      ? 'text-[#A8E66B]'
                      : isPlaying && playlist.length > 0
                        ? 'text-[#A8E66B]'
                        : 'text-gray-200'
                  }`}
                  strokeWidth={2.5}
                />
              </button>
            )}

      {/* Expanded Playlist Player */}
      {isExpanded && (
        <div
          ref={drop as any}
          className={`relative playlist-player-container ${isOverAny && canDropAny ? 'drop-active animate-wiggle' : ''}`}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute top-2 right-2 p-1 hover:bg-gray-800 rounded transition-colors z-10"
            title="Close"
          >
            <X className="w-4 h-4 text-gray-400 hover:text-white" />
          </button>

          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-gray-300" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Playlist
              </span>
            </div>

            {/* Day Pass Status / Button */}
            {dayPassStatus.hasActivePass ? (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-[#A8E66B]/20 rounded-full">
                <Clock className="w-3 h-3 text-[#A8E66B]" />
                <span className="text-[10px] font-medium text-[#A8E66B]">
                  {formatTimeRemaining(remainingTime)}
                </span>
                <span className="text-[10px] text-gray-400">
                  • {totalPlays} plays
                </span>
              </div>
            ) : userAddress ? (
              <button
                onClick={() => setShowDayPassModal(true)}
                className="flex items-center gap-1 px-2 py-1 bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30 rounded-full transition-colors"
                title="Get unlimited full-song streaming for 24 hours"
              >
                <Ticket className="w-3 h-3 text-[#81E4F2]" />
                <span className="text-[10px] font-medium text-[#81E4F2]">
                  Day Pass ${DAY_PASS_PRICE_USDC}
                </span>
              </button>
            ) : null}
          </div>

          {/* Playlist Items - Scrollable */}
          <div className="playlist-tracks mb-3">
            {playlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-gray-400 text-xs px-4 py-6">
                <ListMusic className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-center text-xs text-gray-400 mb-1">Drag tracks here</p>
                <p className="text-center text-[10px] text-gray-500">
                  {dayPassStatus.hasActivePass
                    ? 'Day Pass active • Full songs unlocked!'
                    : 'Loops play in full • Songs preview for 20s'}
                </p>
              </div>
            ) : (
              playlist.map((track, index) => (
                <PlaylistTrackItem
                  key={`${track.id}-${index}`}
                  track={track}
                  index={index}
                  isPlaying={isPlaying && index === currentIndex}
                  onPlay={() => {
                    setCurrentIndex(index);
                    setIsPlaying(true);
                  }}
                  onRemove={() => removeTrack(index)}
                  moveTrack={moveTrack}
                />
              ))
            )}
          </div>

          {/* Now Playing Info (only if track loaded) */}
          {currentTrack && (
            <>
              <div className="flex gap-3 mb-3 pb-3 border-b border-gray-800">
                {/* Current track artwork */}
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                  <img
                    src={getOptimizedTrackImage({ cover_image_url: currentTrack.imageUrl } as any, 48)}
                    alt={currentTrack.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Current track info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  {(currentTrack.uploaderAddress || currentTrack.primary_uploader_wallet) ? (
                    <>
                      <Link
                        href={`/store/${currentTrack.uploaderAddress || currentTrack.primary_uploader_wallet}`}
                        className="text-sm font-semibold text-white truncate hover:text-[#81E4F2] transition-colors"
                      >
                        {currentTrack.title}
                      </Link>
                      <Link
                        href={`/profile/${currentTrack.uploaderAddress || currentTrack.primary_uploader_wallet}`}
                        className="text-xs text-gray-400 truncate hover:text-[#81E4F2] transition-colors"
                      >
                        {currentTrack.artist}
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-white truncate">
                        {currentTrack.title}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {currentTrack.artist}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              disabled={playlist.length === 0}
              className="text-gray-300 hover:text-white transition-colors disabled:opacity-50"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5" fill="currentColor" />
              )}
            </button>

            {/* Skip */}
            <button
              onClick={playNext}
              disabled={playlist.length === 0 || currentIndex >= playlist.length - 1}
              className="text-gray-400 hover:text-white transition-colors disabled:opacity-30"
              title="Skip"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
              </svg>
            </button>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="text-gray-400 hover:text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              style={{
                accentColor: '#D1D5DB'
              }}
            />
          </div>

          {/* Now playing indicator */}
          {isPlaying && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
              <div className="w-2 h-2 rounded-full bg-[#81E4F2] animate-pulse" />
              <span className="text-xs text-gray-400 uppercase tracking-wider">
                Playing
              </span>
            </div>
          )}
        </div>
      )}
          </div>
        </div>
      </div>

      {/* Playlist Player Styles */}
      <style jsx>{`
        .playlist-player-container {
          position: relative;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(8px);
          border-radius: 0.75rem;
          width: 280px;
          max-height: 500px;
          padding: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(51, 65, 85, 0.5);
          display: flex;
          flex-direction: column;
        }

        /* Drop active state - gold/purple highlight for playlist */
        .playlist-player-container.drop-active {
          border-color: rgba(212, 175, 55, 0.6);
          box-shadow: 0 0 20px rgba(212, 175, 55, 0.3), 0 0 30px rgba(151, 114, 244, 0.2);
        }

        /* Scrollable tracks area */
        .playlist-tracks {
          overflow-y: auto;
          max-height: 240px;
          min-height: 60px;
        }

        /* Custom scrollbar */
        .playlist-tracks::-webkit-scrollbar {
          width: 4px;
        }

        .playlist-tracks::-webkit-scrollbar-track {
          background: rgba(51, 65, 85, 0.3);
          border-radius: 2px;
        }

        .playlist-tracks::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 2px;
        }

        .playlist-tracks::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }

        /* Subtle pulse animation for playlist icon when playing */
        .playlist-playing-pulse {
          animation: playlist-glow-pulse 2s ease-in-out infinite;
        }

        @keyframes playlist-glow-pulse {
          0%, 100% {
            filter: drop-shadow(0 0 2px rgba(212, 175, 55, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.6)) drop-shadow(0 0 10px rgba(151, 114, 244, 0.3));
          }
        }
      `}</style>

      {/* Day Pass Purchase Modal */}
      <DayPassPurchaseModal
        isOpen={showDayPassModal}
        onClose={() => setShowDayPassModal(false)}
        onSuccess={(dayPassId, expiresAt) => {
          // Update local state with new day pass
          setDayPassStatus({
            hasActivePass: true,
            dayPassId,
            expiresAt,
            remainingSeconds: DAY_PASS_DURATION_HOURS * 60 * 60,
          });
          setRemainingTime(DAY_PASS_DURATION_HOURS * 60 * 60);
          setTotalPlays(0);
          console.log('🎫 Day pass activated:', dayPassId);
        }}
      />
    </>
  );
}

// Draggable/Droppable playlist item component
interface PlaylistTrackItemProps {
  track: PlaylistTrack;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onRemove: () => void;
  moveTrack: (fromIndex: number, toIndex: number) => void;
}

const PlaylistTrackItem: React.FC<PlaylistTrackItemProps> = ({
  track,
  index,
  isPlaying,
  onPlay,
  onRemove,
  moveTrack
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Drag for both reordering within playlist AND dragging to external targets (Crate, Mixer, etc)
  const [{ isDragging }, drag] = useDrag({
    type: 'COLLECTION_TRACK',
    item: () => ({
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        imageUrl: track.imageUrl,
        cover_image_url: track.imageUrl,
        audioUrl: track.audioUrl,
        audio_url: track.audioUrl,
        content_type: track.content_type,
        bpm: track.bpm,
        stream_url: track.stream_url
      },
      sourceIndex: index,
      fromPlaylist: true // Flag to identify playlist items for reordering
    }),
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  });

  // Drop zone for reordering within playlist
  const [{ handlerId }, drop] = useDrop<
    { track?: any; sourceIndex?: number; fromPlaylist?: boolean },
    void,
    { handlerId: Identifier | null }
  >({
    accept: 'COLLECTION_TRACK',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: { track?: any; sourceIndex?: number; fromPlaylist?: boolean }) {
      if (!ref.current) {
        return;
      }

      // Only reorder if it's from the same playlist and has a valid index
      if (item.fromPlaylist && item.sourceIndex !== undefined && item.sourceIndex !== index) {
        moveTrack(item.sourceIndex, index);
        item.sourceIndex = index;
      }
    },
  });

  drag(drop(ref));

  return (
    <div
      ref={ref}
      data-handler-id={handlerId}
      className={`flex items-center gap-2 p-1.5 rounded mb-1 hover:bg-slate-800/50 transition-colors cursor-move ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{
        backgroundColor: isPlaying ? 'rgba(129, 228, 242, 0.1)' : 'rgba(30, 41, 59, 0.3)',
        border: isPlaying ? '1px solid #81E4F2' : '1px solid transparent'
      }}
    >
      {/* Reorder handle */}
      <div className="cursor-move">
        <GripVertical className="w-3 h-3 text-gray-600" />
      </div>

      {/* Album art */}
      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
        <img
          src={getOptimizedTrackImage({ cover_image_url: track.imageUrl } as any, 32)}
          alt={track.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Track info - clickable to play */}
      <button
        onClick={onPlay}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-xs text-white truncate">{track.title}</div>
        <div className="text-[10px] text-gray-500 truncate">{track.artist}</div>
      </button>

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
        title="Remove"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
