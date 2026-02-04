"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Play, Square, Repeat, Info, X,
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut
} from 'lucide-react';
import RecordingWaveform from './RecordingWaveform';
import { RecordingData, TrimState, RecordingCostInfo } from '@/hooks/useMixerRecording';
import { IPTrack } from '@/types';
import { PRICING } from '@/config/pricing';
import { barsToSeconds } from '@/lib/recording/paymentCalculation';

interface RemixStepTrimProps {
  recordingData: RecordingData;
  trimState: TrimState;
  costInfo: RecordingCostInfo;
  loadedTracks: IPTrack[];
  onTrimStartChange: (bars: number) => void;
  onTrimEndChange: (bars: number) => void;
  onNudge: (point: 'start' | 'end', direction: 'left' | 'right', resolution: number) => void;
}

type Resolution = '1bar' | '1beat' | '1/16';

export default function RemixStepTrim({
  recordingData,
  trimState,
  costInfo,
  loadedTracks,
  onTrimStartChange,
  onTrimEndChange,
  onNudge,
}: RemixStepTrimProps) {
  const { waveformData, bpm, audioBuffer } = recordingData;
  const { startBars: trimStartBars, endBars: trimEndBars, totalBars } = trimState;

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playingBlock, setPlayingBlock] = useState<number | 'all' | null>(null);

  // UI state
  const [resolution, setResolution] = useState<Resolution>('1bar');
  const [showInfo, setShowInfo] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = fit to width, >1 = zoomed in

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const loopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const barsPerBlock = PRICING.remix.barsPerBlock;
  const selectedBars = trimEndBars - trimStartBars;
  const blockCount = Math.ceil(selectedBars / barsPerBlock);

  // Resolution value in bars
  const getResolutionValue = (): number => {
    switch (resolution) {
      case '1bar': return 1;
      case '1beat': return 0.25;
      case '1/16': return 0.0625;
      default: return 1;
    }
  };

  // Get AudioContext with matching sample rate
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: audioBuffer.sampleRate });
    }
    return audioContextRef.current;
  }, [audioBuffer.sampleRate]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    setPlayingBlock(null);
    setIsPlaying(false);
    setPlaybackPosition(0);
  }, []);

  // Play selection (optionally looping)
  const playSelection = useCallback((loop: boolean = false) => {
    stopPlayback();

    const audioContext = getAudioContext();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const startSeconds = barsToSeconds(trimStartBars, bpm);
    const endSeconds = barsToSeconds(trimEndBars, bpm);
    const duration = endSeconds - startSeconds;

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    source.onended = () => {
      if (loop && isLooping) {
        // Schedule next loop iteration
        loopTimeoutRef.current = setTimeout(() => {
          playSelection(true);
        }, 50); // Small gap between loops
      } else {
        setPlayingBlock(null);
        setIsPlaying(false);
        setPlaybackPosition(0);
      }
    };

    sourceNodeRef.current = source;
    startTimeRef.current = audioContext.currentTime;

    source.start(0, startSeconds, duration);
    setPlayingBlock('all');
    setIsPlaying(true);

    // Update playback position animation
    const updatePosition = () => {
      if (!sourceNodeRef.current) return;

      const elapsed = audioContext.currentTime - startTimeRef.current;
      const normalizedPosition = elapsed / duration;

      setPlaybackPosition(Math.min(normalizedPosition, 1));

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(updatePosition);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);
  }, [audioBuffer, bpm, trimStartBars, trimEndBars, stopPlayback, getAudioContext, isLooping]);

  // Play a specific block
  const playBlock = useCallback((blockNum: number) => {
    stopPlayback();

    const audioContext = getAudioContext();
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const blockStartBars = trimStartBars + (blockNum - 1) * barsPerBlock;
    const blockEndBars = Math.min(blockStartBars + barsPerBlock, trimEndBars);

    const startSeconds = barsToSeconds(blockStartBars, bpm);
    const endSeconds = barsToSeconds(blockEndBars, bpm);
    const duration = endSeconds - startSeconds;

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    source.onended = () => {
      setPlayingBlock(null);
      setIsPlaying(false);
      setPlaybackPosition(0);
    };

    sourceNodeRef.current = source;
    startTimeRef.current = audioContext.currentTime;

    source.start(0, startSeconds, duration);
    setPlayingBlock(blockNum);
    setIsPlaying(true);

    // Update playback position
    const totalDuration = barsToSeconds(selectedBars, bpm);
    const updatePosition = () => {
      if (!sourceNodeRef.current) return;

      const elapsed = audioContext.currentTime - startTimeRef.current;
      const positionInSelection = barsToSeconds(blockStartBars - trimStartBars, bpm) + elapsed;
      const normalizedPosition = positionInSelection / totalDuration;

      setPlaybackPosition(Math.min(normalizedPosition, 1));

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(updatePosition);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);
  }, [audioBuffer, bpm, trimStartBars, trimEndBars, selectedBars, barsPerBlock, stopPlayback, getAudioContext]);

  // Toggle loop mode
  const toggleLoop = useCallback(() => {
    setIsLooping(prev => !prev);
    if (isPlaying && !isLooping) {
      // If we're playing and turning loop ON, restart with looping
      playSelection(true);
    }
  }, [isPlaying, isLooping, playSelection]);

  // Handle play/stop for ALL
  const handlePlayAll = useCallback(() => {
    if (playingBlock === 'all') {
      stopPlayback();
    } else {
      playSelection(isLooping);
    }
  }, [playingBlock, isLooping, playSelection, stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopPlayback]);

  // Calculate normalized playback position for waveform
  const selectionStart = trimStartBars / totalBars;
  const selectionEnd = trimEndBars / totalBars;
  const selectionDuration = selectionEnd - selectionStart;
  const normalizedWaveformPosition = selectionStart + playbackPosition * selectionDuration;

  return (
    <div className="remix-step-trim p-4 space-y-3">
      {/* Top Bar: BPM, Duration, Zoom */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="text-slate-400">
            <span className="font-bold text-[#81E4F2]">{bpm}</span> BPM
          </div>
          <div className="text-slate-400">
            Total: <span className="font-bold">{totalBars.toFixed(0)}</span> bars
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomLevel(Math.max(1, zoomLevel - 0.5))}
            disabled={zoomLevel <= 1}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-slate-500 w-10 text-center">{zoomLevel}x</span>
          <button
            onClick={() => setZoomLevel(Math.min(4, zoomLevel + 0.5))}
            disabled={zoomLevel >= 4}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 transition-all"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
        </div>
      </div>

      {/* Waveform - Compact height with horizontal scroll */}
      <div
        className="relative overflow-x-auto rounded-lg bg-slate-800/30"
        style={{ maxWidth: '100%' }}
      >
        <div style={{ width: `${100 * zoomLevel}%`, minWidth: '100%' }}>
          <RecordingWaveform
            waveformData={waveformData}
            bpm={bpm}
            totalBars={totalBars}
            trimStartBars={trimStartBars}
            trimEndBars={trimEndBars}
            onTrimStartChange={onTrimStartChange}
            onTrimEndChange={onTrimEndChange}
            playbackPosition={normalizedWaveformPosition}
            isPlaying={isPlaying}
            compactHeight={true}
          />
        </div>
      </div>

      {/* Preview Controls - Compact Row */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {/* Block buttons */}
        {Array.from({ length: blockCount }, (_, i) => i + 1).map((blockNum) => (
          <button
            key={blockNum}
            onClick={() => {
              if (playingBlock === blockNum) {
                stopPlayback();
              } else {
                playBlock(blockNum);
              }
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
              playingBlock === blockNum
                ? 'bg-[#81E4F2] text-slate-900 shadow-lg shadow-[#81E4F2]/50'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={`Preview block ${blockNum}`}
          >
            {playingBlock === blockNum ? (
              <Square size={10} fill="currentColor" />
            ) : (
              blockNum
            )}
          </button>
        ))}

        {blockCount > 0 && <div className="w-px h-6 bg-slate-600" />}

        {/* Play ALL button */}
        <button
          onClick={handlePlayAll}
          className={`px-3 h-8 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${
            playingBlock === 'all'
              ? 'bg-[#81E4F2] text-slate-900 shadow-lg shadow-[#81E4F2]/50'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="Preview entire selection"
        >
          {playingBlock === 'all' ? (
            <>
              <Square size={10} fill="currentColor" />
              STOP
            </>
          ) : (
            <>
              <Play size={10} fill="currentColor" />
              ALL
            </>
          )}
        </button>

        {/* Loop Toggle - CRITICAL FEATURE */}
        <button
          onClick={toggleLoop}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isLooping
              ? 'bg-[#A084F9] text-white shadow-lg shadow-[#A084F9]/50'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300'
          }`}
          title={isLooping ? 'Loop ON - click to disable' : 'Loop OFF - click to enable'}
        >
          <Repeat size={14} />
        </button>

        <div className="w-px h-6 bg-slate-600" />

        {/* Info Button */}
        <button
          onClick={() => setShowInfo(true)}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-300 transition-all"
          title="View source tracks & cost breakdown"
        >
          <Info size={14} />
        </button>
      </div>

      {/* Nudge Controls - Compact Single Row */}
      <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
        {/* IN Point */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500 uppercase w-6">IN</span>
          <button
            onClick={() => onNudge('start', 'left', getResolutionValue())}
            disabled={trimStartBars <= 0}
            className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="font-mono text-xs text-[#FBBF24] w-12 text-center">
            {trimStartBars.toFixed(resolution === '1bar' ? 0 : 2)}
          </span>
          <button
            onClick={() => onNudge('start', 'right', getResolutionValue())}
            disabled={trimStartBars >= trimEndBars - barsPerBlock}
            className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 transition-all"
          >
            <ChevronRight size={12} />
          </button>
        </div>

        {/* Resolution Selector */}
        <div className="flex items-center gap-1">
          {(['1bar', '1beat', '1/16'] as Resolution[]).map((res) => (
            <button
              key={res}
              onClick={() => setResolution(res)}
              className={`px-2 py-0.5 text-[9px] font-bold rounded transition-all ${
                resolution === res
                  ? 'bg-[#81E4F2] text-slate-900'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {res === '1bar' ? '1 BAR' : res === '1beat' ? '1 BEAT' : '1/16'}
            </button>
          ))}
        </div>

        {/* OUT Point */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNudge('end', 'left', getResolutionValue())}
            disabled={trimEndBars <= trimStartBars + barsPerBlock}
            className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={12} />
          </button>
          <span className="font-mono text-xs text-[#FBBF24] w-12 text-center">
            {trimEndBars.toFixed(resolution === '1bar' ? 0 : 2)}
          </span>
          <button
            onClick={() => onNudge('end', 'right', getResolutionValue())}
            disabled={trimEndBars >= totalBars}
            className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-30 transition-all"
          >
            <ChevronRight size={12} />
          </button>
          <span className="text-[10px] text-slate-500 uppercase w-6 text-right">OUT</span>
        </div>
      </div>

      {/* Selection Summary */}
      <div className="text-center">
        <span className="text-xs text-slate-400">Selection: </span>
        <span className="text-sm font-bold text-[#81E4F2]">
          {blockCount} block{blockCount !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-slate-500"> ({selectedBars.toFixed(0)} bars)</span>
        <span className="text-xs text-slate-400"> · </span>
        <span className="text-sm font-bold text-green-400">
          ${costInfo.totalCost.toFixed(2)}
        </span>
      </div>

      {/* Info Overlay/Drawer */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowInfo(false)}>
          <div
            className="bg-slate-800 rounded-xl p-4 max-w-md w-full shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Recording Info</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Source Tracks */}
            <div className="mb-3">
              <div className="text-xs text-slate-400 uppercase mb-2">Source Tracks ({loadedTracks.length})</div>
              <div className="space-y-1">
                {loadedTracks.map((track) => (
                  <div key={track.id} className="flex items-center gap-2 bg-slate-700/50 rounded px-2 py-1">
                    {track.cover_image_url && (
                      <img src={track.cover_image_url} alt="" className="w-6 h-6 rounded object-cover" />
                    )}
                    <span className="text-xs text-slate-300 flex-1 truncate">{track.title}</span>
                    <span className="text-[10px] text-slate-500">{track.bpm || '?'} BPM</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-slate-900/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase mb-2">Cost Breakdown</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Blocks:</span>
                  <span className="text-white">{costInfo.blocks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tracks:</span>
                  <span className="text-white">{loadedTracks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rate:</span>
                  <span className="text-white">${PRICING.remix.pricePerBlock.toFixed(2)} per block per track</span>
                </div>
                <div className="border-t border-slate-700 pt-1 mt-1 flex justify-between">
                  <span className="text-slate-300 font-bold">Total:</span>
                  <span className="text-green-400 font-bold">${costInfo.totalCost.toFixed(2)} USDC</span>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-2">
                Formula: {costInfo.blocks} × {loadedTracks.length} × ${PRICING.remix.pricePerBlock.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
