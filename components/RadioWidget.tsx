"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Radio, SkipForward, Volume2, ChevronDown, ChevronUp, Music } from 'lucide-react';
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
  const [audioLevel, setAudioLevel] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldAutoPlayRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioSourceSetupRef = useRef(false);

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
      // Notify other audio sources to pause
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('audioSourcePlaying', { detail: { source: 'radio' } }));
      }

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
    console.log('🎵 Radio: Track ended, fetching next track...');
    shouldAutoPlayRef.current = true; // Auto-play the next track
    fetchRandomTrack();
  };

  // Add current track to cart
  const handleAddToCart = () => {
    if (currentTrack && typeof window !== 'undefined' && (window as any).addToCart) {
      (window as any).addToCart(currentTrack);
      console.log('🎵 Radio: Added to cart:', currentTrack.title);
    }
  };

  // Listen for other audio sources playing
  useEffect(() => {
    const handleOtherAudioPlaying = (event: CustomEvent) => {
      if (event.detail.source !== 'radio' && isPlaying && audioRef.current) {
        console.log('🎵 Radio: Pausing due to', event.detail.source, 'playing');
        audioRef.current.pause();
        setIsPlaying(false);
        shouldAutoPlayRef.current = false;
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('audioSourcePlaying', handleOtherAudioPlaying as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('audioSourcePlaying', handleOtherAudioPlaying as EventListener);
      }
    };
  }, [isPlaying]);

  // Setup audio analysis for VU meter
  useEffect(() => {
    if (!audioRef.current || typeof window === 'undefined') return;

    // TEMPORARILY DISABLED - Testing if Web Audio API is blocking sound
    // TODO: Re-enable once we fix the audio routing issue

    // Simple fake VU meter based on playing state for now
    const updateAudioLevel = () => {
      if (!isPlaying) {
        setAudioLevel(0);
        return;
      }

      // Simulate VU meter with random values when playing
      setAudioLevel(0.3 + Math.random() * 0.4);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    if (isPlaying) {
      updateAudioLevel();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
        className={`radio-widget relative bg-slate-900/20 backdrop-blur-sm rounded-xl shadow-2xl border border-slate-700/50 transition-all duration-300 overflow-hidden ${
          isCollapsed ? 'h-10' : 'h-[200px]'
        }`}
        style={{ width: isCollapsed ? '240px' : '320px' }}
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
              className="p-1 hover:bg-white/10 rounded transition-colors mr-6"
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
              <Radio className={`w-4 h-4 ${isPlaying ? 'text-[#81E4F2]' : 'text-gray-400'}`} />
              <span className="text-sm font-medium text-white/90">Radio</span>

              {/* VU Meters - 5 bars */}
              <div className="flex items-end gap-0.5 h-3 ml-auto mr-6">
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-sm transition-all duration-75 ${
                      audioLevel >= threshold
                        ? 'bg-gray-300'
                        : 'bg-gray-700/50'
                    }`}
                    style={{
                      height: `${(i + 1) * 2 + 2}px`
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Now Playing */}
            {currentTrack ? (
              <div className="flex gap-3 flex-1 min-h-0">
                {/* Left side: Album Art with hover cart icon */}
                <div className="flex-shrink-0 group relative self-center">
                  {/* 64px Album Art - Draggable */}
                  <div
                    ref={drag}
                    className={`w-16 h-16 rounded overflow-hidden border-2 border-white/20 relative ${
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
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
                      </svg>
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
                        <span className="text-xs font-medium text-gray-200">
                          {currentTrack.title} • {currentTrack.artist}
                          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                          {currentTrack.title} • {currentTrack.artist}
                        </span>
                      </div>
                    </div>

                    {/* Content type and BPM */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50 font-mono">
                        {currentTrack.content_type === 'full_song' ? 'SONG' : 'LOOP'}
                      </span>
                      {currentTrack.bpm && (
                        <span className="text-xs text-white/40 font-mono">{currentTrack.bpm} BPM</span>
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
            <div className="flex items-center gap-2 bg-[#81E4F2]/10 rounded-lg px-2 py-2">
              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
                  isPlaying
                    ? 'bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30'
                    : 'border-2 border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2]'
                }`}
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
                  className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gray-300 [&::-webkit-slider-thumb]:cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
