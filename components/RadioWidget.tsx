"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Radio, ChevronDown, ChevronUp, Music } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { IPTrack } from '@/types';
import SafeImage from './shared/SafeImage';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import { useDrag, useDrop } from 'react-dnd';
import { useMixer } from '@/contexts/MixerContext';
import AudioWidgetControls from './AudioWidgetControls';

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

  // Set up drop zone for incoming tracks
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'TRACK_CARD',
    drop: (item: { track: IPTrack }) => {
      console.log('📻 Radio: Dropped track:', item.track.title, item.track);
      setCurrentTrack(item.track);
      setPlayedTracks(prev => new Set([...prev, item.track.id]));

      // Load audio but don't auto-play
      if (audioRef.current) {
        const audioSource = item.track.stream_url || item.track.audio_url;
        console.log('📻 Radio: Audio source:', audioSource);
        if (!audioSource) {
          console.error('📻 Radio: No audio source found!', item.track);
          return;
        }
        audioRef.current.src = audioSource;
        audioRef.current.volume = volume;
        // Add load event to verify it's ready
        audioRef.current.load();
        console.log('📻 Radio: Track loaded from drop, waiting for user to press play');
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [volume]);

  // Set up drag for album art
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      if (!currentTrack) return null;
      // Support both audio_url (tracks) and stream_url (radio stations)
      const audioSource = currentTrack.stream_url || currentTrack.audio_url;
      return {
        track: {
          ...currentTrack,
          imageUrl: getOptimizedTrackImage(currentTrack, 64),
          cover_image_url: getOptimizedTrackImage(currentTrack, 64),
          audioUrl: audioSource
        }
      };
    },
    canDrag: () => !!currentTrack,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [currentTrack]);

  // Fetch random track (supports songs, loops, and radio stations)
  const fetchRandomTrack = async () => {
    try {
      console.log('🎵 Radio: Fetching random track...');

      // Get total count first
      const { count } = await supabase
        .from('ip_tracks')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .in('content_type', ['full_song', 'loop', 'radio_station']);

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
        .in('content_type', ['full_song', 'loop', 'radio_station'])
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

      // Load and play audio (support both audio_url for tracks and stream_url for radio stations)
      if (audioRef.current) {
        const audioSource = track.stream_url || track.audio_url;
        audioRef.current.src = audioSource;
        audioRef.current.volume = volume;
        console.log('🎵 Radio: Audio loaded, volume:', volume, 'shouldAutoPlay:', shouldAutoPlayRef.current, 'source:', track.content_type === 'radio_station' ? 'stream' : 'file');

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

  // Expose loadRadioTrack and clearRadio globally for FILL/RESET buttons
  useEffect(() => {
    (window as any).loadRadioTrack = (track: any) => {
      console.log('📻 Radio: Loading track from FILL:', track.title);
      setCurrentTrack(track);
      setPlayedTracks(prev => new Set([...prev, track.id]));

      // Load audio but don't auto-play (support both audio_url and stream_url)
      if (audioRef.current) {
        const audioSource = track.stream_url || track.audio_url;
        audioRef.current.src = audioSource;
        audioRef.current.volume = volume;
        console.log('📻 Radio: Track loaded, waiting for user to press play', 'type:', track.content_type);
      }
    };

    (window as any).clearRadio = () => {
      console.log('🗑️ Radio: Clearing current track');
      setIsPlaying(false);
      setCurrentTrack(null);
      setPlayedTracks(new Set());
      shouldAutoPlayRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };

    return () => {
      delete (window as any).loadRadioTrack;
      delete (window as any).clearRadio;
    };
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
        ref={drop}
        className={`radio-widget relative bg-slate-900/20 backdrop-blur-sm rounded-xl shadow-2xl border transition-all duration-300 overflow-hidden ${
          isCollapsed ? 'h-10' : 'h-[200px]'
        } ${isOver ? 'border-[#81E4F2] border-2 bg-[#81E4F2]/10' : 'border-slate-700/50'}`}
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
                        {currentTrack.content_type === 'radio_station' ? '📻 RADIO' : currentTrack.content_type === 'full_song' ? 'SONG' : 'LOOP'}
                      </span>
                      {currentTrack.content_type === 'radio_station' && (
                        <span className="text-xs text-[#FB923C] font-bold">🔴 LIVE</span>
                      )}
                      {currentTrack.bpm && currentTrack.content_type !== 'radio_station' && (
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
            <AudioWidgetControls
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              onSkip={skipTrack}
              volume={volume}
              onVolumeChange={handleVolumeChange}
            />
          </div>
        )}
      </div>
    </>
  );
}
