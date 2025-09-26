"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, X, ShoppingCart } from 'lucide-react';
import WaveformSelector from './WaveformSelector';
import PaymentModal from './PaymentModal';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<{ start: number; end: number }>({ start: 0, end: 8 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element for preview
    const audio = new Audio(recordingUrl);
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
    });

    return () => {
      audio.pause();
      audio.remove();
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
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Pause' : 'Play'} Recording
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

        {/* Waveform visualization and 8-bar selection */}
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <h3 className="text-white font-semibold mb-3">Select 8 Bars</h3>
          <WaveformSelector
            audioUrl={recordingUrl}
            totalBars={bars}
            bpm={bpm}
            actualDuration={duration}
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
            onClose();
            // TODO: Show success message and handle post-payment flow
          }}
        />
      )}
    </div>
  );
}