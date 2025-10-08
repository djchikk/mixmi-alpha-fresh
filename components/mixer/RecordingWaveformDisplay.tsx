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

    const width = canvas.width;
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

    // Draw waveform
    const centerY = height / 2;
    ctx.strokeStyle = '#81E4F2';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < waveformData.length; x++) {
      const amplitude = waveformData[x] * (height / 2 - 10);
      ctx.moveTo(x, centerY - amplitude);
      ctx.lineTo(x, centerY + amplitude);
    }
    ctx.stroke();

    // Draw bar lines
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    for (let bar = 0; bar <= totalBars; bar++) {
      const x = (bar / totalBars) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();

      // Bar numbers (every 8 bars for cycles)
      if (bar % 8 === 0 && bar < totalBars) {
        ctx.fillStyle = '#718096';
        ctx.font = '11px monospace';
        ctx.fillText(`Cycle ${bar / 8 + 1}`, x + 3, 12);
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

    // Selection label
    ctx.fillStyle = '#81E4F2';
    ctx.font = 'bold 12px monospace';
    const labelText = `8 BARS (${selectionStart + 1}-${selectionEnd})`;
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

  }, [audioBuffer, selectionStart, selectionEnd, totalBars, isPlaying, currentTime, totalDuration, bpm]);

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
    const bar = Math.max(0, Math.min(totalBars, Math.floor((x / rect.width) * totalBars)));

    if (dragType === 'start') {
      const newStart = Math.min(bar, selectionEnd - 8);
      setSelectionStart(newStart);
    } else if (dragType === 'end') {
      const newEnd = Math.max(bar, selectionStart + 8);
      setSelectionEnd(newEnd);
    } else if (dragType === 'move') {
      const selectionLength = selectionEnd - selectionStart;
      const newStart = Math.max(0, Math.min(totalBars - selectionLength, bar - Math.floor(selectionLength / 2)));
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
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={150}
        className="w-full h-32 bg-slate-900 rounded-lg cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="mt-2 text-xs text-gray-400 text-center">
        Drag the bracket to select which 8 bars to save • Total: {totalBars} bars recorded
      </div>
    </div>
  );
}
