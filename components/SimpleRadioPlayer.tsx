"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { IPTrack } from '@/types';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';

export default function SimpleRadioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStation, setCurrentStation] = useState<IPTrack | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    // Expose global function for cards to load radio stations
    if (typeof window !== 'undefined') {
      (window as any).loadRadioTrack = (track: IPTrack) => {
        console.log('📻 SimpleRadioPlayer: Loading radio station:', track.title);
        setCurrentStation(track);

        if (audioRef.current) {
          const audioSource = track.stream_url || track.audio_url;
          if (!audioSource) {
            console.error('📻 SimpleRadioPlayer: No audio source found!', track);
            return;
          }

          audioRef.current.src = audioSource;
          audioRef.current.load();

          // Auto-play when loading new station
          audioRef.current.play()
            .then(() => {
              setIsPlaying(true);
              console.log('📻 SimpleRadioPlayer: Station playing');
            })
            .catch(error => {
              console.error('📻 SimpleRadioPlayer: Playback failed:', error);
              setIsPlaying(false);
            });
        }
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      if (typeof window !== 'undefined') {
        delete (window as any).loadRadioTrack;
      }
    };
  }, []);

  // Handle play/pause
  const togglePlayPause = () => {
    if (!audioRef.current || !currentStation) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(error => {
          console.error('📻 SimpleRadioPlayer: Playback failed:', error);
          setIsPlaying(false);
        });
    }
  };

  // Handle volume change
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

  // Handle mute toggle
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

  // Update audio volume when volume state changes
  useEffect(() => {
    if (audioRef.current && !isMuted) {
      audioRef.current.volume = volume;
    }
  }, [volume, isMuted]);

  // Don't render if no station is loaded
  if (!currentStation) {
    return null;
  }

  return (
    <div
      className="fixed bottom-24 right-6 z-[999]"
      style={{
        background: 'rgba(10, 10, 11, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(251, 146, 60, 0.3)',
        boxShadow: '0 8px 32px rgba(251, 146, 60, 0.2)',
        width: '280px',
        padding: '12px'
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Radio className="w-4 h-4 text-orange-400" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Live Radio
        </span>
      </div>

      {/* Station Info & Controls */}
      <div className="flex gap-3">
        {/* Station Artwork */}
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden"
          style={{
            width: '60px',
            height: '60px',
            border: '2px solid rgba(251, 146, 60, 0.5)'
          }}
        >
          <img
            src={getOptimizedTrackImage(currentStation, 60)}
            alt={currentStation.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info & Controls */}
        <div className="flex-1 flex flex-col justify-between min-w-0">
          {/* Station Name */}
          <div>
            <div className="text-sm font-semibold text-white truncate">
              {currentStation.title}
            </div>
            <div className="text-xs text-gray-400 truncate">
              {currentStation.artist || 'Live Station'}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlayPause}
              className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-all hover:scale-105"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-white" fill="white" />
              ) : (
                <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
              )}
            </button>

            {/* Volume Control */}
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
                accentColor: '#FB923C'
              }}
            />
          </div>
        </div>
      </div>

      {/* Live indicator */}
      {isPlaying && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-gray-400 uppercase tracking-wider">
            Live
          </span>
        </div>
      )}
    </div>
  );
}
