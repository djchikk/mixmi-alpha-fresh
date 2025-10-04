"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Radio, SkipForward, Volume2, ChevronDown, ChevronUp, Music, ShoppingCart } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { IPTrack } from '@/types';
import SafeImage from './shared/SafeImage';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import { useDrag } from 'react-dnd';
import { useMixer } from '@/contexts/MixerContext';

export default function RadioWidget() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<IPTrack | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [playedTracks, setPlayedTracks] = useState<Set<string>>(new Set());

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldAutoPlayRef = useRef(false);

  const { addToCart } = useMixer();

  // Set up drag for album art
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      if (!currentTrack) return null;
      return {
        track: {
          ...currentTrack,
          imageUrl: getOptimizedTrackImage(currentTrack, 64),
          cover_image_url: getOptimizedTrackImage(currentTrack, 64),
          audioUrl: currentTrack.audio_url
        }
      };
    },
    canDrag: () => !!currentTrack,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [currentTrack]);

  // Fetch random track
  const fetchRandomTrack = async () => {
    try {
      console.log('🎵 Radio: Fetching random track...');

      // Get total count first
      const { count } = await supabase
        .from('ip_tracks')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .in('content_type', ['full_song', 'loop']);

      console.log('🎵 Radio: Total tracks available:', count);

      if (!count || count === 0) {
        console.log('🎵 Radio: No tracks found');
        return;
      }

      // Generate random offset
      const randomOffset = Math.floor(Math.random() * count);
      console.log('🎵 Radio: Random offset:', randomOffset);

      // Fetch one random track
      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .is('deleted_at', null)
        .in('content_type', ['full_song', 'loop'])
        .order('created_at', { ascending: false }) // Prioritize recent uploads
        .range(randomOffset, randomOffset);

      if (error || !data || data.length === 0) {
        console.error('🎵 Radio: Error fetching random track:', error);
        return;
      }

      const track = data[0];
      console.log('🎵 Radio: Selected track:', track.title, 'by', track.artist);
      console.log('🎵 Radio: Audio URL:', track.audio_url);

      // Skip if we've already played this track (unless we've played everything)
      if (playedTracks.has(track.id) && playedTracks.size < count) {
        console.log('🎵 Radio: Track already played, fetching another...');
        fetchRandomTrack(); // Try again
        return;
      }

      setCurrentTrack(track);
      setPlayedTracks(prev => new Set([...prev, track.id]));

      // Load and play audio
      if (audioRef.current) {
        audioRef.current.src = track.audio_url;
        audioRef.current.volume = volume;
        console.log('🎵 Radio: Audio loaded, volume:', volume, 'shouldAutoPlay:', shouldAutoPlayRef.current);

        if (shouldAutoPlayRef.current) {
          try {
            await audioRef.current.play();
            console.log('🎵 Radio: Audio playing!');
            setIsPlaying(true);
          } catch (playError) {
            console.error('🎵 Radio: Error playing audio:', playError);
            setIsPlaying(false);
            shouldAutoPlayRef.current = false;
          }
        }
      }
    } catch (error) {
      console.error('🎵 Radio: Failed to fetch random track:', error);
    }
  };

  // Toggle play/pause
  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      shouldAutoPlayRef.current = false;
    } else {
      if (!currentTrack) {
        // First time playing - fetch a track and auto-play it
        shouldAutoPlayRef.current = true;
        await fetchRandomTrack();
      } else {
        // Resume current track
        try {
          await audioRef.current.play();
          console.log('🎵 Radio: Resumed playback');
          setIsPlaying(true);
        } catch (playError) {
          console.error('🎵 Radio: Error resuming playback:', playError);
        }
      }
    }
  };

  // Skip to next track
  const skipTrack = () => {
    if (isPlaying) {
      shouldAutoPlayRef.current = true;
    }
    fetchRandomTrack();
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Handle track end - auto-advance
  const handleTrackEnd = () => {
    fetchRandomTrack();
  };

  // Add current track to cart
  const handleAddToCart = () => {
    if (currentTrack) {
      addToCart(currentTrack);
      console.log('🎵 Radio: Added to cart:', currentTrack.title);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Update audio volume when state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return (
    <>
      <audio
        ref={audioRef}
        onEnded={handleTrackEnd}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div
        className={`radio-widget relative bg-slate-900/30 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 transition-all duration-300 overflow-hidden ${
          isCollapsed ? 'h-10' : 'h-[200px]'
        }`}
        style={{ width: isCollapsed ? '200px' : '320px' }}
      >
        {/* Collapse/Expand Button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`absolute ${isCollapsed ? 'top-1' : 'top-2'} right-2 p-1 rounded hover:bg-white/10 transition-all duration-200 z-20`}
          title={isCollapsed ? "Expand Radio" : "Collapse Radio"}
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
              <Radio className={`w-4 h-4 ${isPlaying ? 'text-cyan-400' : 'text-gray-400'}`} />
              <div className={`w-1 h-3 rounded-full ${isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`} />
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
              className="p-1 hover:bg-white/10 rounded transition-colors"
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
            <div className="flex items-center gap-2 mb-3">
              <Radio className={`w-4 h-4 ${isPlaying ? 'text-cyan-400' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-white/90">Radio</span>
              <div className={`w-1 h-3 rounded-full ml-auto ${isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`} />
            </div>

            {/* Now Playing */}
            {currentTrack ? (
              <div className="flex gap-3 flex-1 min-h-0">
                {/* Left side: Album Art with hover cart icon */}
                <div className="flex-shrink-0 group relative self-center">
                  {/* 64px Album Art - Draggable */}
                  <div
                    ref={drag}
                    className={`w-16 h-16 rounded overflow-hidden border-2 border-cyan-400/30 relative ${
                      isDragging ? 'opacity-50 cursor-grabbing' : 'cursor-grab'
                    }`}
                    title="Drag to crate or mixer"
                  >
                    {currentTrack.cover_image_url ? (
                      <img
                        src={getOptimizedTrackImage(currentTrack, 128)}
                        alt={currentTrack.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                        <Music className="w-6 h-6 text-gray-500" />
                      </div>
                    )}

                    {/* Cart icon - bottom left on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart();
                      }}
                      disabled={!currentTrack}
                      className="absolute bottom-0.5 left-0.5 w-5 h-5 bg-black/60 hover:bg-black/80 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                      title="Add to cart"
                    >
                      <ShoppingCart className="w-3 h-3 text-white" />
                    </button>
                  </div>
                </div>

                {/* Right side: Track Info with Ticker Scroll - Centered with image */}
                <div className="flex-1 min-w-0 flex items-center">
                  <div className="w-full flex flex-col gap-1">
                    {/* Scrolling ticker */}
                    <div className="relative w-full overflow-hidden" style={{ height: '24px' }}>
                      <div
                        className="absolute whitespace-nowrap flex items-center"
                        style={{
                          animation: 'scroll 15s linear infinite',
                          willChange: 'transform',
                          height: '24px'
                        }}
                      >
                        <span className="text-xs font-medium text-white">
                          {currentTrack.title} • {currentTrack.artist}
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                          {currentTrack.title} • {currentTrack.artist}
                        </span>
                      </div>
                    </div>

                    {/* Content type and BPM */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cyan-400 font-mono">
                        {currentTrack.content_type === 'full_song' ? 'SONG' : 'LOOP'}
                      </span>
                      {currentTrack.bpm && (
                        <span className="text-xs text-white/50 font-mono">{currentTrack.bpm} BPM</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-white/40">Press play to start radio</p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className="w-8 h-8 flex items-center justify-center bg-cyan-400/20 hover:bg-cyan-400/30 rounded transition-colors"
              >
                {isPlaying ? (
                  <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>

              {/* Skip */}
              <button
                onClick={skipTrack}
                className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded transition-colors"
                title="Skip track"
              >
                <SkipForward className="w-4 h-4 text-white/70" />
              </button>

              {/* Volume Control */}
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
