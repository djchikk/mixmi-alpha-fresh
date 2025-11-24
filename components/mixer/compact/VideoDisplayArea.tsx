"use client";

import React, { useEffect, useRef } from 'react';
import { Track } from '../types';

export type CrossfadeMode = 'slide' | 'blend' | 'cut';

interface VideoDisplayAreaProps {
  deckATrack: Track | null;
  deckBTrack: Track | null;
  deckAPlaying: boolean;
  deckBPlaying: boolean;
  crossfaderPosition: number; // 0-100, where 50 is center
  crossfadeMode?: CrossfadeMode;
  videoEffects?: VideoEffects;
}

interface VideoEffects {
  colorShift: number;
  pixelate: number;
  invert: number;
  mirror: number;
}

export default function VideoDisplayArea({
  deckATrack,
  deckBTrack,
  deckAPlaying,
  deckBPlaying,
  crossfaderPosition,
  crossfadeMode = 'slide',
  videoEffects = { colorShift: 0, pixelate: 0, invert: 0, mirror: 0 }
}: VideoDisplayAreaProps) {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);


  // Check if decks have video content
  const deckAHasVideo = Boolean(deckATrack?.content_type === 'video_clip' && (deckATrack as any).video_url);
  const deckBHasVideo = Boolean(deckBTrack?.content_type === 'video_clip' && (deckBTrack as any).video_url);

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

  // Helper function to get crop styles
  const getCropStyles = (track: any) => {
    const cropX = track?.video_crop_x;
    const cropY = track?.video_crop_y;
    const cropWidth = track?.video_crop_width;
    const cropHeight = track?.video_crop_height;
    const cropZoom = track?.video_crop_zoom || 1.0;

    // If no crop data, return empty style
    if (!cropX && !cropY && !cropWidth && !cropHeight) {
      return {};
    }

    // Calculate the center point of the crop area as a percentage
    // This positions the video so the cropped area is centered
    const centerX = cropX + (cropWidth / 2);
    const centerY = cropY + (cropHeight / 2);

    return {
      transform: `scale(${cropZoom})`,
      transformOrigin: 'center center',
    };
  };

  // Build CSS filter string from active effects
  const getFilterString = () => {
    const filters: string[] = [];

    if (videoEffects.colorShift > 0) {
      // Intense psychedelic color shift!
      filters.push(`hue-rotate(${videoEffects.colorShift * 360}deg)`); // Full color wheel rotation
      filters.push(`saturate(${1 + videoEffects.colorShift * 2})`); // Up to 3x saturation boost (was 1.5x)
      filters.push(`contrast(${1 + videoEffects.colorShift * 0.5})`); // Add contrast punch
      filters.push(`brightness(${1 + videoEffects.colorShift * 0.3})`); // Slight brightness boost
    }

    // Pixelate is handled via imageRendering CSS property
    // Strong color boost for pronounced retro aesthetic
    if (videoEffects.pixelate > 0) {
      filters.push(`contrast(${1.5})`); // Higher contrast for color banding
      filters.push(`saturate(${1.3})`); // Higher saturation for digital pop
      filters.push(`brightness(${0.95})`); // Slight darkening for CRT feel
    }

    if (videoEffects.invert > 0) {
      // PSYCHEDELIC INVERT: Extreme warping and color distortion!
      filters.push(`invert(${videoEffects.invert * 0.6})`); // Partial color inversion
      filters.push(`saturate(${1 + videoEffects.invert * 4})`); // Up to 5x saturation (MORE than color shift!)
      filters.push(`contrast(${1 + videoEffects.invert * 1.2})`); // Extreme contrast warping
      filters.push(`brightness(${1 + videoEffects.invert * 0.4})`); // Brightness boost
      filters.push(`hue-rotate(${videoEffects.invert * 180}deg)`); // Half color wheel rotation
    }

    return filters.length > 0 ? filters.join(' ') : 'none';
  };

  // Calculate crossfade behavior based on mode
  let deckAWidth = '100%';
  let deckBWidth = '100%';
  let deckAOpacity = 1;
  let deckBOpacity = 1;
  let showDeckA = deckAHasVideo;
  let showDeckB = deckBHasVideo;

  if (deckAHasVideo && deckBHasVideo) {
    switch (crossfadeMode) {
      case 'slide':
        // Split-screen with moving divider - full brightness, no opacity fade
        deckAWidth = `${100 - crossfaderPosition}%`;
        deckBWidth = `${crossfaderPosition}%`;
        deckAOpacity = 1; // Keep full brightness
        deckBOpacity = 1; // Keep full brightness
        break;

      case 'blend':
        // Opacity crossfade with screen blend mode to prevent darkening
        deckAWidth = '100%';
        deckBWidth = '100%';
        deckAOpacity = (100 - crossfaderPosition) / 100;
        deckBOpacity = crossfaderPosition / 100;
        break;

      case 'cut':
        // Hard cut at 50%
        if (crossfaderPosition < 50) {
          showDeckB = false;
          deckAOpacity = 1;
        } else {
          showDeckA = false;
          deckBOpacity = 1;
        }
        break;
    }
  }

  const filterString = getFilterString();

  return (
    <div className="video-display-area rounded-lg overflow-hidden bg-black relative" style={{ height: '408px' }}>

      <div
        className={`w-full ${crossfadeMode === 'blend' ? 'relative' : 'relative flex'}`}
        style={{
          filter: filterString,
          height: '408px', // Explicit height for positioning context in blend mode
          position: 'relative' // Ensure positioning context for absolute children
        }}
      >
        {/* CRT Scan Lines Overlay */}
        {videoEffects.pixelate > 0 && (
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15) 0px, rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)',
              mixBlendMode: 'multiply'
            }}
          />
        )}
        {/* Deck A Video */}
        {showDeckA && (
          <div
            className={`transition-all duration-200 ease-out ${
              crossfadeMode === 'blend' ? 'absolute top-0 left-0 w-full h-full' : 'relative'
            }`}
            style={{
              width: crossfadeMode === 'blend' ? '100%' : deckAWidth,
              opacity: deckAOpacity,
              transform: videoEffects.mirror > 0 ? 'scaleX(-1)' : 'none'
            }}
          >
            <video
              ref={videoARef}
              src={(deckATrack as any).video_url}
              className="w-full h-full object-cover"
              style={{
                imageRendering: videoEffects.pixelate > 0 ? 'pixelated' : 'auto',
                ...getCropStyles(deckATrack)
              }}
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
        {showDeckB && (
          <div
            className={`transition-all duration-200 ease-out ${
              crossfadeMode === 'blend' ? 'absolute top-0 left-0 w-full h-full' : 'relative'
            }`}
            style={{
              width: crossfadeMode === 'blend' ? '100%' : deckBWidth,
              opacity: deckBOpacity,
              transform: videoEffects.mirror > 0 ? 'scaleX(-1)' : 'none',
              mixBlendMode: crossfadeMode === 'blend' && deckAOpacity > 0 && deckBOpacity > 0 ? 'screen' : 'normal',
              zIndex: crossfadeMode === 'blend' ? 10 : 'auto'
            }}
          >
            <video
              ref={videoBRef}
              src={(deckBTrack as any).video_url}
              className="w-full h-full object-cover"
              style={{
                imageRendering: videoEffects.pixelate > 0 ? 'pixelated' : 'auto',
                ...getCropStyles(deckBTrack)
              }}
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

        {/* Center Split Line (only when both videos are present and in SLIDE mode) */}
        {deckAHasVideo && deckBHasVideo && crossfadeMode === 'slide' && (
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
