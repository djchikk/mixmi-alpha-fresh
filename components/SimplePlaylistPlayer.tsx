"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ListMusic, Play, Pause, Volume2, VolumeX, X, GripVertical } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import type { Identifier } from 'dnd-core';
import { IPTrack } from '@/types';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import { supabase } from '@/lib/supabase';

interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  audioUrl: string;
  content_type: string;
  bpm?: number;
  stream_url?: string; // For radio stations
}

export default function SimplePlaylistPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
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
        } catch (e) {
          console.error('Error loading playlist:', e);
        }
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('simple-playlist', JSON.stringify({
        playlist,
        currentIndex
      }));
    }
  }, [playlist, currentIndex]);

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
          stream_url: t.stream_url
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
        stream_url: track.stream_url
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
      audio.play()
        .then(() => console.log('📃 Playing:', track.title))
        .catch(error => {
          console.error('📃 Playback failed:', error);
          setIsPlaying(false);
        });

      // For full songs, 20-second preview
      if (track.content_type === 'full_song') {
        const timeUpdateHandler = () => {
          if (audio.currentTime >= 20) {
            playNext();
          }
        };
        audio.addEventListener('timeupdate', timeUpdateHandler);
        return () => audio.removeEventListener('timeupdate', timeUpdateHandler);
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentIndex, playlist]);

  // Handle track end
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      playNext();
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentIndex, playlist]);

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
        stream_url: track.stream_url
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
        className="fixed bottom-[100px] left-4 z-[998] w-[200px] h-[200px] pointer-events-auto"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Playlist icon/widget pinned to bottom-left corner of drop zone */}
        <div className="absolute bottom-0 left-2">
          <div id="onborda-playlist">
            {/* Playlist Icon Button - Always Visible like cart/radio icons */}
            {!isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className={`p-1.5 hover:bg-[#1E293B] rounded transition-all ${isOverAny && canDropAny ? 'animate-wiggle' : ''} ${isPlaying && playlist.length > 0 ? 'playlist-playing-pulse' : ''}`}
                style={isOverAny && canDropAny ? {
                  filter: 'drop-shadow(0 0 8px #D4AF37) drop-shadow(0 0 16px #9772F4)',
                } : {}}
                title={playlist.length > 0 ? (isPlaying ? `Playing: ${currentTrack?.title || 'Track'}` : `Playlist (${playlist.length} tracks)`) : "Open Playlist"}
              >
                <ListMusic
                  className={`w-6 h-6 transition-colors ${
                    isOverAny && canDropAny
                      ? 'text-[#D4AF37]'
                      : isPlaying && playlist.length > 0
                        ? 'text-[#D4AF37]'
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
          <div className="flex items-center gap-2 mb-3">
            <ListMusic className="w-4 h-4 text-gray-300" />
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
              Playlist
            </span>
          </div>

          {/* Playlist Items - Scrollable */}
          <div className="playlist-tracks mb-3">
            {playlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-gray-400 text-xs px-4 py-6">
                <ListMusic className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-center text-xs text-gray-400 mb-1">Drag tracks here</p>
                <p className="text-center text-[10px] text-gray-500">
                  Loops play in full • Songs preview for 20s
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
                  <div className="text-sm font-semibold text-white truncate">
                    {currentTrack.title}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {currentTrack.artist}
                  </div>
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
