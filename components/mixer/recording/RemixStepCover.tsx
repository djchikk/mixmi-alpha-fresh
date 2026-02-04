"use client";

import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { IPTrack } from '@/types';

interface RemixStepCoverProps {
  loadedTracks: IPTrack[];
  coverImageUrl: string | null;
  onCoverGenerated: (url: string) => void;
}

export default function RemixStepCover({
  loadedTracks,
  coverImageUrl,
  onCoverGenerated,
}: RemixStepCoverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Generate composite cover from source track images
  useEffect(() => {
    if (coverImageUrl || isGenerating) return;

    const generateCover = async () => {
      setIsGenerating(true);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const size = 400; // Square output
      canvas.width = size;
      canvas.height = size;

      // Dark navy background
      ctx.fillStyle = 'rgb(10, 18, 42)';
      ctx.fillRect(0, 0, size, size);

      // Load source track images
      const images: HTMLImageElement[] = [];
      const trackCovers = loadedTracks
        .filter(track => track.cover_image_url)
        .slice(0, 4); // Max 4 images

      for (const track of trackCovers) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = track.cover_image_url!;
          });
          images.push(img);
        } catch (e) {
          console.warn('Failed to load image:', track.cover_image_url);
        }
      }

      if (images.length === 0) {
        // No images - just use gradient background
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, 'rgb(20, 30, 60)');
        gradient.addColorStop(0.5, 'rgb(10, 18, 42)');
        gradient.addColorStop(1, 'rgb(30, 40, 70)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      } else {
        // Arrange images in grid
        const padding = 8;
        const gap = 8;

        if (images.length === 1) {
          // Single image centered
          const imgSize = size - padding * 2;
          ctx.drawImage(images[0], padding, padding, imgSize, imgSize);
        } else if (images.length === 2) {
          // Side by side
          const imgWidth = (size - padding * 2 - gap) / 2;
          const imgHeight = size - padding * 2;
          ctx.drawImage(images[0], padding, padding, imgWidth, imgHeight);
          ctx.drawImage(images[1], padding + imgWidth + gap, padding, imgWidth, imgHeight);
        } else if (images.length === 3) {
          // Triangle arrangement
          const imgSize = (size - padding * 2 - gap) / 2;
          ctx.drawImage(images[0], size / 2 - imgSize / 2, padding, imgSize, imgSize);
          ctx.drawImage(images[1], padding, padding + imgSize + gap, imgSize, imgSize);
          ctx.drawImage(images[2], padding + imgSize + gap, padding + imgSize + gap, imgSize, imgSize);
        } else {
          // 2x2 grid
          const imgSize = (size - padding * 2 - gap) / 2;
          ctx.drawImage(images[0], padding, padding, imgSize, imgSize);
          ctx.drawImage(images[1], padding + imgSize + gap, padding, imgSize, imgSize);
          ctx.drawImage(images[2], padding, padding + imgSize + gap, imgSize, imgSize);
          ctx.drawImage(images[3], padding + imgSize + gap, padding + imgSize + gap, imgSize, imgSize);
        }
      }

      // Apply scanlines effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      for (let y = 0; y < size; y += 3) {
        ctx.fillRect(0, y, size, 1);
      }

      // Apply shimmer overlay (simplified static version)
      // Full animated version will be Phase 4
      const shimmerGradient = ctx.createLinearGradient(0, 0, size, size);
      shimmerGradient.addColorStop(0, 'rgba(168, 230, 207, 0.1)');
      shimmerGradient.addColorStop(0.5, 'rgba(136, 212, 242, 0.15)');
      shimmerGradient.addColorStop(1, 'rgba(168, 230, 207, 0.1)');
      ctx.fillStyle = shimmerGradient;
      ctx.fillRect(0, 0, size, size);

      // Convert to data URL
      const dataUrl = canvas.toDataURL('image/png');
      onCoverGenerated(dataUrl);
      setIsGenerating(false);
    };

    generateCover();
  }, [loadedTracks, coverImageUrl, isGenerating, onCoverGenerated]);

  return (
    <div className="remix-step-cover p-4 space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-white mb-1">Your Remix Cover</h3>
        <p className="text-sm text-slate-400">
          Auto-generated from your source tracks
        </p>
      </div>

      {/* Cover Preview */}
      <div className="flex justify-center">
        <div className="relative">
          {/* Shimmer border effect */}
          <div
            className="absolute -inset-1.5 rounded-xl opacity-75"
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #A8E6CF 14%, #FFFFFF 28%, #88D4F2 42%, #FFFFFF 56%, #B8E8D2 70%, #FFFFFF 84%, #7BC8F4 100%)',
              backgroundSize: '400% 400%',
              animation: 'shimmer 6s ease-in-out infinite',
            }}
          />

          {/* Cover image */}
          <div className="relative w-64 h-64 rounded-lg overflow-hidden bg-slate-800">
            {coverImageUrl ? (
              <img
                src={coverImageUrl}
                alt="Remix cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Sparkles size={32} className="text-slate-600 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden canvas for generation */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Info text */}
      <div className="text-center text-xs text-slate-500 space-y-1">
        <p>
          <Sparkles size={12} className="inline mr-1 text-[#81E4F2]" />
          Gen 1 remixes get blue/green shimmer borders
        </p>
        <p>
          You can swap this cover later in your dashboard
        </p>
      </div>

      {/* Add shimmer keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}
