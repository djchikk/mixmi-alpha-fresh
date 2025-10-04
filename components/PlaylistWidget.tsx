"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { ListMusic, ChevronDown, ChevronUp, X, GripVertical } from 'lucide-react';
import Image from 'next/image';

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
  const [position, setPosition] = useState({ x: 20, y: window.innerHeight - 220 });
  const [isDragging, setIsDragging] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

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

  // Accept drops from various sources
  const [{ isOver }, drop] = useDrop({
    accept: ['TRACK', 'GLOBE_CARD', 'CRATE_TRACK', 'RADIO_TRACK'],
    drop: (item: any) => {
      console.log('🎵 Playlist: Received drop:', item);

      const track: PlaylistTrack = {
        id: item.id || item.track?.id,
        title: item.title || item.track?.title,
        artist: item.artist || item.artist_name || item.track?.artist || 'Unknown Artist',
        imageUrl: item.imageUrl || item.cover_image_url || item.track?.imageUrl || '',
        audioUrl: item.audioUrl || item.audio_url || item.track?.audioUrl,
        bpm: item.bpm || item.track?.bpm,
        content_type: item.content_type || item.track?.content_type || 'loop',
        price_stx: item.price_stx || item.track?.price_stx,
        primary_uploader_wallet: item.primary_uploader_wallet || item.track?.primary_uploader_wallet
      };

      // Add to top of playlist
      setPlaylist(prev => {
        // Avoid duplicates
        if (prev.some(t => t.id === track.id)) return prev;
        return [track, ...prev];
      });
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

  // Widget dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, .track-item')) return;
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const currentTrack = playlist[currentIndex];

  return (
    <div
      ref={drop}
      className={`playlist-widget fixed z-40 select-none ${className}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: isCollapsed ? '240px' : '320px',
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
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

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 px-3 py-2 bg-gradient-to-b from-slate-900/50 to-transparent">
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

            {/* Collapse Toggle */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-gray-400 hover:text-[#81E4F2] transition-colors"
            >
              {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {!isCollapsed && (
          <>
            {/* Playlist Items - Scrollable */}
            <div className="absolute top-10 left-0 right-0 bottom-14 overflow-y-auto px-3 py-2 space-y-1">
              {playlist.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                  <ListMusic className="w-8 h-8 mb-2 opacity-50" />
                  <p>Drag tracks here</p>
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
            <div className="absolute bottom-0 left-0 right-0 bg-[#81E4F2]/10 rounded-lg px-3 py-2 flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                disabled={playlist.length === 0}
                className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
                  isPlaying
                    ? 'bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30'
                    : 'border-2 border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2]'
                } ${playlist.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isPlaying ? (
                  <svg className="w-4 h-4 text-[#81E4F2]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* Current Track Info */}
              {currentTrack && (
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="text-xs text-gray-200 truncate">
                    {currentTrack.title} • {currentTrack.artist}
                  </div>
                  <div className="text-[9px] text-gray-500">
                    {currentTrack.content_type === 'full_song' ? '20s preview' : 'Full loop'}
                  </div>
                </div>
              )}

              {/* Volume */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-300 [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>
          </>
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
      className={`track-item flex items-center gap-2 p-1.5 rounded bg-slate-800/30 hover:bg-slate-800/50 transition-colors cursor-move ${
        isDragging ? 'opacity-50' : ''
      } ${isPlaying ? 'ring-1 ring-[#81E4F2]' : ''}`}
    >
      <GripVertical className="w-3 h-3 text-gray-600" />

      <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
        {track.imageUrl && (
          <Image
            src={track.imageUrl}
            alt={track.title}
            fill
            className="object-cover"
          />
        )}
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
