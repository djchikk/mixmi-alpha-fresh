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
  
  // Control handlers
  onMasterPlay: () => void;
  onMasterPlayAfterCountIn: () => void;
  onMasterStop: () => void;
  onRecordToggle: () => void;
  onSyncToggle: () => void;
  onMasterSyncReset: () => void;
  
  // Optional variant and BPM display
  variant?: 'full' | 'simplified';
  masterBPM?: number;
  
  className?: string;
}

const MasterTransportControlsCompact = memo(function MasterTransportControlsCompact({
  deckALoaded,
  deckBLoaded,
  deckAPlaying,
  deckBPlaying,
  deckABPM,
  syncActive,
  recordingRemix,
  onMasterPlay,
  onMasterPlayAfterCountIn,
  onMasterStop,
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
    <div className={`master-transport-controls flex items-center justify-center gap-2 ${className}`}>
      {/* Count-In Display - positioned above controls, not overlapping */}
      {countingIn && (
        <div className="count-in-display absolute -top-12 left-1/2 transform -translate-x-1/2">
          <div className="text-xl font-bold text-cyan-400 animate-pulse text-center">
            {countBeat}
          </div>
        </div>
      )}

      {/* Master Play/Pause Button */}
      <button
        onClick={handleMasterPlay}
        disabled={!deckALoaded && !deckBLoaded}
        className={`master-play-btn w-10 h-10 rounded-full flex items-center justify-center text-base font-bold transition-all ${
          anyPlaying
            ? 'bg-cyan-400 border-2 border-cyan-400 text-slate-900 shadow-lg shadow-cyan-400/50 hover:bg-cyan-300'
            : countingIn
            ? 'bg-cyan-400/50 border-2 border-cyan-400 text-slate-900 animate-pulse cursor-wait'
            : deckALoaded || deckBLoaded
            ? 'border-2 border-slate-600 text-slate-400 hover:border-cyan-400 hover:text-cyan-400 hover:shadow-cyan-400/20'
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
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="3" y="2" width="3" height="10" />
            <rect x="8" y="2" width="3" height="10" />
          </svg>
        ) : (
          '▶'
        )}
      </button>

      {/* BPM Display for simplified variant */}
      {variant === 'simplified' && masterBPM && (
        <div className="flex flex-col items-center mx-2">
          <div className="text-xl font-bold text-slate-200">
            {masterBPM}
          </div>
          <div className="text-[9px] text-slate-500 uppercase">BPM</div>
        </div>
      )}

      {/* Master Reset Button - only show for full variant */}
      {variant === 'full' && (
        <button
          onClick={onMasterSyncReset}
          disabled={!deckALoaded && !deckBLoaded}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-105 ${
            deckALoaded || deckBLoaded
              ? 'border border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              : 'border border-slate-700 text-slate-600 cursor-not-allowed'
          }`}
          title={
            deckALoaded || deckBLoaded 
              ? 'Stop transport and reset both tracks to start' 
              : 'Load tracks to enable reset'
          }
        >
          ⏮
        </button>
      )}

      {/* Record Button - only show for full variant */}
      {variant === 'full' && (
        <button
          onClick={onRecordToggle}
          className={`record-btn w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs transition-all ${
            recordingRemix
              ? 'bg-red-500 border-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
              : 'border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-500'
          }`}
          title={recordingRemix ? 'Stop Recording' : 'Start Recording'}
        >
          <div className={`w-2.5 h-2.5 rounded-full ${
            recordingRemix ? 'bg-white' : 'bg-current'
          }`} />
        </button>
      )}

      {/* SYNC Button - moved into transport controls */}
      <button 
        onClick={onSyncToggle}
        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all uppercase tracking-wider ${
          syncActive 
            ? 'bg-cyan-400 border-2 border-cyan-400 text-slate-900 hover:bg-cyan-300 active:bg-cyan-500 active:scale-95' 
            : 'bg-black border-2 border-slate-400 text-slate-200 hover:bg-slate-600 hover:border-slate-300 hover:text-white active:bg-slate-900 active:scale-95'
        }`}
        title={syncActive ? 'Disable Sync' : 'Enable Sync'}
      >
        SYNC
      </button>

      <style jsx>{`
        .master-transport-controls {
          position: relative;
          /* Padding removed for compact version */
          /* Background and border removed for compact version */
        }
        
        .count-in-display {
          z-index: 10;
          background: rgba(6, 182, 212, 0.1);
          border: 1px solid rgba(6, 182, 212, 0.3);
          border-radius: 8px;
          padding: 5px 8px;
          backdrop-filter: blur(4px);
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .animate-pulse {
          animation: pulse 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
});

export default MasterTransportControlsCompact; 