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
  bw: number;
}

export default function VideoDisplayArea({
  deckATrack,
  deckBTrack,
  deckAPlaying,
  deckBPlaying,
  crossfaderPosition,
  crossfadeMode = 'slide',
  videoEffects = { colorShift: 0, pixelate: 0, invert: 0, bw: 0 }
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
    const videoWidth = track?.video_natural_width;
    const videoHeight = track?.video_natural_height;

    console.log('🎬 Crop Data:', { cropX, cropY, cropWidth, cropHeight, cropZoom, videoWidth, videoHeight });

    // If no crop data or no video dimensions, return empty style
    if (cropX == null || cropY == null || !cropWidth || !cropHeight || !videoWidth || !videoHeight) {
      console.log('⚠️ Missing crop data, returning empty styles');
      return {};
    }

    // Calculate the center of the crop area in pixels
    const cropCenterX = cropX + (cropWidth / 2);
    const cropCenterY = cropY + (cropHeight / 2);

    // Convert the crop center to percentage of video dimensions
    const cropCenterXPercent = (cropCenterX / videoWidth) * 100;
    const cropCenterYPercent = (cropCenterY / videoHeight) * 100;

    console.log('📐 Calculated crop position:', { cropCenterXPercent, cropCenterYPercent, cropZoom });

    // Use object-position to show the cropped area and scale to apply zoom
    // object-position moves the video so the specified point is at the center
    const styles = {
      transform: `scale(${cropZoom})`,
      objectPosition: `${cropCenterXPercent}% ${cropCenterYPercent}%`,
      transformOrigin: 'center center',
    };

    console.log('✅ Applying crop styles:', styles);
    return styles;
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

    // VHS Glitch aesthetic - posterization and color crush
    if (videoEffects.pixelate > 0) {
      filters.push(`contrast(${1.6})`); // High contrast for crushed look
      filters.push(`saturate(${1.4})`); // Boosted saturation
      filters.push(`brightness(${0.92})`); // Slight darkening
      // Note: True posterization would need canvas, but high contrast achieves similar effect
    }

    if (videoEffects.invert > 0) {
      // PSYCHEDELIC INVERT: Extreme warping and color distortion!
      filters.push(`invert(${videoEffects.invert * 0.6})`); // Partial color inversion
      filters.push(`saturate(${1 + videoEffects.invert * 4})`); // Up to 5x saturation (MORE than color shift!)
      filters.push(`contrast(${1 + videoEffects.invert * 1.2})`); // Extreme contrast warping
      filters.push(`brightness(${1 + videoEffects.invert * 0.4})`); // Brightness boost
      filters.push(`hue-rotate(${videoEffects.invert * 180}deg)`); // Half color wheel rotation
    }

    if (videoEffects.bw > 0) {
      // HIGH CONTRAST NOIR: Dramatic black & white with deep shadows
      filters.push(`grayscale(1)`); // Full grayscale
      filters.push(`contrast(${1 + videoEffects.bw * 0.4})`); // 1.4x contrast for punchy shadows
      filters.push(`brightness(${1 - videoEffects.bw * 0.05})`); // Slight darkening for deeper blacks
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
        {/* VHS Glitch Effect - Multiple Layers */}
        {videoEffects.pixelate > 0 && (
          <>
            {/* Glitch Slice 1 - Top band */}
            <div
              className="absolute left-0 right-0 pointer-events-none z-20 animate-glitch1"
              style={{
                top: '15%',
                height: '8%',
                background: 'inherit',
                clipPath: 'inset(0)',
              }}
            />
            {/* Glitch Slice 2 - Middle band */}
            <div
              className="absolute left-0 right-0 pointer-events-none z-20 animate-glitch2"
              style={{
                top: '45%',
                height: '5%',
                background: 'inherit',
                clipPath: 'inset(0)',
              }}
            />
            {/* Glitch Slice 3 - Lower band */}
            <div
              className="absolute left-0 right-0 pointer-events-none z-20 animate-glitch3"
              style={{
                top: '72%',
                height: '6%',
                background: 'inherit',
                clipPath: 'inset(0)',
              }}
            />
            {/* Static Noise Overlay */}
            <div
              className="absolute inset-0 pointer-events-none z-21 animate-noise"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                opacity: 0.12,
                mixBlendMode: 'overlay'
              }}
            />
            {/* RGB Split / Chromatic Aberration */}
            <div
              className="absolute inset-0 pointer-events-none z-19 animate-rgbsplit"
              style={{
                background: 'linear-gradient(90deg, rgba(255,0,0,0.05) 0%, transparent 15%, transparent 85%, rgba(0,255,255,0.05) 100%)',
                mixBlendMode: 'screen'
              }}
            />
          </>
        )}
        {/* Deck A Video */}
        {showDeckA && (
          <div
            className={`transition-all duration-200 ease-out ${
              crossfadeMode === 'blend' ? 'absolute top-0 left-0 w-full h-full' : 'relative'
            }`}
            style={{
              width: crossfadeMode === 'blend' ? '100%' : deckAWidth,
              opacity: deckAOpacity
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
              muted={true}
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
              muted={true}
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

      {/* Glitch Effect Animations */}
      <style jsx>{`
        @keyframes glitch1 {
          0%, 85%, 100% { transform: translateX(0); opacity: 0; }
          86% { transform: translateX(-8px); opacity: 0.7; }
          88% { transform: translateX(12px); opacity: 0.5; }
          90% { transform: translateX(-4px); opacity: 0.8; }
          92% { transform: translateX(0); opacity: 0; }
        }

        @keyframes glitch2 {
          0%, 70%, 100% { transform: translateX(0) scaleX(1); opacity: 0; }
          72% { transform: translateX(15px) scaleX(1.1); opacity: 0.6; }
          74% { transform: translateX(-10px) scaleX(0.95); opacity: 0.7; }
          76% { transform: translateX(5px) scaleX(1.05); opacity: 0.5; }
          78% { transform: translateX(0) scaleX(1); opacity: 0; }
        }

        @keyframes glitch3 {
          0%, 40%, 55%, 100% { transform: translateX(0); opacity: 0; }
          42% { transform: translateX(20px); opacity: 0.8; }
          44% { transform: translateX(-15px); opacity: 0.6; }
          46% { transform: translateX(8px); opacity: 0.7; }
          48% { transform: translateX(0); opacity: 0; }
        }

        @keyframes noise {
          0%, 100% { transform: translate(0, 0) scale(1); }
          20% { transform: translate(-2%, 1%) scale(1.01); }
          40% { transform: translate(1%, -1%) scale(0.99); }
          60% { transform: translate(-1%, 2%) scale(1.02); }
          80% { transform: translate(2%, -2%) scale(0.98); }
        }

        @keyframes rgbsplit {
          0%, 88%, 100% { opacity: 0; transform: translateX(0); }
          90% { opacity: 1; transform: translateX(-3px); }
          92% { opacity: 0.5; transform: translateX(4px); }
          94% { opacity: 1; transform: translateX(-2px); }
          96% { opacity: 0; transform: translateX(0); }
        }

        .animate-glitch1 {
          animation: glitch1 2.5s ease-in-out infinite;
        }

        .animate-glitch2 {
          animation: glitch2 3.2s ease-in-out infinite;
        }

        .animate-glitch3 {
          animation: glitch3 2.8s ease-in-out infinite;
        }

        .animate-noise {
          animation: noise 0.3s steps(5) infinite;
        }

        .animate-rgbsplit {
          animation: rgbsplit 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
