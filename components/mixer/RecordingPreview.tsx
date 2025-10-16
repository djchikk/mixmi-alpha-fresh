"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, X, ShoppingCart } from 'lucide-react';
import RecordingWaveformDisplay from './RecordingWaveformDisplay';
import PaymentModal from './PaymentModal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getAudioContext } from '@/lib/mixerAudio';

interface RecordingPreviewProps {
  recordingUrl: string;
  duration: number;
  bars: number;
  bpm?: number;
  deckATrack?: any;
  deckBTrack?: any;
  onClose: () => void;
  onSelectSegment?: (startBar: number, endBar: number) => void;
}

export default function RecordingPreview({
  recordingUrl,
  duration,
  bars,
  bpm = 120,
  deckATrack,
  deckBTrack,
  onClose,
  onSelectSegment
}: RecordingPreviewProps) {
  const { walletAddress } = useAuth();
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<{ start: number; end: number }>({ start: 0, end: 8 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const nextLoopTimeRef = useRef<number>(0);
  const loopStartTimeRef = useRef<number>(0);
  const loopEndTimeRef = useRef<number>(0);

  useEffect(() => {
    // Create audio element for preview
    const audio = new Audio(recordingUrl);
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      stopLoopScheduler();
      setIsPlaying(false);
    });

    // Track current time for waveform display
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    audio.addEventListener('timeupdate', updateTime);

    // Load audio buffer for waveform visualization and get AudioContext
    const loadAudioBuffer = async () => {
      try {
        // Use the same AudioContext as the mixer for sample-accurate timing
        let audioContext = getAudioContext();
        if (!audioContext) {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        audioContextRef.current = audioContext;

        const response = await fetch(recordingUrl);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

        setAudioBuffer(decodedBuffer);
        console.log('🔄 Audio buffer loaded for precise looping');
      } catch (error) {
        console.error('Failed to load audio buffer:', error);
      }
    };

    loadAudioBuffer();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateTime);
      stopLoopScheduler();
      audio.remove();
      // Don't close the shared AudioContext
    };
  }, [recordingUrl]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Precise lookahead scheduler for seamless looping (based on mixer's PreciseLooper)
  const scheduleLoop = () => {
    if (!audioRef.current || !audioContextRef.current) return;

    const scheduleAheadTime = 0.1; // 100ms lookahead
    const currentTime = audioContextRef.current.currentTime;

    // Schedule loop resets that are coming up in the next 100ms
    while (nextLoopTimeRef.current < currentTime + scheduleAheadTime) {
      const loopResetTime = nextLoopTimeRef.current;

      // Schedule the reset with precise timing
      setTimeout(() => {
        if (audioRef.current && isPlaying) {
          audioRef.current.currentTime = loopStartTimeRef.current;
          console.log(`🔄 Loop reset: ${audioRef.current.currentTime.toFixed(3)}s → ${loopStartTimeRef.current.toFixed(3)}s`);
        }
      }, (loopResetTime - currentTime) * 1000);

      // Calculate next loop time
      const loopDuration = loopEndTimeRef.current - loopStartTimeRef.current;
      nextLoopTimeRef.current += loopDuration;
    }

    // Continue scheduling if still playing
    if (isPlaying && schedulerRef.current !== null) {
      schedulerRef.current = window.setTimeout(scheduleLoop, 25); // 25ms intervals
    }
  };

  const stopLoopScheduler = () => {
    if (schedulerRef.current !== null) {
      clearTimeout(schedulerRef.current);
      schedulerRef.current = null;
    }
  };

  const handlePreviewSelection = () => {
    if (!audioRef.current || !audioContextRef.current) return;

    // Calculate start and end time in seconds
    const beatsPerBar = 4;
    const beatsPerSecond = bpm / 60;
    const secondsPerBar = beatsPerBar / beatsPerSecond;
    const startTime = selectedSegment.start * secondsPerBar;
    const endTime = selectedSegment.end * secondsPerBar;

    if (isPlaying) {
      audioRef.current.pause();
      stopLoopScheduler();
      setIsPlaying(false);
    } else {
      // Store loop boundaries
      loopStartTimeRef.current = startTime;
      loopEndTimeRef.current = endTime;

      // Start playback from selection start
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
      setIsPlaying(true);

      // Initialize lookahead scheduler
      const loopDuration = endTime - startTime;
      nextLoopTimeRef.current = audioContextRef.current.currentTime + loopDuration;

      // Start the precise scheduler
      schedulerRef.current = window.setTimeout(scheduleLoop, 25);

      console.log(`🔄 Starting precise loop: ${startTime.toFixed(3)}s - ${endTime.toFixed(3)}s (${loopDuration.toFixed(3)}s)`);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `mixer-recording-${bars}bars-${new Date().toISOString()}.webm`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-[#1a1f2e] rounded-2xl p-8 max-w-4xl w-full border border-slate-700/50 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Recording Complete</h2>
            <p className="text-gray-400 text-sm">
              {bars} bars • {duration.toFixed(1)}s @ {bpm} BPM
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-slate-800/50 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Playback Controls */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={handlePlayPause}
            className="flex-1 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/50 text-white px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            <span className="font-medium">{isPlaying ? 'Pause' : 'Play'} Full Recording</span>
          </button>

          <button
            onClick={handlePreviewSelection}
            className="flex-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            <span className="font-medium">Loop Selection ({selectedSegment.end - selectedSegment.start} Bars)</span>
          </button>

          <button
            onClick={handleDownload}
            className="bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/50 text-white px-5 py-3 rounded-xl flex items-center gap-2 transition-all"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>

        {/* Recording Waveform with Selection Bracket */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-700/50">
          <h3 className="text-white font-semibold mb-4 text-lg">Select Your Mix Section</h3>
          <RecordingWaveformDisplay
            audioBuffer={audioBuffer}
            currentTime={currentTime}
            isPlaying={isPlaying}
            totalBars={bars}
            bpm={bpm}
            onSelectSegment={(start, end) => {
              setSelectedSegment({ start, end });
              if (onSelectSegment) {
                onSelectSegment(start, end);
              }
            }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <p className="text-gray-400">
            Ready to save your <span className="text-cyan-400 font-semibold">{selectedSegment.end - selectedSegment.start}-bar</span> mix?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-slate-800/60 hover:bg-slate-700/60 border border-slate-600/50 text-white px-6 py-3 rounded-xl transition-all font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white px-6 py-3 rounded-xl transition-all flex items-center gap-2 font-medium shadow-lg shadow-cyan-500/25"
            >
              <ShoppingCart className="w-5 h-5" />
              Save & Purchase
            </button>
          </div>
        </div>
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          selectedSegment={selectedSegment}
          recordingUrl={recordingUrl}
          deckATrack={deckATrack}
          deckBTrack={deckBTrack}
          bpm={bpm}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false);
            setShowSuccessModal(true);
          }}
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center">
          <div className="bg-slate-900 rounded-lg p-8 max-w-md w-full mx-4 border border-green-500/30">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">Remix Saved!</h2>
              <p className="text-gray-400 mb-6">
                Your remix has been recorded and payment processed successfully.
                It's now available in your creator store.
              </p>

              <div className="bg-slate-800 rounded-lg p-4 mb-6 border border-slate-700">
                <p className="text-sm text-gray-300 mb-2">
                  <span className="text-cyan-400">Note:</span> Your remix may take a moment to appear.
                  You may need to refresh the page to see it.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    onClose();
                    if (walletAddress) {
                      router.push(`/store/${walletAddress}`);
                    }
                  }}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  View My Store
                </button>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    onClose();
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}