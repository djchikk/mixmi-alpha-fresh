"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';

interface WaveformSelectorProps {
  audioUrl: string;
  totalBars: number;
  bpm: number;
  actualDuration?: number; // Actual recording duration in seconds
  onSelectSegment: (startBar: number, endBar: number) => void;
}

export default function WaveformSelector({
  audioUrl,
  totalBars,
  bpm,
  actualDuration,
  onSelectSegment
}: WaveformSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actualRecordingDuration, setActualRecordingDuration] = useState<number>(0);
  
  // Selection state
  const [selectionStart, setSelectionStart] = useState(0); // Start bar (0-based)
  const [selectionEnd, setSelectionEnd] = useState(8); // End bar (exclusive, so 8 means bars 0-7)
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'move' | null>(null);
  
  // Preview state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Calculate timing
  const beatsPerBar = 4;
  const beatsPerSecond = bpm / 60;
  const secondsPerBar = beatsPerBar / beatsPerSecond;
  const totalDuration = totalBars * secondsPerBar;

  // Load and decode audio
  useEffect(() => {
    const loadAudio = async () => {
      try {
        setIsLoading(true);
        
        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        // Fetch and decode audio
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        setAudioBuffer(decodedBuffer);
        
        // Store actual recording duration
        setActualRecordingDuration(actualDuration || decodedBuffer.duration);
        
        // Create audio element for playback
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        // Update current time during playback
        audio.addEventListener('timeupdate', () => {
          setCurrentTime(audio.currentTime);
        });
        
        audio.addEventListener('ended', () => {
          setIsPlaying(false);
          setCurrentTime(0);
        });
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load audio:', error);
        setIsLoading(false);
      }
    };
    
    loadAudio();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.remove();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioUrl, actualDuration]);

  // Draw waveform
  useEffect(() => {
    if (!audioBuffer || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Calculate where the actual recording ends on the canvas
    const actualRecordingBars = actualRecordingDuration / secondsPerBar;
    const actualRecordingEndX = (actualRecordingBars / totalBars) * canvas.width;
    
    // Extract waveform data
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPixel = Math.floor(channelData.length / actualRecordingEndX);
    const waveformData: number[] = [];
    
    // Process actual recording data
    for (let x = 0; x < actualRecordingEndX; x++) {
      const startSample = x * samplesPerPixel;
      const endSample = Math.min(startSample + samplesPerPixel, channelData.length);
      
      let max = 0;
      for (let i = startSample; i < endSample; i++) {
        const abs = Math.abs(channelData[i]);
        if (abs > max) max = abs;
      }
      waveformData.push(max);
    }
    
    // Fill the rest with silence (0 values)
    for (let x = actualRecordingEndX; x < canvas.width; x++) {
      waveformData.push(0);
    }
    
    // Draw waveform
    const centerY = canvas.height / 2;
    
    // Draw actual recording waveform
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let x = 0; x < Math.min(actualRecordingEndX, waveformData.length); x++) {
      const amplitude = waveformData[x] * (canvas.height / 2 - 10);
      
      ctx.moveTo(x, centerY - amplitude);
      ctx.lineTo(x, centerY + amplitude);
    }
    ctx.stroke();
    
    // Draw silence line for the rest
    if (actualRecordingEndX < canvas.width) {
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(actualRecordingEndX, centerY);
      ctx.lineTo(canvas.width, centerY);
      ctx.stroke();
      
      // Add a visual indicator where recording ended
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(actualRecordingEndX, 0);
      ctx.lineTo(actualRecordingEndX, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Add text label
      ctx.fillStyle = '#FF6B6B';
      ctx.font = '11px monospace';
      ctx.fillText('Recording ended', actualRecordingEndX + 5, 20);
    }
    
    // Draw bar lines
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    for (let bar = 0; bar <= totalBars; bar++) {
      const x = (bar / totalBars) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
      
      // Bar numbers
      if (bar % 4 === 0 && bar < totalBars) {
        ctx.fillStyle = '#718096';
        ctx.font = '11px monospace';
        ctx.fillText(`${bar + 1}`, x + 3, 12);
      }
    }
    
    // Draw selection
    const selectionStartX = (selectionStart / totalBars) * canvas.width;
    const selectionEndX = (selectionEnd / totalBars) * canvas.width;
    
    // Selection background
    ctx.fillStyle = 'rgba(129, 228, 242, 0.1)';
    ctx.fillRect(selectionStartX, 0, selectionEndX - selectionStartX, canvas.height);
    
    // Selection borders
    ctx.strokeStyle = '#81E4F2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(selectionStartX, 0);
    ctx.lineTo(selectionStartX, canvas.height);
    ctx.moveTo(selectionEndX, 0);
    ctx.lineTo(selectionEndX, canvas.height);
    ctx.stroke();
    
    // Selection handles
    const handleWidth = 8;
    const handleHeight = 20;
    
    // Start handle
    ctx.fillStyle = '#81E4F2';
    ctx.fillRect(selectionStartX - handleWidth / 2, centerY - handleHeight / 2, handleWidth, handleHeight);
    
    // End handle
    ctx.fillRect(selectionEndX - handleWidth / 2, centerY - handleHeight / 2, handleWidth, handleHeight);
    
    // Current playback position
    if (isPlaying && currentTime > 0) {
      const playbackX = (currentTime / totalDuration) * canvas.width;
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playbackX, 0);
      ctx.lineTo(playbackX, canvas.height);
      ctx.stroke();
    }
    
  }, [audioBuffer, selectionStart, selectionEnd, totalBars, isPlaying, currentTime, totalDuration, actualRecordingDuration, secondsPerBar]);

  // Handle mouse events for selection
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bar = Math.floor((x / rect.width) * totalBars);
    
    // Check if clicking on handles
    const selectionStartX = (selectionStart / totalBars) * rect.width;
    const selectionEndX = (selectionEnd / totalBars) * rect.width;
    
    const handleTolerance = 10;
    
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
      const newStart = Math.min(bar, selectionEnd - 1);
      setSelectionStart(newStart);
    } else if (dragType === 'end') {
      // Don't allow selection beyond actual recording
      const maxBar = Math.floor(actualRecordingDuration / secondsPerBar);
      const newEnd = Math.min(Math.max(bar, selectionStart + 1), maxBar);
      setSelectionEnd(newEnd);
    } else if (dragType === 'move') {
      const selectionLength = selectionEnd - selectionStart;
      const maxBar = Math.floor(actualRecordingDuration / secondsPerBar);
      const newStart = Math.max(0, Math.min(maxBar - selectionLength, bar - Math.floor(selectionLength / 2)));
      setSelectionStart(newStart);
      setSelectionEnd(Math.min(newStart + selectionLength, maxBar));
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragType(null);
      onSelectSegment(selectionStart, selectionEnd);
    }
  };

  // Preview controls
  const handlePreview = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Start playback from selection start
      const startTime = selectionStart * secondsPerBar;
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
      setIsPlaying(true);
      
      // Auto-stop at selection end
      const endTime = selectionEnd * secondsPerBar;
      const duration = endTime - startTime;
      
      setTimeout(() => {
        if (audioRef.current && isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      }, duration * 1000);
    }
  };

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-400">Loading waveform...</div>
        </div>
      ) : (
        <>
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
          </div>
          
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Selected: Bars {selectionStart + 1}-{selectionEnd} ({selectionEnd - selectionStart} bars)
            </div>
            
            <button
              onClick={handlePreview}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              Preview Selection
            </button>
          </div>
        </>
      )}
    </div>
  );
}