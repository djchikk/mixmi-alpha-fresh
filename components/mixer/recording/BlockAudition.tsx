"use client";

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Play, Square } from 'lucide-react';
import { PRICING } from '@/config/pricing';
import { barsToSeconds } from '@/lib/recording/paymentCalculation';
import { getAudioContext as getMixerAudioContext } from '@/lib/mixerAudio';

interface BlockAuditionProps {
  audioBuffer: AudioBuffer;
  bpm: number;
  trimStartBars: number;
  trimEndBars: number;
  onPlaybackPositionChange?: (position: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
}

export default function BlockAudition({
  audioBuffer,
  bpm,
  trimStartBars,
  trimEndBars,
  onPlaybackPositionChange,
  onPlayingChange,
}: BlockAuditionProps) {
  const [playingBlock, setPlayingBlock] = useState<number | null>(null);
  const [playingAll, setPlayingAll] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const barsPerBlock = PRICING.remix.barsPerBlock;
  const selectedBars = trimEndBars - trimStartBars;
  const blockCount = Math.ceil(selectedBars / barsPerBlock);

  // Get AudioContext - IMPORTANT: Use the mixer's AudioContext to avoid sample rate mismatch!
  // Creating a new AudioContext can result in different sample rates, causing playback speed issues.
  const getAudioContext = useCallback(() => {
    // Try to use the mixer's AudioContext first (same sample rate as the recording)
    const mixerContext = getMixerAudioContext();
    if (mixerContext) {
      return mixerContext;
    }
    // Fallback to creating our own (shouldn't normally happen)
    if (!audioContextRef.current) {
      // Match the audioBuffer's sample rate to avoid speed issues
      audioContextRef.current = new AudioContext({ sampleRate: audioBuffer.sampleRate });
      console.warn('⚠️ BlockAudition: Created fallback AudioContext at', audioBuffer.sampleRate, 'Hz');
    }
    return audioContextRef.current;
  }, [audioBuffer.sampleRate]);

  // Stop current playback
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
    setPlayingBlock(null);
    setPlayingAll(false);
    onPlaybackPositionChange?.(0);
    onPlayingChange?.(false);
  }, [onPlaybackPositionChange, onPlayingChange]);

  // Play a specific block (1-indexed)
  const playBlock = useCallback(
    (blockIndex: number) => {
      stopPlayback();

      const audioContext = getAudioContext();
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      // Calculate block boundaries in seconds
      const blockStartBars = trimStartBars + (blockIndex - 1) * barsPerBlock;
      const blockEndBars = Math.min(blockStartBars + barsPerBlock, trimEndBars);

      const startSeconds = barsToSeconds(blockStartBars, bpm);
      const endSeconds = barsToSeconds(blockEndBars, bpm);
      const duration = endSeconds - startSeconds;

      // Create and play source
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        setPlayingBlock(null);
        onPlaybackPositionChange?.(0);
        onPlayingChange?.(false);
      };

      sourceNodeRef.current = source;
      startTimeRef.current = audioContext.currentTime;

      source.start(0, startSeconds, duration);
      setPlayingBlock(blockIndex);
      onPlayingChange?.(true);

      // Update playback position
      const totalDuration = barsToSeconds(selectedBars, bpm);
      const updatePosition = () => {
        if (!sourceNodeRef.current) return;

        const elapsed = audioContext.currentTime - startTimeRef.current;
        const positionInSelection =
          barsToSeconds(blockStartBars - trimStartBars, bpm) + elapsed;
        const normalizedPosition = positionInSelection / totalDuration;

        onPlaybackPositionChange?.(Math.min(normalizedPosition, 1));

        if (elapsed < duration) {
          animationFrameRef.current = requestAnimationFrame(updatePosition);
        }
      };

      animationFrameRef.current = requestAnimationFrame(updatePosition);
    },
    [
      audioBuffer,
      bpm,
      trimStartBars,
      trimEndBars,
      selectedBars,
      barsPerBlock,
      stopPlayback,
      getAudioContext,
      onPlaybackPositionChange,
      onPlayingChange,
    ]
  );

  // Play all selected blocks
  const playAll = useCallback(() => {
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
      setPlayingAll(false);
      onPlaybackPositionChange?.(0);
      onPlayingChange?.(false);
    };

    sourceNodeRef.current = source;
    startTimeRef.current = audioContext.currentTime;

    source.start(0, startSeconds, duration);
    setPlayingAll(true);
    onPlayingChange?.(true);

    // Update playback position
    const updatePosition = () => {
      if (!sourceNodeRef.current) return;

      const elapsed = audioContext.currentTime - startTimeRef.current;
      const normalizedPosition = elapsed / duration;

      onPlaybackPositionChange?.(Math.min(normalizedPosition, 1));

      if (elapsed < duration) {
        animationFrameRef.current = requestAnimationFrame(updatePosition);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updatePosition);
  }, [
    audioBuffer,
    bpm,
    trimStartBars,
    trimEndBars,
    stopPlayback,
    getAudioContext,
    onPlaybackPositionChange,
    onPlayingChange,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      // Only close the AudioContext if we created a fallback one (not the mixer's)
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopPlayback]);

  return (
    <div className="block-audition bg-slate-800/50 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-2 text-center">Preview Blocks</div>

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {/* Individual block buttons */}
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
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold transition-all ${
              playingBlock === blockNum
                ? 'bg-[#81E4F2] text-slate-900 shadow-lg shadow-[#81E4F2]/50 animate-pulse'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={`Preview block ${blockNum}`}
          >
            {playingBlock === blockNum ? (
              <Square size={12} fill="currentColor" />
            ) : (
              blockNum
            )}
          </button>
        ))}

        {/* Divider */}
        {blockCount > 0 && (
          <div className="w-px h-8 bg-slate-600 mx-1" />
        )}

        {/* Play all button */}
        <button
          onClick={() => {
            if (playingAll) {
              stopPlayback();
            } else {
              playAll();
            }
          }}
          className={`px-4 h-10 rounded-lg flex items-center gap-2 text-sm font-bold transition-all ${
            playingAll
              ? 'bg-[#81E4F2] text-slate-900 shadow-lg shadow-[#81E4F2]/50 animate-pulse'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
          title="Preview entire selection"
        >
          {playingAll ? (
            <>
              <Square size={12} fill="currentColor" />
              STOP
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" />
              ALL
            </>
          )}
        </button>
      </div>
    </div>
  );
}
