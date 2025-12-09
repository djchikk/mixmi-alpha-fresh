"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Pause, Volume2, VolumeX, X, GripVertical } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { IPTrack } from '@/types';
import { getOptimizedTrackImage } from '@/lib/imageOptimization';
import { supabase } from '@/lib/supabase';

export default function SimpleRadioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStation, setCurrentStation] = useState<IPTrack | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasRestoredState, setHasRestoredState] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume;

    // Expose global function for cards to load radio stations
    if (typeof window !== 'undefined') {
      (window as any).loadRadioTrack = async (track: IPTrack) => {
        console.log('📻 SimpleRadioPlayer: Loading track:', track.title, 'content_type:', track.content_type, 'pack_position:', track.pack_position);

        // Handle Radio Packs: load the first station in the pack
        if (track.content_type === 'station_pack') {
          console.log('📻 SimpleRadioPlayer: Detected station pack, fetching first station...');
          const packId = track.pack_id || track.id.split('-loc-')[0];

          // Fetch the first station from the pack
          const { data: stations, error } = await supabase
            .from('ip_tracks')
            .select('*')
            .eq('pack_id', packId)
            .eq('content_type', 'radio_station')
            .order('pack_position', { ascending: true })
            .limit(1);

          if (error) {
            console.error('📻 SimpleRadioPlayer: Error fetching stations from pack:', error);
            return;
          }

          if (!stations || stations.length === 0) {
            console.error('📻 SimpleRadioPlayer: No stations found in pack!');
            return;
          }

          const firstStation = stations[0];
          console.log('📻 SimpleRadioPlayer: Loading first station from pack:', firstStation.title, 'pack_position:', firstStation.pack_position);
          setCurrentStation(firstStation);
          setIsExpanded(true);

          if (audioRef.current) {
            const rawStreamUrl = firstStation.stream_url || firstStation.audio_url;
            if (!rawStreamUrl) {
              console.error('📻 SimpleRadioPlayer: No audio source found for station!', firstStation);
              return;
            }

            // Proxy radio streams through API to avoid CORS issues
            const audioSource = `/api/radio-proxy?url=${encodeURIComponent(rawStreamUrl)}`;
            audioRef.current.src = audioSource;
            audioRef.current.load();

            // Auto-play when loading new station
            audioRef.current.play()
              .then(() => {
                setIsPlaying(true);
                console.log('📻 SimpleRadioPlayer: First station from pack playing');
              })
              .catch(error => {
                console.error('📻 SimpleRadioPlayer: Playback failed:', error);
                setIsPlaying(false);
              });
          }
          return;
        }

        // Handle individual radio stations
        console.log('📻 SimpleRadioPlayer: Loading individual station, pack_position:', track.pack_position);
        setCurrentStation(track);
        setIsExpanded(true); // Auto-expand when loading from card

        if (audioRef.current) {
          const rawStreamUrl = track.stream_url || track.audio_url;
          if (!rawStreamUrl) {
            console.error('📻 SimpleRadioPlayer: No audio source found!', track);
            return;
          }

          // Proxy radio streams through API to avoid CORS issues
          const audioSource = `/api/radio-proxy?url=${encodeURIComponent(rawStreamUrl)}`;
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

  // Restore persisted radio state on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasRestoredState) {
      // First check for pending radio (one-time transfer from other pages)
      const pendingRadio = localStorage.getItem('mixmi-pending-radio');
      if (pendingRadio) {
        try {
          const track = JSON.parse(pendingRadio);
          console.log('📻 SimpleRadioPlayer: Found pending radio from localStorage:', track.title);
          localStorage.removeItem('mixmi-pending-radio');
          setTimeout(() => {
            if ((window as any).loadRadioTrack) {
              (window as any).loadRadioTrack(track);
            }
          }, 100);
          setHasRestoredState(true);
          return;
        } catch (e) {
          console.error('📻 SimpleRadioPlayer: Failed to parse pending radio:', e);
          localStorage.removeItem('mixmi-pending-radio');
        }
      }

      // Then check for persisted station state (survives page navigation)
      const savedState = localStorage.getItem('mixmi-radio-state');
      if (savedState) {
        try {
          const { station, wasPlaying, savedVolume, savedExpanded } = JSON.parse(savedState);
          console.log('📻 SimpleRadioPlayer: Restoring persisted state:', station?.title, 'wasPlaying:', wasPlaying);

          if (station) {
            setCurrentStation(station);
            setIsExpanded(savedExpanded ?? true);
            if (savedVolume !== undefined) setVolume(savedVolume);

            // Set up audio and auto-play if it was playing before
            if (audioRef.current) {
              const rawStreamUrl = station.stream_url || station.audio_url;
              if (rawStreamUrl) {
                const audioSource = `/api/radio-proxy?url=${encodeURIComponent(rawStreamUrl)}`;
                audioRef.current.src = audioSource;
                audioRef.current.volume = savedVolume ?? 0.7;
                audioRef.current.load();

                if (wasPlaying) {
                  audioRef.current.play()
                    .then(() => {
                      setIsPlaying(true);
                      console.log('📻 SimpleRadioPlayer: Restored and playing');
                    })
                    .catch(error => {
                      console.error('📻 SimpleRadioPlayer: Auto-play blocked:', error);
                      setIsPlaying(false);
                    });
                }
              }
            }
          }
        } catch (e) {
          console.error('📻 SimpleRadioPlayer: Failed to restore state:', e);
        }
      }
      setHasRestoredState(true);
    }
  }, [hasRestoredState]);

  // Persist radio state to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && hasRestoredState) {
      if (currentStation) {
        const stateToSave = {
          station: currentStation,
          wasPlaying: isPlaying,
          savedVolume: volume,
          savedExpanded: isExpanded
        };
        localStorage.setItem('mixmi-radio-state', JSON.stringify(stateToSave));
        console.log('📻 SimpleRadioPlayer: Saved state to localStorage');
      } else {
        // Clear persisted state if no station
        localStorage.removeItem('mixmi-radio-state');
      }
    }
  }, [currentStation, isPlaying, volume, isExpanded, hasRestoredState]);

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

  // Large invisible drop zone for radio - similar to cart drop zone pattern
  const [{ isOverRadio, canDropRadio }, radioDropRef] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD', 'GLOBE_CARD', 'RADIO_TRACK'],
    drop: (item: { track: any }) => {
      console.log('📻 Radio drop zone received:', item);
      handleRadioDrop(item.track);
    },
    canDrop: (item) => {
      return item.track?.content_type === 'radio_station' || item.track?.content_type === 'station_pack';
    },
    collect: (monitor) => ({
      isOverRadio: monitor.isOver(),
      canDropRadio: monitor.canDrop(),
    }),
  }), []);

  // Helper function to handle radio drops
  const handleRadioDrop = (track: any) => {
    // Check if it's a station pack - unpack it to crate first
    if (track.content_type === 'station_pack') {
      console.log('📦 Station pack detected, unpacking to crate:', track);

      // Add pack to crate (which will unpack it)
      if ((window as any).addPackToCrate) {
        (window as any).addPackToCrate(track);
      }

      // Then load the first track from the pack to play
      if ((window as any).loadRadioTrack) {
        (window as any).loadRadioTrack(track);
      }
    } else if (track.content_type === 'radio_station') {
      // Single radio station - just load it
      if ((window as any).loadRadioTrack) {
        (window as any).loadRadioTrack(track);
      }
    }
  };

  // Drop functionality for radio stations (on expanded player)
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: ['CRATE_TRACK', 'COLLECTION_TRACK', 'TRACK_CARD', 'GLOBE_CARD', 'RADIO_TRACK'],
    drop: (item: { track: any }) => {
      console.log('📻 Radio Player received drop:', item);
      handleRadioDrop(item.track);
    },
    canDrop: (item) => {
      return item.track?.content_type === 'radio_station' || item.track?.content_type === 'station_pack';
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), []);

  // Combine isOver states for visual feedback
  const isOverAny = isOverRadio || isOver;
  const canDropAny = canDropRadio || canDrop;

  // Drag functionality for current station - drag to crate, playlist, or mixer
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'COLLECTION_TRACK',
    item: () => {
      if (!currentStation) return null;
      return {
        track: {
          id: currentStation.id,
          title: currentStation.title,
          artist: currentStation.artist || currentStation.artist_name || 'Live Station',
          imageUrl: currentStation.cover_image_url,
          cover_image_url: currentStation.cover_image_url,
          audioUrl: currentStation.stream_url || currentStation.audio_url,
          audio_url: currentStation.audio_url,
          stream_url: currentStation.stream_url,
          content_type: currentStation.content_type || 'radio_station',
          bpm: currentStation.bpm,
          pack_position: currentStation.pack_position
        }
      };
    },
    canDrag: () => !!currentStation,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging()
    })
  }), [currentStation]);

  return (
    <>
      {/* Large invisible drop zone for radio - extends left and up from radio position */}
      <div
        ref={radioDropRef}
        className="fixed bottom-[100px] right-4 z-[998] w-[200px] h-[200px] pointer-events-auto"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Radio icon/widget pinned to bottom-right corner of drop zone */}
        <div className="absolute bottom-0 right-2">
          <div id="onborda-radio">
            {/* Radio Icon Button - Always Visible like cart/search icons */}
            {!isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className={`p-1.5 hover:bg-[#1E293B] rounded transition-all ${isOverAny && canDropAny ? 'animate-wiggle' : ''} ${isPlaying && currentStation ? 'radio-playing-pulse' : ''}`}
                style={isOverAny && canDropAny ? {
                  filter: 'drop-shadow(0 0 8px #FF6B4A) drop-shadow(0 0 16px #FF6B4A)',
                } : {}}
                title={currentStation ? (isPlaying ? `Playing: ${currentStation.title}` : `Paused: ${currentStation.title}`) : "Open Radio Player"}
              >
                <Radio
                  className={`w-6 h-6 transition-colors ${
                    isOverAny && canDropAny
                      ? 'text-[#FF6B4A]'
                      : isPlaying && currentStation
                        ? 'text-[#FF6B4A]'
                        : 'text-gray-200'
                  }`}
                  strokeWidth={2.5}
                />
              </button>
            )}

      {/* Expanded Radio Player */}
      {isExpanded && (
        <div
          ref={drop as any}
          className={`relative radio-player-container ${isOverAny && canDropAny ? 'drop-active animate-wiggle' : ''}`}
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
        <Radio className="w-4 h-4 text-gray-300" />
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          Live Radio
        </span>
      </div>

      {/* Empty State or Station Info */}
      {!currentStation ? (
        <div className="flex gap-3" style={{ height: '60px' }}>
          {/* Empty artwork placeholder */}
          <div className="empty-radio-artwork flex-shrink-0 rounded-lg flex items-center justify-center">
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
        {/* Station Artwork - Draggable */}
        <div
          ref={drag as any}
          className={`loaded-radio-artwork flex-shrink-0 rounded-lg overflow-hidden relative cursor-grab active:cursor-grabbing group ${isDragging ? 'opacity-50' : ''}`}
          title="Drag to Crate or Playlist"
        >
          <img
            src={getOptimizedTrackImage(currentStation, 60)}
            alt={currentStation.title}
            className="w-full h-full object-cover"
          />

          {/* Drag handle indicator - shows on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <GripVertical className="w-5 h-5 text-white" />
          </div>

          {/* Pack position badge - top left */}
          {currentStation.pack_position && (
            <div
              className="absolute top-1 left-1 w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center pointer-events-none z-10"
              style={{
                backgroundColor: '#FF6B4A',
                color: '#FFFFFF'
              }}
            >
              {currentStation.pack_position}
            </div>
          )}
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
        </div>
      </div>

      {/* Radio Player Styles */}
      <style jsx>{`
        .radio-player-container {
          position: relative;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(8px);
          border-radius: 0.75rem;
          width: 280px;
          padding: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(51, 65, 85, 0.5);
        }

        /* Drop active state - coral-red highlight for radio */
        .radio-player-container.drop-active {
          border-color: rgba(255, 107, 74, 0.6);
          box-shadow: 0 0 20px rgba(255, 107, 74, 0.3);
        }

        /* Empty artwork placeholder with coral-red pulse */
        .empty-radio-artwork {
          width: 60px;
          height: 60px;
          border: 2px dashed #64748B;
          background-color: rgba(100, 116, 139, 0.1);
          animation: artwork-pulse 3s ease-in-out infinite;
        }

        /* Pulse animation for empty artwork - from grayscale to coral-red */
        @keyframes artwork-pulse {
          0%, 100% {
            border-color: #64748B;
          }
          50% {
            border-color: #FF6B4A;
          }
        }

        /* Loaded artwork - solid coral-red border */
        .loaded-radio-artwork {
          width: 60px;
          height: 60px;
          border: 2px solid #FF6B4A;
        }

        /* Subtle pulse animation for radio icon when playing */
        .radio-playing-pulse {
          animation: radio-glow-pulse 2s ease-in-out infinite;
        }

        @keyframes radio-glow-pulse {
          0%, 100% {
            filter: drop-shadow(0 0 2px rgba(255, 107, 74, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 6px rgba(255, 107, 74, 0.6)) drop-shadow(0 0 10px rgba(255, 107, 74, 0.3));
          }
        }
      `}</style>
    </>
  );
}
