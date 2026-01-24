"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Play, Pause, Sparkles, Volume2, Loader2 } from 'lucide-react';

// Enhancement types available
type EnhancementType = 'auto' | 'voice' | 'clean' | 'warm' | 'studio';

// Modal states
type ModalState = 'select' | 'processing' | 'preview';

interface Track {
  id: string;
  title: string;
  artist: string;
  audio_url?: string;
  content_type?: string;
  bpm?: number;
  enhanced_audio_url?: string;
  enhancement_type?: EnhancementType;
  enhancement_applied_at?: string;
}

interface EnhanceSoundModalProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onEnhancementApplied?: (trackId: string, enhancedUrl: string, enhancementType: EnhancementType) => void;
  onEnhancementRemoved?: (trackId: string) => void;
}

// Enhancement option definitions
const ENHANCEMENT_OPTIONS: {
  type: EnhancementType;
  name: string;
  description: string;
  icon: string;
}[] = [
  {
    type: 'voice',
    name: 'Voice',
    description: 'Removes background noise, levels voice, adds clarity',
    icon: '🎤',
  },
  {
    type: 'clean',
    name: 'Clean',
    description: 'Removes noise only, preserves character',
    icon: '✨',
  },
  {
    type: 'warm',
    name: 'Warm',
    description: 'Adds subtle compression and richness',
    icon: '🔥',
  },
  {
    type: 'studio',
    name: 'Studio Master',
    description: 'Full professional mastering treatment',
    icon: '🎚️',
  },
];

export default function EnhanceSoundModal({
  track,
  isOpen,
  onClose,
  onEnhancementApplied,
  onEnhancementRemoved,
}: EnhanceSoundModalProps) {
  // Modal state
  const [modalState, setModalState] = useState<ModalState>('select');
  const [selectedType, setSelectedType] = useState<EnhancementType | null>(null);
  const [showManualOptions, setShowManualOptions] = useState(false);

  // Processing state
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Preview state - mock enhanced URL for now
  const [previewEnhancedUrl, setPreviewEnhancedUrl] = useState<string | null>(null);

  // A/B Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingEnhanced, setPlayingEnhanced] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Audio refs - dual elements for instant A/B switching
  const originalAudioRef = useRef<HTMLAudioElement | null>(null);
  const enhancedAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Determine if track is already enhanced
  const isAlreadyEnhanced = !!track.enhanced_audio_url;

  // Initialize audio elements
  useEffect(() => {
    if (!isOpen || !track.audio_url) return;

    // Create original audio element
    const originalAudio = new Audio(track.audio_url);
    originalAudio.preload = 'auto';
    originalAudioRef.current = originalAudio;

    // Track duration
    originalAudio.addEventListener('loadedmetadata', () => {
      setDuration(originalAudio.duration);
    });

    // Handle ended
    originalAudio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // Reset both to beginning
      if (originalAudioRef.current) originalAudioRef.current.currentTime = 0;
      if (enhancedAudioRef.current) enhancedAudioRef.current.currentTime = 0;
    });

    // If already enhanced, load that too
    if (track.enhanced_audio_url) {
      const enhancedAudio = new Audio(track.enhanced_audio_url);
      enhancedAudio.preload = 'auto';
      enhancedAudio.muted = true; // Start muted
      enhancedAudioRef.current = enhancedAudio;
    }

    return () => {
      // Cleanup
      if (originalAudioRef.current) {
        originalAudioRef.current.pause();
        originalAudioRef.current.src = '';
      }
      if (enhancedAudioRef.current) {
        enhancedAudioRef.current.pause();
        enhancedAudioRef.current.src = '';
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setIsPlaying(false);
      setCurrentTime(0);
    };
  }, [isOpen, track.audio_url, track.enhanced_audio_url]);

  // Load preview enhanced audio when entering preview state
  useEffect(() => {
    if (modalState !== 'preview' || !previewEnhancedUrl) return;

    const enhancedAudio = new Audio(previewEnhancedUrl);
    enhancedAudio.preload = 'auto';
    enhancedAudio.muted = !playingEnhanced; // Muted if not active
    enhancedAudioRef.current = enhancedAudio;

    return () => {
      if (enhancedAudioRef.current) {
        enhancedAudioRef.current.pause();
        enhancedAudioRef.current.src = '';
      }
    };
  }, [modalState, previewEnhancedUrl]);

  // Update playhead position
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updateTime = () => {
      const activeAudio = playingEnhanced ? enhancedAudioRef.current : originalAudioRef.current;
      if (activeAudio) {
        setCurrentTime(activeAudio.currentTime);
      }
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, playingEnhanced]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    const original = originalAudioRef.current;
    const enhanced = enhancedAudioRef.current;

    if (!original) return;

    if (isPlaying) {
      original.pause();
      if (enhanced) enhanced.pause();
      setIsPlaying(false);
    } else {
      // Set mute states based on which one should be audible
      original.muted = playingEnhanced;
      if (enhanced) {
        enhanced.muted = !playingEnhanced;
        // Sync time
        enhanced.currentTime = original.currentTime;
      }

      // Play both (one muted)
      original.play().catch(console.error);
      if (enhanced) enhanced.play().catch(console.error);
      setIsPlaying(true);
    }
  }, [isPlaying, playingEnhanced]);

  // A/B Toggle - instant switch
  const toggleAB = useCallback(() => {
    const original = originalAudioRef.current;
    const enhanced = enhancedAudioRef.current;

    if (!original || !enhanced) return;

    const newPlayingEnhanced = !playingEnhanced;
    setPlayingEnhanced(newPlayingEnhanced);

    // Swap mute states instantly
    original.muted = newPlayingEnhanced;
    enhanced.muted = !newPlayingEnhanced;

    // Sync times to ensure perfect alignment
    if (isPlaying) {
      const syncTime = newPlayingEnhanced ? original.currentTime : enhanced.currentTime;
      original.currentTime = syncTime;
      enhanced.currentTime = syncTime;
    }
  }, [playingEnhanced, isPlaying]);

  // Client-side enhancement using Web Audio API
  const startEnhancement = useCallback(async (type: EnhancementType) => {
    if (!track.audio_url) {
      setProcessingError('No audio URL available');
      return;
    }

    setSelectedType(type);
    setModalState('processing');
    setProcessingProgress(0);
    setProcessingError(null);

    try {
      // Dynamic import of the enhance module (client-side only)
      const { enhanceAudio } = await import('@/lib/audio/enhance');

      // Process audio with progress callback
      const { enhancedUrl } = await enhanceAudio(
        track.audio_url,
        type,
        (progress) => setProcessingProgress(progress)
      );

      console.log('Enhancement complete:', { type, enhancedUrl });

      setPreviewEnhancedUrl(enhancedUrl);

      // Short delay then show preview
      await new Promise(resolve => setTimeout(resolve, 200));
      setModalState('preview');

    } catch (error) {
      console.error('Enhancement error:', error);
      setProcessingError(error instanceof Error ? error.message : 'Enhancement failed');
      setProcessingProgress(0);
    }
  }, [track.audio_url]);

  // Apply enhancement
  const applyEnhancement = useCallback(() => {
    if (!selectedType || !previewEnhancedUrl) return;

    // In real implementation, this would save to database
    if (onEnhancementApplied) {
      onEnhancementApplied(track.id, previewEnhancedUrl, selectedType);
    }

    onClose();
  }, [selectedType, previewEnhancedUrl, track.id, onEnhancementApplied, onClose]);

  // Remove enhancement
  const removeEnhancement = useCallback(() => {
    if (onEnhancementRemoved) {
      onEnhancementRemoved(track.id);
    }
    onClose();
  }, [track.id, onEnhancementRemoved, onClose]);

  // Try different enhancement
  const tryDifferent = useCallback(() => {
    // Stop playback
    if (originalAudioRef.current) originalAudioRef.current.pause();
    if (enhancedAudioRef.current) enhancedAudioRef.current.pause();
    setIsPlaying(false);

    // Reset to selection state
    setModalState('select');
    setSelectedType(null);
    setPreviewEnhancedUrl(null);
    setPlayingEnhanced(false);
  }, []);

  // Format time for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-lg border border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Enhance Sound</h2>
              <p className="text-sm text-gray-400 truncate max-w-[280px]">{track.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - varies by state */}
        <div className="p-5">
          {/* SELECT STATE */}
          {modalState === 'select' && (
            <div className="space-y-5">
              {/* Current status for already enhanced tracks */}
              {isAlreadyEnhanced && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400 font-medium text-sm">Currently Enhanced</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Applied: <span className="text-white capitalize">{track.enhancement_type}</span>
                    {track.enhancement_applied_at && (
                      <span className="text-gray-500 ml-2">
                        • {new Date(track.enhancement_applied_at).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Audio player for preview */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={togglePlayPause}
                    className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 text-white" />
                    ) : (
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="text-sm text-gray-400 mb-1">
                      Currently: <span className="text-white">{isAlreadyEnhanced ? 'Enhanced' : 'Original'}</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all duration-100"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                </div>

                {/* A/B Toggle for already enhanced tracks */}
                {isAlreadyEnhanced && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => { setPlayingEnhanced(false); toggleAB(); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        !playingEnhanced
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                      }`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => { setPlayingEnhanced(true); toggleAB(); }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        playingEnhanced
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                      }`}
                    >
                      Enhanced
                    </button>
                  </div>
                )}
              </div>

              {/* Auto-Enhance CTA */}
              <button
                onClick={() => startEnhancement('auto')}
                className="w-full py-4 px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
              >
                <Sparkles className="w-5 h-5" />
                {isAlreadyEnhanced ? 'Re-enhance with Auto' : 'Auto-Enhance'}
              </button>

              {/* Manual options toggle */}
              <div>
                <button
                  onClick={() => setShowManualOptions(!showManualOptions)}
                  className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors py-2"
                >
                  {showManualOptions ? '− Hide options' : '+ Choose manually'}
                </button>

                {showManualOptions && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {ENHANCEMENT_OPTIONS.map(option => (
                      <button
                        key={option.type}
                        onClick={() => startEnhancement(option.type)}
                        className="p-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-left transition-colors border border-slate-700 hover:border-amber-500/50 group"
                      >
                        <div className="text-2xl mb-2">{option.icon}</div>
                        <div className="text-white font-medium text-sm group-hover:text-amber-400 transition-colors">
                          {option.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Remove enhancement button for already enhanced */}
              {isAlreadyEnhanced && (
                <button
                  onClick={removeEnhancement}
                  className="w-full py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove enhancement (revert to original)
                </button>
              )}
            </div>
          )}

          {/* PROCESSING STATE */}
          {modalState === 'processing' && (
            <div className="py-8 text-center">
              <div className="w-16 h-16 mx-auto mb-5 relative">
                <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
                <div
                  className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin"
                  style={{ animationDuration: '1s' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-amber-400" />
                </div>
              </div>

              <h3 className="text-lg font-semibold text-white mb-2">
                Enhancing your audio...
              </h3>
              <p className="text-gray-400 text-sm mb-5">
                Applying <span className="text-amber-400 capitalize">{selectedType}</span> enhancement
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-xs mx-auto">
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {processingProgress < 100 ? 'This may take a moment...' : 'Almost done!'}
                </p>
              </div>

              {processingError && (
                <div className="mt-5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">{processingError}</p>
                  <button
                    onClick={tryDifferent}
                    className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* PREVIEW STATE */}
          {modalState === 'preview' && (
            <div className="space-y-5">
              {/* Success message */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <div className="text-green-400 font-medium mb-1">Enhancement complete!</div>
                <p className="text-gray-400 text-sm">
                  Applied: <span className="text-white capitalize">{selectedType}</span>
                </p>
              </div>

              {/* A/B Preview Player */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={togglePlayPause}
                    className="w-12 h-12 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center transition-colors shadow-lg shadow-amber-500/25"
                  >
                    {isPlaying ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white ml-0.5" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 transition-all duration-100"
                        style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1 font-mono">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>

                {/* A/B Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (playingEnhanced) toggleAB();
                    }}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      !playingEnhanced
                        ? 'bg-slate-600 text-white ring-2 ring-slate-500'
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                    }`}
                  >
                    <div className="text-sm">Original</div>
                    <div className="text-xs opacity-60 mt-0.5">A</div>
                  </button>
                  <button
                    onClick={() => {
                      if (!playingEnhanced) toggleAB();
                    }}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                      playingEnhanced
                        ? 'bg-amber-500 text-white ring-2 ring-amber-400'
                        : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
                    }`}
                  >
                    <div className="text-sm flex items-center justify-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Enhanced
                    </div>
                    <div className="text-xs opacity-60 mt-0.5">B</div>
                  </button>
                </div>

                <p className="text-center text-xs text-gray-500 mt-3">
                  Toggle between A/B while playing to compare
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={tryDifferent}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-white font-medium transition-colors border border-slate-600"
                >
                  Try Different
                </button>
                <button
                  onClick={applyEnhancement}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl text-white font-semibold transition-all shadow-lg shadow-green-500/25"
                >
                  Apply Enhancement
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
