"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ListMusic, ChevronDown, ChevronUp, X, GripVertical } from 'lucide-react';
import Image from 'next/image';
import AudioWidgetControls from './AudioWidgetControls';
import { supabase } from '@/lib/supabase';
import { IPTrack } from '@/types';

interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  imageUrl: string;
  audioUrl: string;
  bpm?: number;
  content_type: 'loop' | 'full_song';
  price_stx?: number;
  primary_uploader_wallet?: string;
}

interface PlaylistWidgetProps {
  className?: string;
}

const PlaylistWidget: React.FC<PlaylistWidgetProps> = ({ className = '' }) => {
  const [playlist, setPlaylist] = useState<PlaylistTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [audioLevel, setAudioLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load playlist from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('playlist-widget');
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
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('playlist-widget', JSON.stringify({
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
      console.error('Error fetching pack tracks:', error);
      return [];
    }

    return (data as IPTrack[]) || [];
  };

  // Accept drops from various sources
  const [{ isOver }, drop] = useDrop({
    accept: ['TRACK_CARD', 'COLLECTION_TRACK', 'TRACK', 'GLOBE_CARD', 'CRATE_TRACK', 'RADIO_TRACK'],
    drop: async (item: any) => {
      console.log('🎵 Playlist: Received drop:', item);

      const contentType = item.content_type || item.track?.content_type || 'loop';

      // Check if this is a pack (loop_pack or ep)
      if (contentType === 'loop_pack' || contentType === 'ep') {
        console.log('🎵 Playlist: Unpacking', contentType, '...');

        // Fetch all tracks in the pack
        const packTracks = await fetchPackTracks(item.track || item);

        if (packTracks.length > 0) {
          console.log(`🎵 Playlist: Adding ${packTracks.length} tracks from pack`);

          // Convert all pack tracks to PlaylistTrack format
          const newTracks: PlaylistTrack[] = packTracks.map(track => ({
            id: track.id,
            title: track.title,
            artist: track.artist || track.artist_name || 'Unknown Artist',
            imageUrl: track.cover_image_url || '',
            audioUrl: track.audio_url,
            bpm: track.bpm,
            content_type: track.content_type as 'loop' | 'full_song',
            price_stx: track.price_stx,
            primary_uploader_wallet: track.primary_uploader_wallet
          }));

          // Add all tracks to playlist
          setPlaylist(prev => {
            // Filter out duplicates
            const existingIds = new Set(prev.map(t => t.id));
            const uniqueNewTracks = newTracks.filter(t => !existingIds.has(t.id));
            return [...uniqueNewTracks, ...prev];
          });
        }
      } else {
        // Single track (loop or full_song)
        const track: PlaylistTrack = {
          id: item.id || item.track?.id,
          title: item.title || item.track?.title,
          artist: item.artist || item.artist_name || item.track?.artist || 'Unknown Artist',
          imageUrl: item.imageUrl || item.cover_image_url || item.track?.imageUrl || '',
          audioUrl: item.audioUrl || item.audio_url || item.track?.audioUrl,
          bpm: item.bpm || item.track?.bpm,
          content_type: contentType as 'loop' | 'full_song',
          price_stx: item.price_stx || item.track?.price_stx,
          primary_uploader_wallet: item.primary_uploader_wallet || item.track?.primary_uploader_wallet
        };

        // Add to top of playlist
        setPlaylist(prev => {
          // Avoid duplicates
          if (prev.some(t => t.id === track.id)) return prev;
          return [track, ...prev];
        });
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver()
    })
  });

  // Audio coordination - pause when other sources play
  useEffect(() => {
    const handleOtherAudioPlaying = (e: CustomEvent) => {
      if (e.detail.source !== 'playlist' && isPlaying) {
        console.log('🎵 Playlist: Pausing because', e.detail.source, 'is playing');
        setIsPlaying(false);
        audioRef.current?.pause();
      }
    };

    window.addEventListener('audioSourcePlaying' as any, handleOtherAudioPlaying);
    return () => window.removeEventListener('audioSourcePlaying' as any, handleOtherAudioPlaying);
  }, [isPlaying]);

  // Playback logic
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    if (isPlaying && currentIndex >= 0 && playlist[currentIndex]) {
      const track = playlist[currentIndex];

      // Notify other audio sources to pause
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('audioSourcePlaying', { detail: { source: 'playlist' } }));
      }

      audio.src = track.audioUrl;
      audio.play().catch(err => {
        console.error('Playlist playback error:', err);
        setIsPlaying(false);
      });

      // For full songs, set 20-second limit
      if (track.content_type === 'full_song') {
        const timeUpdateHandler = () => {
          if (audio.currentTime >= 20) {
            console.log('🎵 Playlist: 20-second preview complete, moving to next');
            playNext();
          }
        };
        audio.addEventListener('timeupdate', timeUpdateHandler);
        return () => audio.removeEventListener('timeupdate', timeUpdateHandler);
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentIndex, playlist, volume]);

  // Handle track end
  const handleTrackEnd = () => {
    console.log('🎵 Playlist: Track ended, playing next');
    playNext();
  };

  const playNext = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // End of playlist
      setIsPlaying(false);
      setCurrentIndex(-1);
    }
  };

  const togglePlay = () => {
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

  const removeTrack = (index: number) => {
    setPlaylist(prev => prev.filter((_, i) => i !== index));
    if (index === currentIndex) {
      setIsPlaying(false);
      setCurrentIndex(-1);
    } else if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Simulated VU meter
  useEffect(() => {
    const updateAudioLevel = () => {
      if (!isPlaying) {
        setAudioLevel(0);
        return;
      }
      setAudioLevel(0.3 + Math.random() * 0.4);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  const currentTrack = playlist[currentIndex];

  return (
    <div
      ref={drop}
      className={`playlist-widget relative ${className}`}
      style={{
        width: isCollapsed ? '240px' : '320px'
      }}
    >
      <div
        className={`relative bg-slate-900/30 backdrop-blur-sm rounded-xl shadow-2xl border transition-all duration-300 overflow-hidden ${
          isOver ? 'border-[#81E4F2] shadow-[#81E4F2]/50' : 'border-slate-700/50'
        } ${isCollapsed ? 'h-10' : 'h-[200px]'}`}
      >
        <audio
          ref={audioRef}
          onEnded={handleTrackEnd}
        />

        {/* Collapse/Expand Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute ${isCollapsed ? 'top-1' : 'top-2'} right-2 p-1 rounded hover:bg-white/10 transition-all duration-200 z-20`}
          title={isCollapsed ? "Expand Playlist" : "Collapse Playlist"}
        >
          {isCollapsed ? (
            <ChevronUp className="w-4 h-4 text-white/70" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/70" />
          )}
        </button>

        {/* Collapsed State - Mini View */}
        {isCollapsed && (
          <div className="h-full flex items-center justify-between px-3">
            <div className="flex items-center gap-2">
              <ListMusic className={`w-4 h-4 ${isPlaying ? 'text-[#81E4F2]' : 'text-gray-400'}`} />
              <div className={`w-1 h-3 rounded-full ${isPlaying ? 'bg-[#81E4F2] animate-pulse' : 'bg-gray-600'}`} />
            </div>

            {currentTrack && (
              <div className="flex-1 mx-2 truncate">
                <p className="text-xs text-white/70 truncate">{currentTrack.title}</p>
              </div>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              disabled={playlist.length === 0}
              className="p-1 hover:bg-white/10 rounded transition-colors mr-6 disabled:opacity-50"
            >
              {isPlaying ? (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              )}
            </button>
          </div>
        )}

        {/* Expanded State - Full View */}
        {!isCollapsed && (
          <div className="h-full p-3 flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 mb-0">
              <ListMusic className={`w-4 h-4 ${isPlaying ? 'text-[#81E4F2]' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-white/90">Playlist</span>

              {/* VU Meters */}
              <div className="flex items-end gap-0.5 h-3 ml-auto mr-6">
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-sm transition-all duration-75 ${
                      audioLevel >= threshold ? 'bg-gray-300' : 'bg-gray-700/50'
                    }`}
                    style={{ height: `${(i + 1) * 2 + 2}px` }}
                  />
                ))}
              </div>
            </div>

            {/* Playlist Items - Scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mb-2 mt-2">
              {playlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs px-4">
                  <ListMusic className="w-8 h-8 mb-3 opacity-50" />
                  <p className="text-center mb-2 font-medium text-gray-300">Drag tracks here to build your playlist</p>
                  <p className="text-center text-[10px] leading-relaxed">
                    Loops play in full • Songs preview for 20s
                  </p>
                  <p className="text-center text-[10px] text-gray-500 mt-1">
                    (Full streaming coming soon!)
                  </p>
                </div>
              ) : (
                playlist.map((track, index) => (
                  <PlaylistItem
                    key={`${track.id}-${index}`}
                    track={track}
                    index={index}
                    isPlaying={isPlaying && index === currentIndex}
                    onRemove={() => removeTrack(index)}
                    onPlay={() => {
                      setCurrentIndex(index);
                      setIsPlaying(true);
                    }}
                    moveTrack={(fromIndex: number, toIndex: number) => {
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
                    }}
                  />
                ))
              )}
            </div>

            {/* Transport Controls */}
            <AudioWidgetControls
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              onSkip={playNext}
              volume={volume}
              onVolumeChange={setVolume}
              disabled={playlist.length === 0}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// Individual playlist item with drag-to-reorder
interface PlaylistItemProps {
  track: PlaylistTrack;
  index: number;
  isPlaying: boolean;
  onRemove: () => void;
  onPlay: () => void;
  moveTrack: (fromIndex: number, toIndex: number) => void;
}

const PlaylistItem: React.FC<PlaylistItemProps> = ({ track, index, isPlaying, onRemove, onPlay, moveTrack }) => {
  // Drag for reordering within playlist
  const [{ isDragging }, drag] = useDrag({
    type: 'PLAYLIST_ITEM',
    item: { index },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  });

  const [, drop] = useDrop({
    accept: 'PLAYLIST_ITEM',
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveTrack(item.index, index);
        item.index = index;
      }
    }
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`track-item flex items-center gap-2 p-1.5 rounded bg-slate-800/30 hover:bg-slate-800/50 transition-colors ${
        isDragging ? 'opacity-50' : ''
      } ${isPlaying ? 'ring-1 ring-[#81E4F2]' : ''}`}
    >
      {/* Reorder handle */}
      <div className="cursor-move">
        <GripVertical className="w-3 h-3 text-gray-600" />
      </div>

      {/* Album art with cart button on hover */}
      <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0 group">
        {track.imageUrl && (
          <Image
            src={track.imageUrl}
            alt={track.title}
            fill
            className="object-cover"
          />
        )}
        {/* Cart icon - click to add to cart */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (typeof window !== 'undefined' && (window as any).addToCart) {
              (window as any).addToCart({
                id: track.id,
                title: track.title,
                artist: track.artist,
                artist_name: track.artist,
                cover_image_url: track.imageUrl,
                imageUrl: track.imageUrl,
                audio_url: track.audioUrl,
                audioUrl: track.audioUrl,
                bpm: track.bpm,
                content_type: track.content_type,
                price_stx: track.price_stx,
                primary_uploader_wallet: track.primary_uploader_wallet
              });
            }
          }}
          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-black/75"
          title="Add to cart"
        >
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </button>
      </div>

      <button
        onClick={onPlay}
        className="flex-1 min-w-0 text-left"
      >
        <div className="text-xs text-white truncate">{track.title}</div>
        <div className="text-[10px] text-gray-500 truncate">{track.artist}</div>
      </button>

      <button
        onClick={onRemove}
        className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

export default PlaylistWidget;
