"use client";

import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { IPTrack } from '@/types';
import { supabase } from '@/lib/supabase';

// Content-type border colors
const CONTENT_TYPE_COLORS: Record<string, string> = {
  loop: '#A084F9',       // Bright Lavender
  full_song: '#A8E66B',  // Lime Green
  video_clip: '#5BB5F9', // Lighter Sky Blue
  radio_station: '#FFC044', // Golden Amber
  grabbed_radio: '#FFC044',
};

interface RemixStepCoverProps {
  loadedTracks: IPTrack[];
  coverImageUrl: string | null;
  onCoverGenerated: (url: string) => void;
}

// Draw an image with center-crop (object-fit: cover) into a square destination
function drawCroppedSquare(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dSize: number
) {
  const srcSize = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - srcSize) / 2;
  const sy = (img.naturalHeight - srcSize) / 2;
  ctx.drawImage(img, sx, sy, srcSize, srcSize, dx, dy, dSize, dSize);
}

// Draw a content-type colored border around a square
function drawContentTypeBorder(
  ctx: CanvasRenderingContext2D,
  contentType: string,
  x: number,
  y: number,
  size: number,
  borderWidth: number = 2
) {
  const color = CONTENT_TYPE_COLORS[contentType] || '#FFFFFF';
  ctx.strokeStyle = color;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(x, y, size, size);
}

export default function RemixStepCover({
  loadedTracks,
  coverImageUrl,
  onCoverGenerated,
}: RemixStepCoverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Generate composite cover from source track images, upload to Supabase Storage
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

      // Load source track images with their content types
      const imageData: { img: HTMLImageElement; contentType: string }[] = [];
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
          imageData.push({ img, contentType: track.content_type || 'loop' });
        } catch (e) {
          console.warn('Failed to load cover image for remix composite');
        }
      }

      if (imageData.length === 0) {
        // No images - gradient background
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, 'rgb(20, 30, 60)');
        gradient.addColorStop(0.5, 'rgb(10, 18, 42)');
        gradient.addColorStop(1, 'rgb(30, 40, 70)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      } else {
        // Arrange images as squares in grid — all layouts use square cells
        const padding = 8;
        const gap = 8;
        const border = 2;

        if (imageData.length === 1) {
          // Single image centered
          const imgSize = size - padding * 2;
          drawCroppedSquare(ctx, imageData[0].img, padding, padding, imgSize);
          drawContentTypeBorder(ctx, imageData[0].contentType, padding, padding, imgSize, border);
        } else if (imageData.length === 2) {
          // Two squares side by side
          const imgSize = (size - padding * 2 - gap) / 2;
          const yOffset = (size - imgSize) / 2; // Center vertically
          drawCroppedSquare(ctx, imageData[0].img, padding, yOffset, imgSize);
          drawContentTypeBorder(ctx, imageData[0].contentType, padding, yOffset, imgSize, border);
          drawCroppedSquare(ctx, imageData[1].img, padding + imgSize + gap, yOffset, imgSize);
          drawContentTypeBorder(ctx, imageData[1].contentType, padding + imgSize + gap, yOffset, imgSize, border);
        } else if (imageData.length === 3) {
          // Triangle arrangement
          const imgSize = (size - padding * 2 - gap) / 2;
          drawCroppedSquare(ctx, imageData[0].img, size / 2 - imgSize / 2, padding, imgSize);
          drawContentTypeBorder(ctx, imageData[0].contentType, size / 2 - imgSize / 2, padding, imgSize, border);
          drawCroppedSquare(ctx, imageData[1].img, padding, padding + imgSize + gap, imgSize);
          drawContentTypeBorder(ctx, imageData[1].contentType, padding, padding + imgSize + gap, imgSize, border);
          drawCroppedSquare(ctx, imageData[2].img, padding + imgSize + gap, padding + imgSize + gap, imgSize);
          drawContentTypeBorder(ctx, imageData[2].contentType, padding + imgSize + gap, padding + imgSize + gap, imgSize, border);
        } else {
          // 2x2 grid
          const imgSize = (size - padding * 2 - gap) / 2;
          const positions = [
            [padding, padding],
            [padding + imgSize + gap, padding],
            [padding, padding + imgSize + gap],
            [padding + imgSize + gap, padding + imgSize + gap],
          ];
          imageData.forEach((data, i) => {
            drawCroppedSquare(ctx, data.img, positions[i][0], positions[i][1], imgSize);
            drawContentTypeBorder(ctx, data.contentType, positions[i][0], positions[i][1], imgSize, border);
          });
        }
      }

      // Apply scanlines effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      for (let y = 0; y < size; y += 3) {
        ctx.fillRect(0, y, size, 1);
      }

      // Apply shimmer overlay
      const shimmerGradient = ctx.createLinearGradient(0, 0, size, size);
      shimmerGradient.addColorStop(0, 'rgba(151, 114, 244, 0.08)');   // Lavender tint
      shimmerGradient.addColorStop(0.5, 'rgba(160, 132, 249, 0.12)'); // Bright lavender
      shimmerGradient.addColorStop(1, 'rgba(168, 230, 107, 0.08)');   // Lime green tint
      ctx.fillStyle = shimmerGradient;
      ctx.fillRect(0, 0, size, size);

      // Upload to Supabase Storage instead of storing as data URI
      try {
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/png');
        });

        if (!blob) {
          console.error('Failed to create cover image blob');
          setIsGenerating(false);
          return;
        }

        const fileName = `remix-cover-${crypto.randomUUID()}.png`;
        const { error: uploadError } = await supabase.storage
          .from('cover-images')
          .upload(fileName, blob, {
            contentType: 'image/png',
            cacheControl: '31536000',
            upsert: false,
          });

        if (uploadError) {
          console.error('Failed to upload remix cover:', uploadError);
          setIsGenerating(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('cover-images')
          .getPublicUrl(fileName);

        onCoverGenerated(publicUrl);
      } catch (err) {
        console.error('Error uploading remix cover:', err);
      }

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
          {/* Shimmer border effect — lavender + lime green */}
          <div
            className="absolute -inset-1.5 rounded-xl opacity-75"
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #9772F4 14%, #FFFFFF 28%, #A8E66B 42%, #FFFFFF 56%, #A084F9 70%, #FFFFFF 84%, #A8E66B 100%)',
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
          <Sparkles size={12} className="inline mr-1 text-[#A084F9]" />
          Remix covers get lavender &amp; lime shimmer borders
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
