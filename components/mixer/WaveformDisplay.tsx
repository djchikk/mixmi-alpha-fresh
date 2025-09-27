'use client'
import React, { useRef, useEffect, useState, useMemo, memo } from 'react'
import { useDebouncedCallback } from '@/hooks/useDebounce'

// Types from our content-aware system
interface LoopBoundaries {
  contentStart: number;
  contentEnd: number;
  mathematicalDuration: number;
  actualLoopDuration: number;
  confidence: number;
}

interface WaveformDisplayProps {
  audioBuffer?: AudioBuffer;
  loopBoundaries?: LoopBoundaries | null;
  currentTime?: number;
  isPlaying?: boolean;
  className?: string;
  width?: number;
  height?: number;
  // 🎯 NEW: Loop position props for draggable brackets
  trackBPM?: number;
  loopEnabled?: boolean;
  loopLength?: number;
  loopPosition?: number;
  onLoopPositionChange?: (position: number) => void;
  waveformColor?: string; // Custom waveform color
}

const WaveformDisplay = memo(function WaveformDisplay({
  audioBuffer,
  loopBoundaries,
  currentTime = 0,
  isPlaying = false,
  className = '',
  width = 800,
  height = 120,
  // 🎯 NEW: Loop position props
  trackBPM = 120,
  loopEnabled = false,
  loopLength = 8,
  loopPosition = 0,
  onLoopPositionChange,
  waveformColor = '#64748B' // Default slate gray
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveformData, setWaveformData] = useState<Float32Array | null>(null);
  const [frequencyColors, setFrequencyColors] = useState<string[] | null>(null);
  
  // 🎯 NEW: Drag state for loop position brackets
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartPosition, setDragStartPosition] = useState(0);
  const [localLoopPosition, setLocalLoopPosition] = useState(loopPosition);
  
  // Debounced position change for smooth dragging
  const debouncedLoopPositionChange = useDebouncedCallback(
    onLoopPositionChange ? onLoopPositionChange : () => {},
    30
  );
  
  // Sync local position with prop changes
  useEffect(() => {
    setLocalLoopPosition(loopPosition);
  }, [loopPosition]);

  // 🎯 NEW: Contextual brackets logic - only show when needed
  const showLoopBrackets = loopEnabled && loopLength !== 8;
  
  // 🎯 NEW: Calculate bracket positions from bar timing (memoized)
  const bracketPositions = useMemo(() => {
    if (!audioBuffer || !showLoopBrackets) return null;
    
    const barDuration = (60 / trackBPM) * 4; // 4 beats per bar
    const totalDuration = audioBuffer.duration;
    
    const loopStartTime = localLoopPosition * barDuration;
    const loopEndTime = (localLoopPosition + loopLength) * barDuration;
    
    const startX = (loopStartTime / totalDuration) * width;
    const endX = (loopEndTime / totalDuration) * width;
    
    return {
      startX: Math.max(0, Math.min(width, startX)),
      endX: Math.max(0, Math.min(width, endX)),
      loopStartTime,
      loopEndTime
    };
  }, [audioBuffer, showLoopBrackets, trackBPM, localLoopPosition, loopLength, width]);

  // 🎯 NEW: Mouse event handlers for bracket dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!showLoopBrackets || !onLoopPositionChange) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const brackets = bracketPositions;
    
    if (brackets) {
      // Check if click is within the bracket region
      const bracketWidth = brackets.endX - brackets.startX;
      const margin = 10; // Allow clicking slightly outside for easier grabbing
      
      if (x >= brackets.startX - margin && x <= brackets.endX + margin) {
        setIsDragging(true);
        setDragStartX(x);
        setDragStartPosition(loopPosition);
        e.preventDefault();
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !onLoopPositionChange || !audioBuffer) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const deltaX = x - dragStartX;
    
    // Convert pixel movement to bar movement
    const totalDuration = audioBuffer.duration;
    const barDuration = (60 / trackBPM) * 4;
    const deltaTime = (deltaX / width) * totalDuration;
    const deltaBars = deltaTime / barDuration;
    
    // Calculate new position with beat-level quantization (0.25 bar increments)
    const newPosition = Math.max(0, Math.round((dragStartPosition + deltaBars) * 4) / 4);
    const maxPosition = Math.max(0, Math.floor(totalDuration / barDuration) - loopLength);
    
    const clampedPosition = Math.min(newPosition, maxPosition);
    
    if (clampedPosition !== loopPosition) {
      onLoopPositionChange(clampedPosition);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // 🎨 Frequency-based color analysis
  const analyzeFrequencyColors = (audioBuffer: AudioBuffer, numPixels: number): string[] => {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const samplesPerPixel = Math.ceil(channelData.length / numPixels);

    const colors: string[] = [];

    // For each pixel, analyze dominant frequency
    for (let i = 0; i < numPixels; i++) {
      const startSample = i * samplesPerPixel;
      const endSample = Math.min(startSample + samplesPerPixel, channelData.length);

      // Calculate frequency distribution for this chunk
      const chunkData = channelData.slice(startSample, endSample);
      const color = analyzeChunkFrequency(chunkData, sampleRate);
      colors.push(color);
    }

    return colors;
  };

  // Analyze frequency content of a chunk and return appropriate color
  const analyzeChunkFrequency = (chunk: Float32Array, sampleRate: number): string => {
    // Perform FFT analysis on the chunk
    // For performance, we'll use a simplified spectral analysis

    // Calculate energy in different frequency bands
    let bassEnergy = 0;
    let midEnergy = 0;
    let highEnergy = 0;

    // Use a simple frequency estimation based on zero-crossing rate and spectral centroid
    let zeroCrossings = 0;
    let spectralSum = 0;
    let totalEnergy = 0;

    for (let i = 1; i < chunk.length; i++) {
      // Zero crossing rate (indicates high frequency content)
      if ((chunk[i - 1] >= 0 && chunk[i] < 0) || (chunk[i - 1] < 0 && chunk[i] >= 0)) {
        zeroCrossings++;
      }

      // Energy calculation
      const energy = chunk[i] * chunk[i];
      totalEnergy += energy;

      // Spectral centroid approximation
      spectralSum += energy * i;
    }

    if (totalEnergy === 0) {
      // Silence - use bass color
      return '#FF6B6B';
    }

    // Estimate dominant frequency based on zero-crossing rate
    const zcr = zeroCrossings / chunk.length;
    const estimatedFreq = (zcr * sampleRate) / 2;

    // Classify into frequency bands
    if (estimatedFreq < 250) {
      // Bass frequencies (20-250Hz): Red/Orange
      const ratio = Math.min(estimatedFreq / 250, 1);
      return interpolateColor('#FF6B6B', '#FF8866', ratio);
    } else if (estimatedFreq < 4000) {
      // Mid frequencies (250-4kHz): Amber/Gold
      const ratio = (estimatedFreq - 250) / (4000 - 250);
      return interpolateColor('#FFB366', '#FFD966', ratio);
    } else {
      // High frequencies (4kHz+): Blue/Cyan
      const ratio = Math.min((estimatedFreq - 4000) / 12000, 1);
      return interpolateColor('#66B3FF', '#81E4F2', ratio);
    }
  };

  // Interpolate between two hex colors
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

  // Extract and downsample waveform data for performance
  useEffect(() => {
    if (!audioBuffer) {
      setWaveformData(null);
      setFrequencyColors(null);
      return;
    }

    const extractWaveformData = () => {
      const channelData = audioBuffer.getChannelData(0); // Use first channel
      const sampleRate = audioBuffer.sampleRate;
      const duration = audioBuffer.duration;
      
      // Downsample to reasonable resolution (1 pixel per sample group)
      const samplesPerPixel = Math.ceil(channelData.length / width);
      const waveform = new Float32Array(width);
      
      // Extract RMS values for each pixel
      for (let i = 0; i < width; i++) {
        const startSample = i * samplesPerPixel;
        const endSample = Math.min(startSample + samplesPerPixel, channelData.length);
        
        let sum = 0;
        let count = 0;
        for (let j = startSample; j < endSample; j++) {
          sum += channelData[j] * channelData[j];
          count++;
        }
        
        // RMS calculation for more accurate amplitude representation
        waveform[i] = count > 0 ? Math.sqrt(sum / count) : 0;
      }
      
      setWaveformData(waveform);
      console.log(`🎨 Waveform extracted: ${width} samples, duration: ${duration.toFixed(2)}s`);

      // 🎨 Analyze frequency colors
      console.log('🎨 Starting frequency analysis...');
      const colors = analyzeFrequencyColors(audioBuffer, width);
      setFrequencyColors(colors);
      console.log(`🎨 Frequency colors analyzed: ${colors.length} colors`);
    };

    extractWaveformData();
  }, [audioBuffer, width]);

  // Draw waveform and overlays
  useEffect(() => {
    if (!waveformData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.fillStyle = '#0A0A0B'; // Dark background matching mixer
    ctx.fillRect(0, 0, width, height);

    const centerY = height / 2;
    const maxAmplitude = Math.max(...Array.from(waveformData));
    const amplitudeScale = maxAmplitude > 0 ? (height * 0.4) / maxAmplitude : 1;

    // 🎵 Draw content boundaries if available
    if (loopBoundaries && audioBuffer) {
      const duration = audioBuffer.duration;
      const pixelsPerSecond = width / duration;
      
      // Content start/end positions
      const contentStartX = loopBoundaries.contentStart * pixelsPerSecond;
      const contentEndX = loopBoundaries.contentEnd * pixelsPerSecond;
      const actualLoopEndX = (loopBoundaries.contentStart + loopBoundaries.actualLoopDuration) * pixelsPerSecond;
      
      // Draw silence regions (if any)
      if (contentStartX > 0) {
        ctx.fillStyle = '#FF4444AA'; // Red tint for leading silence
        ctx.fillRect(0, 0, contentStartX, height);
      }
      
      if (contentEndX < width) {
        ctx.fillStyle = '#FF4444AA'; // Red tint for trailing silence  
        ctx.fillRect(contentEndX, 0, width - contentEndX, height);
      }
      
      // Draw actual loop boundary
      ctx.strokeStyle = '#00FFFF'; // Cyan for actual loop boundary
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(actualLoopEndX, 0);
      ctx.lineTo(actualLoopEndX, height);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Content boundary markers
      ctx.strokeStyle = '#FFD700'; // Gold for content boundaries
      ctx.lineWidth = 1;
      
      // Content start line
      ctx.beginPath();
      ctx.moveTo(contentStartX, 0);
      ctx.lineTo(contentStartX, height);
      ctx.stroke();
      
      // Content end line
      ctx.beginPath();
      ctx.moveTo(contentEndX, 0);
      ctx.lineTo(contentEndX, height);
      ctx.stroke();
    }

    // 🎵 Draw waveform with frequency-based colors
    if (frequencyColors && frequencyColors.length === waveformData.length) {
      // Draw with frequency-based colors (per-bar coloring for smooth effect)
      for (let i = 0; i < waveformData.length; i++) {
        const x = (i / waveformData.length) * width;
        const nextX = ((i + 1) / waveformData.length) * width;
        const amplitude = waveformData[i] * amplitudeScale;
        const color = frequencyColors[i];

        // Draw filled bar with frequency color
        ctx.fillStyle = color + '80'; // Add alpha for semi-transparent fill
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x, centerY - amplitude);
        ctx.lineTo(nextX, centerY - amplitude);
        ctx.lineTo(nextX, centerY + amplitude);
        ctx.lineTo(x, centerY + amplitude);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // Fallback to solid color if frequency analysis not available
      ctx.fillStyle = waveformColor + '80'; // Add alpha for semi-transparent fill
      ctx.strokeStyle = waveformColor;
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let i = 0; i < waveformData.length; i++) {
        const x = (i / waveformData.length) * width;
        const amplitude = waveformData[i] * amplitudeScale;

        if (i === 0) {
          ctx.moveTo(x, centerY - amplitude);
        } else {
          ctx.lineTo(x, centerY - amplitude);
        }
      }

      // Draw bottom half (mirrored)
      for (let i = waveformData.length - 1; i >= 0; i--) {
        const x = (i / waveformData.length) * width;
        const amplitude = waveformData[i] * amplitudeScale;
        ctx.lineTo(x, centerY + amplitude);
      }

      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 🎯 NEW: Draw clearly visible timing grid (8 bars per track)
    if (audioBuffer) {
      ctx.strokeStyle = '#9CA3AF'; // Lighter, more visible gray for bar markers
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.8; // Much more visible!
      
      // Draw 7 bar division lines (8 bars = 7 divisions) 
      for (let bar = 1; bar < 8; bar++) {
        const barX = (bar / 8) * width;
        ctx.beginPath();
        ctx.moveTo(barX, 0);
        ctx.lineTo(barX, height);
        ctx.stroke();
      }
      
      // Draw visible beat markers (4 beats per bar)
      ctx.strokeStyle = '#9CA3AF';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4; // More visible beat divisions
      
      for (let bar = 0; bar < 8; bar++) {
        for (let beat = 1; beat < 4; beat++) { // 3 beat lines per bar (excluding downbeat)
          const beatX = ((bar + beat/4) / 8) * width;
          ctx.beginPath();
          ctx.moveTo(beatX, height * 0.25); // Shorter lines for beats
          ctx.lineTo(beatX, height * 0.75);
          ctx.stroke();
        }
      }
      
      // Reset alpha for other elements
      ctx.globalAlpha = 1.0;
    }

    // 🎵 Draw playback position
    if (isPlaying && audioBuffer) {
      const duration = audioBuffer.duration;
      const playbackX = (currentTime / duration) * width;
      
      ctx.strokeStyle = '#00FF00'; // Green playback line
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playbackX, 0);
      ctx.lineTo(playbackX, height);
      ctx.stroke();
    }

    // 🎯 REMOVED: Debug strategy indicators - keeping clean professional look

    // 🎯 NEW: Draw contextual loop brackets (only when enabled and not 8-bar)
    const brackets = bracketPositions;
    if (brackets && showLoopBrackets) {
      const { startX, endX } = brackets;
      const bracketHeight = 8;
      const topY = 5;
      const bottomY = height - 5;
      
      // Bracket styling
      ctx.strokeStyle = isDragging ? '#00FFFF' : '#FFA500'; // Cyan when dragging, orange when idle
      ctx.fillStyle = ctx.strokeStyle + '20'; // Semi-transparent fill
      ctx.lineWidth = 2;
      
      // Fill bracket region
      ctx.fillRect(startX, 0, endX - startX, height);
      
      // Draw bracket lines
      ctx.beginPath();
      
      // Left bracket
      ctx.moveTo(startX, topY);
      ctx.lineTo(startX, topY + bracketHeight);
      ctx.moveTo(startX, topY);
      ctx.lineTo(startX + bracketHeight, topY);
      
      ctx.moveTo(startX, bottomY);
      ctx.lineTo(startX, bottomY - bracketHeight);
      ctx.moveTo(startX, bottomY);
      ctx.lineTo(startX + bracketHeight, bottomY);
      
      // Right bracket
      ctx.moveTo(endX, topY);
      ctx.lineTo(endX, topY + bracketHeight);
      ctx.moveTo(endX, topY);
      ctx.lineTo(endX - bracketHeight, topY);
      
      ctx.moveTo(endX, bottomY);
      ctx.lineTo(endX, bottomY - bracketHeight);
      ctx.moveTo(endX, bottomY);
      ctx.lineTo(endX - bracketHeight, bottomY);
      
      ctx.stroke();
      
      // Draw position label with beat precision
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      
      // Format position with beat precision
      const formatPosition = (pos: number) => {
        const bars = Math.floor(pos);
        const beats = Math.round((pos - bars) * 4);
        return beats === 0 ? `${bars + 1}` : `${bars + 1}.${beats}`;
      };
      
      const startPos = formatPosition(localLoopPosition);
      const endPos = formatPosition(localLoopPosition + loopLength);
      const loopText = loopLength < 1 ? `${loopLength * 4}/4` : loopLength;
      const labelText = `${loopText}-bar loop @ ${startPos}-${endPos}`;
      const labelX = (startX + endX) / 2;
      ctx.fillText(labelText, labelX, height - 15);
    }

  }, [waveformData, frequencyColors, loopBoundaries, currentTime, isPlaying, width, height, audioBuffer, showLoopBrackets, loopPosition, loopLength, isDragging, waveformColor]);

  // Get human-readable strategy description
  const getStrategyText = (boundaries: LoopBoundaries): string => {
    const mathDuration = boundaries.mathematicalDuration;
    const actualDuration = boundaries.actualLoopDuration;
    const confidence = boundaries.confidence;
    
    if (confidence > 0.8 && Math.abs(actualDuration - mathDuration) / mathDuration < 0.1) {
      return 'Strategy: Mathematical BPM';
    } else if (actualDuration < mathDuration * 0.8) {
      return 'Strategy: Content-trimmed';
    } else if (actualDuration < mathDuration * 0.9) {
      return 'Strategy: File-length limited';
    } else {
      return 'Strategy: Mathematical fallback';
    }
  };

  if (!audioBuffer) {
    return (
      <div className={`flex items-center justify-center bg-slate-900 rounded ${className}`} 
           style={{ width, height }}>
        <span className="text-slate-500 text-sm">No audio loaded</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <canvas 
        ref={canvasRef}
        className={`rounded border border-slate-700 ${showLoopBrackets && onLoopPositionChange ? 'cursor-pointer' : ''}`}
        style={{ width, height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* 🎯 HIDDEN: Legend overlay - keeping clean professional look */}
      {/* Uncomment below for diagnostics if needed:
      <div className="absolute top-2 right-2 text-xs text-slate-400 bg-black/50 rounded p-2">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-0.5 bg-yellow-500"></div>
          <span>Content boundaries</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-0.5 bg-cyan-500 border-dashed"></div>
          <span>Actual loop end</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-0.5 h-3 bg-gray-500 opacity-30"></div>
          <span>Bar markers (8-bar structure)</span>
        </div>
        {isPlaying && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-500"></div>
            <span>Playback position</span>
          </div>
        )}
      </div>
      */}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Only re-render if these specific props change
  return (
    prevProps.audioBuffer === nextProps.audioBuffer &&
    prevProps.currentTime === nextProps.currentTime &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.loopEnabled === nextProps.loopEnabled &&
    prevProps.loopPosition === nextProps.loopPosition &&
    prevProps.loopLength === nextProps.loopLength &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.waveformColor === nextProps.waveformColor
  );
});

export default WaveformDisplay; 