"use client";

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { PRICING } from '@/config/pricing';

interface RecordingWaveformProps {
  waveformData: Float32Array;
  bpm: number;
  totalBars: number;
  trimStartBars: number;
  trimEndBars: number;
  onTrimStartChange: (bars: number) => void;
  onTrimEndChange: (bars: number) => void;
  playbackPosition?: number; // 0-1 normalized position
  isPlaying?: boolean;
  compactHeight?: boolean; // Use ~50% height for compact view
}

export default function RecordingWaveform({
  waveformData,
  bpm,
  totalBars,
  trimStartBars,
  trimEndBars,
  onTrimStartChange,
  onTrimEndChange,
  playbackPosition = 0,
  isPlaying = false,
  compactHeight = false,
}: RecordingWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const canvasHeight = compactHeight ? 70 : 120;

  const barsPerBlock = PRICING.remix.barsPerBlock; // 8 bars per block
  const minBars = 1; // Minimum selection allows partial blocks

  // Calculate positions
  const getBarPosition = useCallback(
    (bars: number) => (bars / totalBars) * canvasWidth,
    [totalBars, canvasWidth]
  );

  const getPositionBars = useCallback(
    (x: number) => (x / canvasWidth) * totalBars,
    [totalBars, canvasWidth]
  );

  // Snap to 8-bar boundary
  const snapTo8Bars = useCallback((bars: number) => {
    return Math.round(bars / barsPerBlock) * barsPerBlock;
  }, [barsPerBlock]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(entry.contentRect.width);
      }
    });

    observer.observe(container);
    setCanvasWidth(container.offsetWidth);

    return () => observer.disconnect();
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw 8-bar grid backgrounds (alternating)
    const blockCount = Math.ceil(totalBars / barsPerBlock);
    for (let i = 0; i < blockCount; i++) {
      const startX = getBarPosition(i * barsPerBlock);
      const endX = getBarPosition(Math.min((i + 1) * barsPerBlock, totalBars));
      const width = endX - startX;

      // Alternate colors for 8-bar blocks
      ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#334155'; // slate-800 / slate-700
      ctx.fillRect(startX, 0, width, canvasHeight);
    }

    // Draw trim region overlay (darker outside trim)
    const trimStartX = getBarPosition(trimStartBars);
    const trimEndX = getBarPosition(trimEndBars);

    // Darken outside trim region
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, trimStartX, canvasHeight);
    ctx.fillRect(trimEndX, 0, canvasWidth - trimEndX, canvasHeight);

    // Draw waveform
    const samplesPerPixel = waveformData.length / canvasWidth;
    const centerY = canvasHeight / 2;

    ctx.beginPath();
    ctx.moveTo(0, centerY);

    for (let x = 0; x < canvasWidth; x++) {
      const sampleIndex = Math.floor(x * samplesPerPixel);
      const sample = waveformData[sampleIndex] || 0;
      const y = centerY - sample * (canvasHeight * 0.4);
      ctx.lineTo(x, y);
    }

    for (let x = canvasWidth - 1; x >= 0; x--) {
      const sampleIndex = Math.floor(x * samplesPerPixel);
      const sample = waveformData[sampleIndex] || 0;
      const y = centerY + sample * (canvasHeight * 0.4);
      ctx.lineTo(x, y);
    }

    ctx.closePath();

    // Color based on inside/outside trim
    // IMPORTANT: Clamp values to valid gradient range [0, 1] to prevent IndexSizeError
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    const startStop = Math.max(0, Math.min(1, trimStartX / canvasWidth));
    const endStop = Math.max(0, Math.min(1, trimEndX / canvasWidth));
    gradient.addColorStop(startStop, '#64748b'); // slate-500 (outside)
    gradient.addColorStop(Math.min(1, startStop + 0.001), '#81E4F2'); // cyan (inside)
    gradient.addColorStop(Math.max(0, endStop - 0.001), '#81E4F2');
    gradient.addColorStop(endStop, '#64748b');

    ctx.fillStyle = '#81E4F2'; // cyan for main waveform
    ctx.fill();

    // Draw 8-bar grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= blockCount; i++) {
      const x = getBarPosition(i * barsPerBlock);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }

    // Draw block numbers
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < blockCount; i++) {
      const x = getBarPosition(i * barsPerBlock + barsPerBlock / 2);
      ctx.fillText(`${i + 1}`, x, canvasHeight - 4);
    }

    // Draw trim handles
    const handleWidth = 8;
    const handleColor = '#FBBF24'; // amber-400

    // Start handle
    ctx.fillStyle = handleColor;
    ctx.fillRect(trimStartX - handleWidth / 2, 0, handleWidth, canvasHeight);

    // End handle
    ctx.fillRect(trimEndX - handleWidth / 2, 0, handleWidth, canvasHeight);

    // Draw handle grips
    ctx.fillStyle = '#0f172a';
    for (const x of [trimStartX, trimEndX]) {
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x - 2, canvasHeight / 2 - 15 + i * 10, 4, 6);
      }
    }

    // Draw playback position
    if (isPlaying || playbackPosition > 0) {
      const playX = playbackPosition * canvasWidth;
      ctx.strokeStyle = '#ef4444'; // red-500
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, canvasHeight);
      ctx.stroke();
    }
  }, [
    waveformData,
    canvasWidth,
    canvasHeight,
    totalBars,
    trimStartBars,
    trimEndBars,
    playbackPosition,
    isPlaying,
    getBarPosition,
    barsPerBlock,
  ]);

  // Handle mouse events for dragging trim handles
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const handleWidth = 16; // Larger hit area

      const trimStartX = getBarPosition(trimStartBars);
      const trimEndX = getBarPosition(trimEndBars);

      if (Math.abs(x - trimStartX) < handleWidth) {
        setIsDragging('start');
      } else if (Math.abs(x - trimEndX) < handleWidth) {
        setIsDragging('end');
      }
    },
    [getBarPosition, trimStartBars, trimEndBars]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, canvasWidth));
      const bars = getPositionBars(x);
      const snappedBars = snapTo8Bars(bars);

      if (isDragging === 'start') {
        // Ensure at least minBars between start and end (allows partial blocks)
        if (snappedBars < trimEndBars - minBars) {
          onTrimStartChange(Math.max(0, snappedBars));
        }
      } else if (isDragging === 'end') {
        // Ensure at least minBars between start and end (allows partial blocks)
        if (snappedBars > trimStartBars + minBars) {
          onTrimEndChange(Math.min(totalBars, snappedBars));
        }
      }
    },
    [
      isDragging,
      canvasWidth,
      getPositionBars,
      snapTo8Bars,
      trimStartBars,
      trimEndBars,
      totalBars,
      onTrimStartChange,
      onTrimEndChange,
      minBars,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Global mouse move/up handlers for dragging outside canvas
  useEffect(() => {
    if (!isDragging) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, canvasWidth));
      const bars = getPositionBars(x);
      const snappedBars = snapTo8Bars(bars);

      if (isDragging === 'start') {
        if (snappedBars < trimEndBars - minBars) {
          onTrimStartChange(Math.max(0, snappedBars));
        }
      } else if (isDragging === 'end') {
        if (snappedBars > trimStartBars + minBars) {
          onTrimEndChange(Math.min(totalBars, snappedBars));
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(null);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [
    isDragging,
    canvasWidth,
    getPositionBars,
    snapTo8Bars,
    trimStartBars,
    trimEndBars,
    totalBars,
    onTrimStartChange,
    onTrimEndChange,
    minBars,
  ]);

  // Calculate selected block count
  const selectedBars = trimEndBars - trimStartBars;
  const selectedBlocks = Math.ceil(selectedBars / barsPerBlock);

  return (
    <div className="recording-waveform" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg cursor-ew-resize"
        style={{ height: canvasHeight }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />
      <div className="flex justify-between mt-2 text-xs text-slate-400">
        <span>
          Trim: {trimStartBars.toFixed(0)} - {trimEndBars.toFixed(0)} bars
        </span>
        <span className="text-[#81E4F2] font-bold">
          {selectedBlocks} block{selectedBlocks !== 1 ? 's' : ''} ({selectedBars} bars)
        </span>
      </div>
    </div>
  );
}
