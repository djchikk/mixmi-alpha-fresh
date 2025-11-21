"use client";

import React, { useEffect, useRef } from 'react';
import { Track } from '../types';

interface VideoDisplayAreaProps {
  deckATrack: Track | null;
  deckBTrack: Track | null;
  deckAPlaying: boolean;
  deckBPlaying: boolean;
  crossfaderPosition: number; // 0-100, where 50 is center
}

export default function VideoDisplayArea({
  deckATrack,
  deckBTrack,
  deckAPlaying,
  deckBPlaying,
  crossfaderPosition
}: VideoDisplayAreaProps) {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  // Check if decks have video content
  const deckAHasVideo = deckATrack?.content_type === 'video_clip' && (deckATrack as any).video_url;
  const deckBHasVideo = deckBTrack?.content_type === 'video_clip' && (deckBTrack as any).video_url;

  // Debug logging removed - component working correctly

  // Sync video A playback with deck A
  useEffect(() => {
    if (!videoARef.current || !deckAHasVideo) return;

    const video = videoARef.current;

    if (deckAPlaying) {
      video.play().catch(err => {
        console.warn('🎥 Deck A video autoplay prevented:', err);
      });
    } else {
      video.pause();
    }
  }, [deckAPlaying, deckAHasVideo]);

  // Sync video B playback with deck B
  useEffect(() => {
    if (!videoBRef.current || !deckBHasVideo) return;

    const video = videoBRef.current;

    if (deckBPlaying) {
      video.play().catch(err => {
        console.warn('🎥 Deck B video autoplay prevented:', err);
      });
    } else {
      video.pause();
    }
  }, [deckBPlaying, deckBHasVideo]);

  // Don't render if no videos
  if (!deckAHasVideo && !deckBHasVideo) {
    return null;
  }

  // Calculate split percentages based on crossfader (0-100)
  // When crossfader is at 0 (full A), show 100% A
  // When crossfader is at 50 (center), show 50/50
  // When crossfader is at 100 (full B), show 100% B
  const deckAWidth = deckAHasVideo && deckBHasVideo
    ? `${100 - crossfaderPosition}%`
    : '100%';
  const deckBWidth = deckAHasVideo && deckBHasVideo
    ? `${crossfaderPosition}%`
    : '100%';

  return (
    <div className="video-display-area rounded-b-lg overflow-hidden bg-black" style={{ height: '338px' }}>
      <div className="relative w-full h-full flex">
        {/* Deck A Video */}
        {deckAHasVideo && (
          <div
            className="relative transition-all duration-200 ease-out"
            style={{
              width: deckAWidth,
              opacity: deckAHasVideo && deckBHasVideo ? (100 - crossfaderPosition) / 100 : 1
            }}
          >
            <video
              ref={videoARef}
              src={(deckATrack as any).video_url}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
            />
            {/* Deck A Label */}
            <div className="absolute top-2 left-2 bg-black/70 text-cyan-400 px-2 py-1 rounded text-xs font-bold">
              DECK A
            </div>
          </div>
        )}

        {/* Deck B Video */}
        {deckBHasVideo && (
          <div
            className="relative transition-all duration-200 ease-out"
            style={{
              width: deckBWidth,
              opacity: deckAHasVideo && deckBHasVideo ? crossfaderPosition / 100 : 1
            }}
          >
            <video
              ref={videoBRef}
              src={(deckBTrack as any).video_url}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
            />
            {/* Deck B Label */}
            <div className="absolute top-2 right-2 bg-black/70 text-blue-400 px-2 py-1 rounded text-xs font-bold">
              DECK B
            </div>
          </div>
        )}

        {/* Center Split Line (only when both videos are present) */}
        {deckAHasVideo && deckBHasVideo && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/30 pointer-events-none transition-all duration-200 ease-out"
            style={{
              left: deckAWidth
            }}
          />
        )}
      </div>
    </div>
  );
}
