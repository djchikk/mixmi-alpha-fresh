"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, X, ShoppingCart } from 'lucide-react';
import RecordingWaveformDisplay from './RecordingWaveformDisplay';
import PaymentModal from './PaymentModal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

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

  useEffect(() => {
    // Create audio element for preview
    const audio = new Audio(recordingUrl);
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    // Track current time for waveform display
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
    };
    audio.addEventListener('timeupdate', updateTime);

    // Load audio buffer for waveform visualization
    const loadAudioBuffer = async () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        const response = await fetch(recordingUrl);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

        setAudioBuffer(decodedBuffer);
      } catch (error) {
        console.error('Failed to load audio buffer:', error);
      }
    };

    loadAudioBuffer();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateTime);
      audio.remove();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
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

  const handlePreviewSelection = () => {
    if (!audioRef.current) return;

    // Calculate start and end time in seconds
    const beatsPerBar = 4;
    const beatsPerSecond = bpm / 60;
    const secondsPerBar = beatsPerBar / beatsPerSecond;
    const startTime = selectedSegment.start * secondsPerBar;
    const endTime = selectedSegment.end * secondsPerBar;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // Start playback from selection start
      audioRef.current.currentTime = startTime;
      audioRef.current.play();
      setIsPlaying(true);

      // Auto-stop at selection end and loop
      const checkTime = setInterval(() => {
        if (audioRef.current && audioRef.current.currentTime >= endTime) {
          audioRef.current.currentTime = startTime; // Loop back to start
        }
      }, 50);

      // Clear interval when audio pauses or ends
      audioRef.current.addEventListener('pause', () => clearInterval(checkTime), { once: true });
      audioRef.current.addEventListener('ended', () => clearInterval(checkTime), { once: true });
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `mixer-recording-${bars}bars-${new Date().toISOString()}.webm`;
    a.click();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full mx-4 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Recording Complete</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-gray-400 mb-2">
            Recorded {bars} bars ({duration.toFixed(1)}s)
          </p>
          
          {/* Playback controls */}
          <div className="flex gap-4 items-center">
            <button
              onClick={handlePlayPause}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pause' : 'Play'} Full Recording
            </button>

            <button
              onClick={handlePreviewSelection}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              Loop Selected 8 Bars
            </button>

            <button
              onClick={handleDownload}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>

        {/* Recording Waveform with Selection Bracket */}
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <h3 className="text-white font-semibold mb-3">Select Your 8 Bars</h3>
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

        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-400">
            Ready to save your {selectedSegment.end - selectedSegment.start}-bar mix?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
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