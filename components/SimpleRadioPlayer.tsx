"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Pause, Volume2, VolumeX, X } from 'lucide-react';
import { useDrop } from 'react-dnd';
import { IPTrack } from '@/types';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';

export default function SimpleRadioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStation, setCurrentStation] = useState<IPTrack | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
        setIsExpanded(true); // Auto-expand when loading from card

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

  // Drop functionality for radio stations
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD'],
    drop: (item: { track: any }) => {
      console.log('📻 Radio Player received drop:', item);

      // Check if it's a station pack - unpack it to crate first
      if (item.track.content_type === 'station_pack') {
        console.log('📦 Station pack detected, unpacking to crate:', item.track);

        // Add pack to crate (which will unpack it)
        if ((window as any).addPackToCrate) {
          (window as any).addPackToCrate(item.track);
        }

        // Then load the first track from the pack to play
        if ((window as any).loadRadioTrack) {
          (window as any).loadRadioTrack(item.track);
        }
      } else if (item.track.content_type === 'radio_station') {
        // Single radio station - just load it
        if ((window as any).loadRadioTrack) {
          (window as any).loadRadioTrack(item.track);
        }
      }
    },
    canDrop: (item) => {
      return item.track.content_type === 'radio_station' || item.track.content_type === 'station_pack';
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }));

  return (
    <div className="fixed bottom-[100px] right-6 z-[999]">
      {/* Radio Icon Button - Always Visible like cart/search icons */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="p-1.5 hover:bg-[#1E293B] rounded transition-colors"
          title="Open Radio Player"
        >
          <Radio className="w-6 h-6 text-gray-200" strokeWidth={2.5} />
        </button>
      )}

      {/* Expanded Radio Player */}
      {isExpanded && (
        <div
          ref={drop as any}
          className="relative"
          style={{
            background: 'rgba(10, 10, 11, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '12px',
            border: isOver && canDrop ? '2px solid #FB923C' : '1px solid #FB923C',
            boxShadow: '0 8px 32px rgba(251, 146, 60, 0.2)',
            width: '280px',
            padding: '12px'
          }}
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
        <Radio className="w-4 h-4" style={{ color: '#FB923C' }} />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Live Radio
        </span>
      </div>

      {/* Empty State or Station Info */}
      {!currentStation ? (
        <div className="flex gap-3" style={{ height: '60px' }}>
          {/* Empty artwork placeholder */}
          <div
            className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
            style={{
              width: '60px',
              height: '60px',
              border: '2px solid #FB923C',
              backgroundColor: 'rgba(251, 146, 60, 0.1)'
            }}
          >
            <Radio className="w-8 h-8 text-gray-600" />
          </div>

          {/* Empty text */}
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <p className="text-sm text-gray-400">No station loaded</p>
            <p className="text-xs text-gray-500">Drag stations here</p>
          </div>
        </div>
      ) : (
        <>
      {/* Station Info & Controls */}
      <div className="flex gap-3">
        {/* Station Artwork */}
        <div
          className="flex-shrink-0 rounded-lg overflow-hidden"
          style={{
            width: '60px',
            height: '60px',
            border: '2px solid #FB923C'
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
              className="text-gray-300 hover:text-white transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5" fill="currentColor" />
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
                accentColor: '#D1D5DB'
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
        </>
      )}
        </div>
      )}
    </div>
  );
}
