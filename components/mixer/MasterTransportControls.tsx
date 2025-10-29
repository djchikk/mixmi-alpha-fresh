"use client";

import React, { useState, useEffect, useRef, memo } from 'react';

interface MasterTransportControlsProps {
  // Current mixer state
  deckALoaded: boolean;
  deckBLoaded: boolean;
  deckAPlaying: boolean;
  deckBPlaying: boolean;
  deckABPM: number;
  syncActive: boolean;
  recordingRemix: boolean;
  recordingRehearsal?: boolean; // NEW: Rehearsal state (waiting for second cycle)

  // Control handlers
  onMasterPlay: () => void;
  onMasterPlayAfterCountIn: () => void;
  onMasterStop: () => void;
  onReturnToStart: () => void;
  onRecordToggle: () => void;
  onSyncToggle: () => void;
  onMasterSyncReset: () => void;

  // Optional variant and BPM display
  variant?: 'full' | 'simplified';
  masterBPM?: number;

  className?: string;
}

const MasterTransportControls = memo(function MasterTransportControls({
  deckALoaded,
  deckBLoaded,
  deckAPlaying,
  deckBPlaying,
  deckABPM,
  syncActive,
  recordingRemix,
  recordingRehearsal = false,
  onMasterPlay,
  onMasterPlayAfterCountIn,
  onMasterStop,
  onReturnToStart,
  onRecordToggle,
  onSyncToggle,
  onMasterSyncReset,
  variant = 'full',
  masterBPM,
  className = ""
}: MasterTransportControlsProps) {
  const [countingIn, setCountingIn] = useState(false);
  const [countBeat, setCountBeat] = useState(0);
  const countTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate if any decks are playing
  const anyPlaying = deckAPlaying || deckBPlaying;
  
  // Calculate beat interval from Deck A BPM (always use Deck A as master for count-in)
  const beatInterval = (60 / deckABPM) * 1000; // milliseconds per beat

  // Fixed count-in effect - removed onMasterPlay from dependencies
  useEffect(() => {
    if (countingIn && countBeat > 0 && countBeat < 4) {
      console.log(`🎵 COUNT-IN: Beat ${countBeat}, next beat in ${beatInterval}ms`);
      countTimeoutRef.current = setTimeout(() => {
        setCountBeat(prev => prev + 1);
      }, beatInterval);
      
      return () => {
        if (countTimeoutRef.current) {
          clearTimeout(countTimeoutRef.current);
        }
      };
    } else if (countingIn && countBeat >= 4) {
      // Count-in complete, trigger actual play
      console.log('🎵 COUNT-IN: Complete! Triggering master play without count-in...');
      setCountingIn(false);
      setCountBeat(0);
      // Call the direct play function that bypasses count-in logic
      onMasterPlayAfterCountIn();
    }
  }, [countingIn, countBeat, beatInterval]); // Removed onMasterPlay dependency

  const handleMasterPlay = () => {
    if (anyPlaying) {
      // If anything is playing, pause everything and reset to beginning
      console.log('🎵 MASTER TRANSPORT: Pausing and resetting to beginning');
      onMasterStop();
    } else {
      // Start fresh with count-in sequence
      if (deckALoaded || deckBLoaded) {
        console.log(`🎵 MASTER TRANSPORT: Starting fresh 4-beat count-in at ${deckABPM} BPM`);
        setCountingIn(true);
        setCountBeat(1);
      }
    }
  };

  const handleMasterStop = () => {
    // Cancel count-in if active
    if (countingIn) {
      setCountingIn(false);
      setCountBeat(0);
      if (countTimeoutRef.current) {
        clearTimeout(countTimeoutRef.current);
      }
    }
    onMasterStop();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countTimeoutRef.current) {
        clearTimeout(countTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`master-transport-controls flex items-center justify-center gap-3 ${className}`}>
      {/* Count-In Display - positioned above controls, not overlapping */}
      {countingIn && (
        <div className="count-in-display absolute -top-12 left-1/2 transform -translate-x-1/2">
          <div className="text-2xl font-bold text-[#81E4F2] animate-pulse text-center">
            {countBeat}
          </div>
        </div>
      )}

      {/* Master Play/Pause Button */}
      <button
        onClick={handleMasterPlay}
        disabled={!deckALoaded && !deckBLoaded}
        className={`master-play-btn w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${
          anyPlaying
            ? 'bg-[#81E4F2] border-2 border-[#81E4F2] text-slate-900 shadow-lg shadow-[#81E4F2]/50 hover:bg-[#81E4F2]/80'
            : countingIn
            ? 'bg-[#81E4F2]/50 border-2 border-[#81E4F2] text-slate-900 animate-pulse cursor-wait'
            : deckALoaded || deckBLoaded
            ? 'border-2 border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2] hover:shadow-[#81E4F2]/20'
            : 'border-2 border-slate-700 text-slate-600 cursor-not-allowed'
        }`}
        title={
          countingIn
            ? `Counting in... ${countBeat}/4`
            : anyPlaying
            ? 'Pause & Reset to Beginning'
            : 'Play All (with count-in)'
        }
      >
        {countingIn ? (
          countBeat
        ) : anyPlaying ? (
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="4" height="18" rx="1" fill="currentColor"/>
            <rect x="10" y="0" width="4" height="18" rx="1" fill="currentColor"/>
          </svg>
        ) : (
          <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 1 L13 9 L2 17 Z" fill="currentColor"/>
          </svg>
        )}
      </button>

      {/* Return to Start Button */}
      <button
        onClick={onReturnToStart}
        disabled={!deckALoaded && !deckBLoaded}
        className={`return-to-start-btn w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          deckALoaded || deckBLoaded
            ? 'border-2 border-slate-600 text-slate-400 hover:border-[#81E4F2] hover:text-[#81E4F2]'
            : 'border-2 border-slate-700 text-slate-600 cursor-not-allowed'
        }`}
        title="Return to Start"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Double bar on left (return indicator) */}
          <rect x="2" y="3" width="1.5" height="10" fill="currentColor"/>
          <rect x="4" y="3" width="1.5" height="10" fill="currentColor"/>
          {/* Triangle pointing left */}
          <path d="M14 8L7 3.5V12.5L14 8Z" fill="currentColor"/>
        </svg>
      </button>

      {/* BPM Display for simplified variant */}
      {variant === 'simplified' && masterBPM && (
        <div className="flex flex-col items-center mx-3">
          <div className="text-2xl font-bold text-slate-200">
            {masterBPM}
          </div>
          <div className="text-[10px] text-slate-500 uppercase">BPM</div>
        </div>
      )}

      {/* Record Button */}
      <button
        onClick={onRecordToggle}
        className={`record-btn w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm transition-all relative ${
          recordingRemix
            ? 'bg-red-500 border-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
            : recordingRehearsal
            ? 'bg-[#81E4F2] border-[#81E4F2] text-white animate-pulse shadow-lg shadow-[#81E4F2]/50'
            : 'border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-500'
        }`}
        title={
          recordingRemix
            ? 'Stop Recording'
            : recordingRehearsal
            ? 'Cancel Recording (no save)'
            : 'Start Recording (with rehearsal cycle)'
        }
      >
        <div className={`w-3 h-3 rounded-full ${
          recordingRemix || recordingRehearsal ? 'bg-white' : 'bg-current'
        }`} />

        {/* Cancel text overlay for rehearsal state */}
        {recordingRehearsal && (
          <span className="absolute text-[9px] font-medium text-slate-800 uppercase tracking-tight">
            cancel
          </span>
        )}
      </button>

      {/* SYNC Button - moved into transport controls */}
      <button 
        onClick={onSyncToggle}
        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all uppercase tracking-wider ${
          syncActive
            ? 'bg-[#81E4F2] border-2 border-[#81E4F2] text-slate-900 hover:bg-[#81E4F2]/80 active:bg-[#81E4F2]/90 active:scale-95'
            : 'bg-black border-2 border-slate-400 text-slate-200 hover:bg-slate-600 hover:border-slate-300 hover:text-white active:bg-slate-900 active:scale-95'
        }`}
        title={syncActive ? 'Disable Sync' : 'Enable Sync'}
      >
        SYNC
      </button>

      <style jsx>{`
        .master-transport-controls {
          position: relative;
          padding: 12px 16px;
          background: rgba(30, 41, 59, 0.3);
          border: 1px solid rgba(71, 85, 105, 0.5);
          border-radius: 12px;
          backdrop-filter: blur(8px);
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .animate-pulse {
          animation: pulse 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
});

export default MasterTransportControls; 