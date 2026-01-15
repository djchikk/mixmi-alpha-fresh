"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, X, ShoppingCart } from 'lucide-react';
import RecordingWaveformDisplay from './RecordingWaveformDisplay';
import PaymentModal from './PaymentModal';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getAudioContext } from '@/lib/mixerAudio';

// Sample-accurate looper for gapless playback
class SampleAccurateLooper {
  private audioContext: AudioContext;
  private audioBuffer: AudioBuffer;
  private bpm: number;
  private gainNode: GainNode;
  private sourceNode: AudioBufferSourceNode | null = null;
  private startBar: number = 0;
  private endBar: number = 8;
  private isLooping: boolean = false;
  private loopStartTime: number = 0; // AudioContext time when loop started
  private loopDuration: number = 0; // Duration of loop in seconds

  constructor(audioContext: AudioContext, audioBuffer: AudioBuffer, bpm: number) {
    this.audioContext = audioContext;
    this.audioBuffer = audioBuffer;
    this.bpm = bpm;

    // Create gain node for volume control
    this.gainNode = audioContext.createGain();
    this.gainNode.connect(audioContext.destination);
  }

  // Calculate sample-accurate loop boundaries
  private calculateSampleBoundaries(startBar: number, endBar: number): {
    startSample: number;
    endSample: number;
    loopDuration: number;
  } {
    const sampleRate = this.audioBuffer.sampleRate;

    // Calculate time positions
    const secondsPerBar = (4 * 60) / this.bpm;
    const startTime = startBar * secondsPerBar;
    const endTime = endBar * secondsPerBar;

    // Convert to exact sample positions (sample-accurate)
    const startSample = Math.round(startTime * sampleRate);
    const endSample = Math.round(endTime * sampleRate);

    // Calculate loop duration in seconds (from sample positions)
    const loopDuration = (endSample - startSample) / sampleRate;

    return { startSample, endSample, loopDuration };
  }

  // Create an AudioBufferSourceNode for a loop segment
  private createLoopSource(startBar: number, endBar: number): AudioBufferSourceNode {
    const { startSample, endSample } = this.calculateSampleBoundaries(startBar, endBar);

    // Create a new buffer containing only the loop segment
    const loopLength = endSample - startSample;
    const loopBuffer = this.audioContext.createBuffer(
      this.audioBuffer.numberOfChannels,
      loopLength,
      this.audioBuffer.sampleRate
    );

    // Copy the exact samples from the loop region
    for (let channel = 0; channel < this.audioBuffer.numberOfChannels; channel++) {
      const sourceData = this.audioBuffer.getChannelData(channel);
      const loopData = loopBuffer.getChannelData(channel);

      // Sample-accurate copy
      for (let i = 0; i < loopLength; i++) {
        loopData[i] = sourceData[startSample + i];
      }
    }

    // Create source node with the loop buffer
    const source = this.audioContext.createBufferSource();
    source.buffer = loopBuffer;
    source.connect(this.gainNode);

    // Enable native looping for gapless playback
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = loopBuffer.duration;

    return source;
  }

  // Start looping
  start(startBar: number, endBar: number): void {
    if (this.isLooping) {
      this.stop();
    }

    this.startBar = startBar;
    this.endBar = endBar;

    const source = this.createLoopSource(startBar, endBar);

    // Calculate loop duration for position tracking
    const secondsPerBar = (4 * 60) / this.bpm;
    this.loopDuration = (endBar - startBar) * secondsPerBar;

    // Track when playback starts
    this.loopStartTime = this.audioContext.currentTime;

    // Start playback immediately
    source.start(0);

    this.sourceNode = source;
    this.isLooping = true;
  }

  // Stop looping
  stop(): void {
    if (!this.isLooping || !this.sourceNode) return;

    try {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
    } catch (e) {
      // Already stopped
    }

    this.sourceNode = null;
    this.isLooping = false;
  }

  // Update loop boundaries while playing
  updateSegment(startBar: number, endBar: number): void {
    this.startBar = startBar;
    this.endBar = endBar;

    if (this.isLooping) {
      // Restart with new boundaries
      this.stop();
      this.start(startBar, endBar);
    }
  }

  // Check if currently looping
  getIsLooping(): boolean {
    return this.isLooping;
  }

  // Get current playback position (in seconds, relative to start of full recording)
  getCurrentPosition(): number {
    if (!this.isLooping || this.loopDuration === 0) {
      return 0;
    }

    // Calculate elapsed time since loop started
    const elapsedTime = this.audioContext.currentTime - this.loopStartTime;

    // Wrap within loop duration
    const positionInLoop = elapsedTime % this.loopDuration;

    // Convert to absolute position in the full recording
    const secondsPerBar = (4 * 60) / this.bpm;
    const loopStartTime = this.startBar * secondsPerBar;

    return loopStartTime + positionInLoop;
  }

  // Set volume
  setVolume(volume: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  // Cleanup
  cleanup(): void {
    this.stop();
    this.gainNode.disconnect();
  }
}

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
  const { walletAddress, suiAddress } = useAuth();
  const effectiveAddress = suiAddress || walletAddress;
  const router = useRouter();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoopPlaying, setIsLoopPlaying] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<{ start: number; end: number }>({ start: 0, end: 8 });
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [downloadDeckA, setDownloadDeckA] = useState(false);
  const [downloadDeckB, setDownloadDeckB] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const looperRef = useRef<SampleAccurateLooper | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Create audio element for preview of full recording
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

    // Load audio buffer for waveform visualization and sample-accurate looping
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

        // Create sample-accurate looper for loop playback
        looperRef.current = new SampleAccurateLooper(audioContext, decodedBuffer, bpm);
      } catch (error) {
        console.error('Failed to load audio buffer:', error);
      }
    };

    loadAudioBuffer();

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', updateTime);
      audio.remove();

      // Cleanup looper
      if (looperRef.current) {
        looperRef.current.cleanup();
        looperRef.current = null;
      }
      // Don't close the shared AudioContext
    };
  }, [recordingUrl, bpm]);

  // Update loop boundaries when selection changes while looping
  useEffect(() => {
    if (!looperRef.current || !isLoopPlaying) return;

    // Update the looper with new segment boundaries
    looperRef.current.updateSegment(selectedSegment.start, selectedSegment.end);
  }, [selectedSegment, isLoopPlaying]);

  // Update playhead position during loop playback
  useEffect(() => {
    if (!isLoopPlaying || !looperRef.current) {
      // Stop animation frame loop
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    // Start animation frame loop to update playhead
    const updatePlayhead = () => {
      if (looperRef.current && isLoopPlaying) {
        const position = looperRef.current.getCurrentPosition();
        setCurrentTime(position);
        animationFrameRef.current = requestAnimationFrame(updatePlayhead);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updatePlayhead);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isLoopPlaying]);

  const handlePlayPause = () => {
    if (!audioRef.current) return;

    // Stop loop playback if active
    if (isLoopPlaying && looperRef.current) {
      looperRef.current.stop();
      setIsLoopPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePreviewSelection = () => {
    if (!looperRef.current) return;

    // Stop full recording playback if active
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }

    if (isLoopPlaying) {
      // Stop loop playback
      looperRef.current.stop();
      setIsLoopPlaying(false);
    } else {
      // Start sample-accurate loop playback
      looperRef.current.start(selectedSegment.start, selectedSegment.end);
      setIsLoopPlaying(true);
    }
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = recordingUrl;
    a.download = `mixer-recording-${bars}bars-${new Date().toISOString()}.webm`;
    a.click();
  };

  // Calculate total price based on selections
  const calculateTotal = () => {
    let total = 2; // Base recording fee (1 STX per source loop)

    if (downloadDeckA && (deckATrack as any)?.allow_downloads) {
      total += (deckATrack as any).download_price_stx || (deckATrack as any).price_stx || 5;
    }

    if (downloadDeckB && (deckBTrack as any)?.allow_downloads) {
      total += (deckBTrack as any).download_price_stx || (deckBTrack as any).price_stx || 5;
    }

    return total;
  };

  const totalPrice = calculateTotal();

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
            {isLoopPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            <span className="font-medium">{isLoopPlaying ? 'Stop' : 'Loop'} Selection ({selectedSegment.end - selectedSegment.start} Bars)</span>
          </button>
        </div>

        {/* Recording Waveform with Selection Bracket */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-700/50">
          <h3 className="text-white font-semibold mb-4 text-lg">Select Your Mix Section</h3>
          <RecordingWaveformDisplay
            audioBuffer={audioBuffer}
            currentTime={currentTime}
            isPlaying={isPlaying || isLoopPlaying}
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

        {/* Licensing & Pricing Section */}
        <div className="space-y-4">
          {/* What You're Creating */}
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
            <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">What You're Creating:</h3>
            <div className="space-y-3">
              {/* Remix Info */}
              <div className="flex items-start gap-3 bg-slate-800/40 rounded-lg p-4">
                <span className="text-2xl mt-0.5 flex-shrink-0">🌿</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-white font-medium">
                        {selectedSegment.end - selectedSegment.start}-Bar Generation 1 Remix
                      </span>
                    </div>
                    <span className="text-cyan-400 font-semibold">2 STX</span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">
                    Appears on your creator store
                  </p>

                  {/* IP Rights & Commission Info */}
                  <div className="bg-slate-900/50 rounded-lg p-3 mb-2 border border-slate-700/30">
                    <p className="text-xs text-gray-400 leading-relaxed">
                      <span className="text-cyan-400 font-medium">Your rights:</span> You earn a 20% commission on each use or download of this remix from your store.
                      Source creators retain all intellectual property rights to their original loops.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Download:</span>
                    {((deckATrack as any)?.allow_downloads && (deckBTrack as any)?.allow_downloads) ? (
                      <span className="text-xs px-2 py-1 bg-green-500/10 text-green-400 rounded border border-green-500/30">
                        Available for buyers
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-amber-500/10 text-amber-400 rounded border border-amber-500/30">
                        Platform Only
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Source Downloads */}
          {((deckATrack as any)?.allow_downloads || (deckBTrack as any)?.allow_downloads) && (
            <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
              <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Optional Source Downloads:</h3>
              <p className="text-xs text-gray-400 mb-3">Add source tracks for offline use</p>
              <div className="space-y-2">
                {/* Deck A Track */}
                {(deckATrack as any)?.allow_downloads && (
                  <label className="flex items-center gap-3 bg-slate-800/40 rounded-lg p-3 cursor-pointer hover:bg-slate-800/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={downloadDeckA}
                      onChange={(e) => setDownloadDeckA(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                    />
                    <Download className="w-4 h-4 text-gray-400" />
                    <div className="flex-1">
                      <span className="text-white text-sm font-medium">{deckATrack.title}</span>
                      <span className="text-xs text-gray-500 ml-2">by {deckATrack.artist}</span>
                    </div>
                    <span className="text-cyan-400 font-semibold text-sm">
                      {(deckATrack as any).download_price_stx || (deckATrack as any).price_stx || 5} STX
                    </span>
                  </label>
                )}

                {/* Deck B Track */}
                {(deckBTrack as any)?.allow_downloads && (
                  <label className="flex items-center gap-3 bg-slate-800/40 rounded-lg p-3 cursor-pointer hover:bg-slate-800/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={downloadDeckB}
                      onChange={(e) => setDownloadDeckB(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                    />
                    <Download className="w-4 h-4 text-gray-400" />
                    <div className="flex-1">
                      <span className="text-white text-sm font-medium">{deckBTrack.title}</span>
                      <span className="text-xs text-gray-500 ml-2">by {deckBTrack.artist}</span>
                    </div>
                    <span className="text-cyan-400 font-semibold text-sm">
                      {(deckBTrack as any).download_price_stx || (deckBTrack as any).price_stx || 5} STX
                    </span>
                  </label>
                )}

                {/* Show unavailable tracks */}
                {!(deckATrack as any)?.allow_downloads && (
                  <div className="flex items-center gap-3 bg-slate-800/20 rounded-lg p-3 opacity-50">
                    <X className="w-4 h-4 text-gray-600" />
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{deckATrack?.title}</span>
                      <span className="text-xs text-gray-600 ml-2">Platform Only</span>
                    </div>
                  </div>
                )}
                {!(deckBTrack as any)?.allow_downloads && (
                  <div className="flex items-center gap-3 bg-slate-800/20 rounded-lg p-3 opacity-50">
                    <X className="w-4 h-4 text-gray-600" />
                    <div className="flex-1">
                      <span className="text-gray-500 text-sm">{deckBTrack?.title}</span>
                      <span className="text-xs text-gray-600 ml-2">Platform Only</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Total & Action Buttons */}
          <div className="flex items-center justify-between bg-slate-900/50 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50">
            <div>
              <div className="text-sm text-gray-400 mb-1">Total:</div>
              <div className="text-2xl font-bold text-white">
                {totalPrice} STX
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {totalPrice === 2 ? 'Recording fee only' : `2 STX recording + ${totalPrice - 2} STX downloads`}
              </div>
            </div>
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
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          selectedSegment={selectedSegment}
          recordingUrl={recordingUrl}
          deckATrack={deckATrack}
          deckBTrack={deckBTrack}
          bpm={bpm}
          downloadDeckA={downloadDeckA}
          downloadDeckB={downloadDeckB}
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
                    if (effectiveAddress) {
                      router.push(`/store/${effectiveAddress}`);
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