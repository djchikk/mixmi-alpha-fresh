"use client";

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface RecordingWaveformDisplayProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  isPlaying: boolean;
  totalBars: number;
  bpm: number;
  onSelectSegment: (startBar: number, endBar: number) => void;
}

// Analyze frequency content and return color (Serato-style)
const analyzeFrequencyColors = (audioBuffer: AudioBuffer, numPixels: number): string[] => {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const samplesPerPixel = Math.ceil(channelData.length / numPixels);

  const colors: string[] = [];

  for (let i = 0; i < numPixels; i++) {
    const startSample = i * samplesPerPixel;
    const endSample = Math.min(startSample + samplesPerPixel, channelData.length);
    const chunk = channelData.slice(startSample, endSample);
    const color = analyzeChunkFrequency(chunk, sampleRate);
    colors.push(color);
  }

  return colors;
};

const analyzeChunkFrequency = (chunk: Float32Array, sampleRate: number): string => {
  let zeroCrossings = 0;
  let totalEnergy = 0;

  for (let i = 1; i < chunk.length; i++) {
    if ((chunk[i - 1] >= 0 && chunk[i] < 0) || (chunk[i - 1] < 0 && chunk[i] >= 0)) {
      zeroCrossings++;
    }
    totalEnergy += chunk[i] * chunk[i];
  }

  if (totalEnergy === 0) return '#DC143C'; // Silence = bass color

  const zcr = zeroCrossings / chunk.length;
  const estimatedFreq = (zcr * sampleRate) / 2;

  // Serato-style frequency classification
  if (estimatedFreq < 250) {
    // Bass (kick drums): Deep Red → Orange-Red
    const ratio = Math.min(estimatedFreq / 250, 1);
    return interpolateColor('#DC143C', '#FF4500', ratio);
  } else if (estimatedFreq < 2000) {
    // Mids (snares, vocals): Orange → Gold
    const ratio = (estimatedFreq - 250) / (2000 - 250);
    return interpolateColor('#FF8C42', '#FFD700', ratio);
  } else {
    // Highs (hi-hats, cymbals): Cyan → Blue
    const ratio = Math.min((estimatedFreq - 2000) / 10000, 1);
    return interpolateColor('#5DADE2', '#4A90E2', ratio);
  }
};

const interpolateColor = (color1: string, color2: string, ratio: number): string => {
  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);

  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

export default function RecordingWaveformDisplay({
  audioBuffer,
  currentTime,
  isPlaying,
  totalBars,
  bpm,
  onSelectSegment
}: RecordingWaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectionStart, setSelectionStart] = useState(0); // Start bar (0-based)
  const [selectionEnd, setSelectionEnd] = useState(8); // End bar (exclusive, so 8 means bars 0-7)
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'move' | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = normal, 2 = 2x zoom, etc.
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate timing
  const beatsPerBar = 4;
  const beatsPerSecond = bpm / 60;
  const secondsPerBar = beatsPerBar / beatsPerSecond;
  const totalDuration = totalBars * secondsPerBar;

  // Draw waveform with selection overlay
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dynamic width based on zoom level
    const baseWidth = 800;
    const width = baseWidth * zoomLevel;
    canvas.width = width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Extract waveform data
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(channelData.length / width);
    const waveformData: number[] = [];

    for (let x = 0; x < width; x++) {
      const startSample = x * samplesPerPixel;
      const endSample = Math.min(startSample + samplesPerPixel, channelData.length);

      let max = 0;
      for (let i = startSample; i < endSample; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > max) max = abs;
      }
      waveformData.push(max);
    }

    // Draw waveform with Serato-style frequency coloring
    const centerY = height / 2;

    // Analyze frequency content for each pixel
    const frequencyColors = analyzeFrequencyColors(audioBuffer, waveformData.length);

    for (let x = 0; x < waveformData.length; x++) {
      const amplitude = waveformData[x] * (height / 2 - 10);
      const color = frequencyColors[x] || '#81E4F2'; // Fallback to cyan

      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, centerY - amplitude);
      ctx.lineTo(x, centerY + amplitude);
      ctx.stroke();
    }

    // Draw bar lines (brighter for better visibility)
    ctx.strokeStyle = '#4A5568'; // Brighter gray (was #2d3748)
    ctx.lineWidth = 2; // Thicker for bars
    for (let bar = 0; bar <= totalBars; bar++) {
      const x = (bar / totalBars) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Bar numbers (every 8 bars for cycles)
      if (bar % 8 === 0 && bar < totalBars) {
        ctx.fillStyle = '#9CA3AF'; // Brighter text
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`${bar + 1}`, x + 4, 14); // Show actual bar number
      }
    }

    // Draw beat lines for precision (lighter, thinner)
    ctx.strokeStyle = '#3A4556';
    ctx.lineWidth = 1;
    const beatsPerBar = 4;
    const totalBeats = totalBars * beatsPerBar;
    for (let beat = 0; beat <= totalBeats; beat++) {
      if (beat % beatsPerBar !== 0) { // Skip bar lines (already drawn)
        const x = (beat / totalBeats) * width;
        ctx.beginPath();
        ctx.moveTo(x, height * 0.3); // 50% height for beat markers
        ctx.lineTo(x, height * 0.7);
        ctx.stroke();
      }
    }

    // Draw selection overlay
    const selectionStartX = (selectionStart / totalBars) * width;
    const selectionEndX = (selectionEnd / totalBars) * width;

    // Selection background
    ctx.fillStyle = 'rgba(129, 228, 242, 0.15)';
    ctx.fillRect(selectionStartX, 0, selectionEndX - selectionStartX, height);

    // Selection borders
    ctx.strokeStyle = '#81E4F2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(selectionStartX, 0);
    ctx.lineTo(selectionStartX, height);
    ctx.moveTo(selectionEndX, 0);
    ctx.lineTo(selectionEndX, height);
    ctx.stroke();

    // Selection bracket at top
    ctx.strokeStyle = '#81E4F2';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(selectionStartX, 10);
    ctx.lineTo(selectionStartX, 0);
    ctx.lineTo(selectionEndX, 0);
    ctx.lineTo(selectionEndX, 10);
    ctx.stroke();

    // Selection label (dynamic length)
    const selectionLength = selectionEnd - selectionStart;
    ctx.fillStyle = '#81E4F2';
    ctx.font = 'bold 13px monospace';
    const labelText = `${selectionLength} BARS (${Math.floor(selectionStart) + 1}-${Math.floor(selectionEnd)})`;
    const labelX = selectionStartX + (selectionEndX - selectionStartX) / 2 - ctx.measureText(labelText).width / 2;
    ctx.fillText(labelText, labelX, 25);

    // Selection handles
    const handleWidth = 12;
    const handleHeight = 30;

    // Start handle
    ctx.fillStyle = '#81E4F2';
    ctx.fillRect(selectionStartX - handleWidth / 2, centerY - handleHeight / 2, handleWidth, handleHeight);

    // End handle
    ctx.fillRect(selectionEndX - handleWidth / 2, centerY - handleHeight / 2, handleWidth, handleHeight);

    // Current playback position
    if (isPlaying && currentTime > 0) {
      const playbackX = (currentTime / totalDuration) * width;
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(playbackX, 0);
      ctx.lineTo(playbackX, height);
      ctx.stroke();
    }

  }, [audioBuffer, selectionStart, selectionEnd, totalBars, isPlaying, currentTime, totalDuration, bpm, zoomLevel]);

  // Handle mouse events for selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bar = Math.floor((x / rect.width) * totalBars);

    // Check if clicking on handles
    const selectionStartX = (selectionStart / totalBars) * rect.width;
    const selectionEndX = (selectionEnd / totalBars) * rect.width;

    const handleTolerance = 15;

    if (Math.abs(x - selectionStartX) < handleTolerance) {
      setIsDragging(true);
      setDragType('start');
    } else if (Math.abs(x - selectionEndX) < handleTolerance) {
      setIsDragging(true);
      setDragType('end');
    } else if (x > selectionStartX && x < selectionEndX) {
      setIsDragging(true);
      setDragType('move');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !canvasRef.current || !dragType) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Quantize to beats (1/4 bar) instead of whole bars for precision
    const beatsPerBar = 4;
    const totalBeats = totalBars * beatsPerBar;
    const beat = Math.max(0, Math.min(totalBeats, Math.floor((x / rect.width) * totalBeats)));
    const bar = beat / beatsPerBar; // Can be fractional (e.g., 2.25 = Bar 2, Beat 3)

    if (dragType === 'start') {
      // Allow dragging start handle, minimum 4 bars selection
      const newStart = Math.min(bar, selectionEnd - 4);
      setSelectionStart(Math.max(0, newStart));
    } else if (dragType === 'end') {
      // Allow dragging end handle, minimum 4 bars selection
      const newEnd = Math.max(bar, selectionStart + 4);
      setSelectionEnd(Math.min(totalBars, newEnd));
    } else if (dragType === 'move') {
      // Move entire selection
      const selectionLength = selectionEnd - selectionStart;
      const newStart = Math.max(0, Math.min(totalBars - selectionLength, bar - selectionLength / 2));
      setSelectionStart(newStart);
      setSelectionEnd(newStart + selectionLength);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragType(null);
      onSelectSegment(selectionStart, selectionEnd);
    }
  };

  return (
    <div className="space-y-3">
      {/* Zoom controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
            disabled={zoomLevel <= 1}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-sm transition-colors"
          >
            Zoom Out
          </button>
          <span className="text-sm text-gray-400 min-w-[60px] text-center">
            {zoomLevel}x
          </span>
          <button
            onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.5))}
            disabled={zoomLevel >= 4}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded text-sm transition-colors"
          >
            Zoom In
          </button>
        </div>
        <div className="text-xs text-gray-400">
          Drag handles to adjust length • Drag bracket to move • Min 4 bars
        </div>
      </div>

      {/* Scrollable canvas container */}
      <div
        ref={containerRef}
        className="overflow-x-auto bg-slate-900 rounded-lg"
        style={{ maxWidth: '100%' }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={150}
          className="h-32 cursor-pointer"
          style={{ minWidth: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      <div className="text-xs text-gray-400 text-center">
        Total: {totalBars} bars recorded • Selected: bars {selectionStart + 1}-{selectionEnd} ({selectionEnd - selectionStart} bars)
      </div>
    </div>
  );
}
