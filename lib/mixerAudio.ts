// 🎵 Mixer Audio System - Built on MC Claude's "Nuclear Option" CORS Solution
// Extends the proven audio foundation for professional DJ mixing capabilities
// 🔄 UPGRADED: Professional Lookahead Scheduling for Seamless Loops (MC Claude Research)
// 🎛️ NEW: Simple Loop Sync for 8-Bar Loops (MC Claude Streamlined Implementation)

import { Track } from '@/types';
import { audioContextManager } from './audioContextManager';

export interface MixerAudioState {
  audio: HTMLAudioElement;
  audioContext: AudioContext;
  source: MediaElementAudioSourceNode;
  gainNode: GainNode;
  hiCutNode: BiquadFilterNode; // 🎛️ High-cut EQ (low-pass filter)
  loCutNode: BiquadFilterNode; // 🎛️ Low-cut EQ (high-pass filter)
  analyzerNode: AnalyserNode;
  isLoaded: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  bpm: number;
  preciseLooper?: PreciseLooper; // 🔄 Professional looping system
  loopStartTime?: number; // 🔄 Track when loop started for sync
  audioBuffer?: AudioBuffer; // 🎵 Audio buffer for content analysis
  fxInput?: GainNode; // 🎛️ FX chain input node
  fxOutput?: GainNode; // 🎛️ FX chain output node
}

// 🎛️ SIMPLE LOOP SYNC: MC Claude's streamlined implementation for 8-bar loops
// ~100 lines of focused functionality vs 500+ enterprise version

// 🎵 CONTENT-AWARE LOOP DETECTION: Professional-grade boundary detection
interface LoopBoundaries {
  contentStart: number;      // First audio content (seconds)
  contentEnd: number;        // Last audio content (seconds)
  mathematicalDuration: number; // BPM-calculated duration
  actualLoopDuration: number;   // Final loop duration to use
  confidence: number;        // 0-1 confidence in detection
}

/**
 * Content-Aware Loop Detection System
 * Professional-grade implementation for detecting actual audio content boundaries
 * within 8-bar loops while respecting BPM metadata
 */
class ContentAwareLooper {
  private audioContext: AudioContext;
  private silenceThreshold: number = -60; // dBFS (industry standard from Mixxx)
  private minSilenceDuration: number = 0.05; // 50ms minimum silence
  private beatGridTolerance: number = 0.1; // 10% tolerance for BPM variations

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Analyzes audio buffer to detect content boundaries
   * Follows the Mixxx/Serato approach of -60dBFS threshold detection
   */
  async analyzeLoopContent(
    audioBuffer: AudioBuffer,
    bpm: number,
    bars: number = 8
  ): Promise<LoopBoundaries> {
    // Calculate mathematical duration from BPM with high precision
    const beatsPerBar = 4;
    const mathematicalDuration = this.calculatePreciseDuration(bpm, bars);

    // Detect actual content boundaries
    const contentBounds = await this.detectContentBoundaries(audioBuffer);
    
    // Enhanced: Detect if this is likely an a cappella or vocal track
    const trackCharacteristics = this.analyzeTrackCharacteristics(audioBuffer, contentBounds);
    
    // Improved strategy selection with a cappella detection
    const actualLoopDuration = this.determineOptimalLoopDuration(
      contentBounds,
      mathematicalDuration,
      audioBuffer.duration,
      trackCharacteristics
    );

    return {
      contentStart: contentBounds.start,
      contentEnd: contentBounds.end,
      mathematicalDuration,
      actualLoopDuration,
      confidence: this.calculateOverallConfidence(contentBounds, trackCharacteristics, mathematicalDuration, actualLoopDuration)
    };
  }

  /**
   * Detects first and last significant audio content
   * Using -60dBFS threshold (same as Mixxx's silence detection)
   */
  private async detectContentBoundaries(audioBuffer: AudioBuffer): Promise<{
    start: number;
    end: number;
    confidence: number;
  }> {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
    
    // Convert threshold from dBFS to linear amplitude
    const linearThreshold = this.dBFSToLinear(this.silenceThreshold);
    
    let firstSound = -1;
    let lastSound = -1;
    
    // Scan forward for first sound
    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      const rms = this.calculateRMS(channelData, i, i + windowSize);
      if (rms > linearThreshold) {
        firstSound = i;
        break;
      }
    }
    
    // Scan backward for last sound
    for (let i = channelData.length - windowSize; i >= 0; i -= windowSize) {
      const rms = this.calculateRMS(channelData, i, i + windowSize);
      if (rms > linearThreshold) {
        lastSound = i + windowSize;
        break;
      }
    }
    
    // Convert samples to seconds
    const startTime = firstSound >= 0 ? firstSound / sampleRate : 0;
    const endTime = lastSound >= 0 ? lastSound / sampleRate : audioBuffer.duration;
    
    // Calculate confidence based on how clear the boundaries are
    const confidence = this.calculateDetectionConfidence(
      channelData,
      firstSound,
      lastSound,
      linearThreshold
    );
    
    return {
      start: startTime,
      end: endTime,
      confidence
    };
  }

  /**
   * Calculate precise mathematical duration to avoid rounding errors
   */
  private calculatePreciseDuration(bpm: number, bars: number): number {
    console.log(`🔍 BPM Calculation Debug:`, {
      inputBPM: bpm,
      bpmType: typeof bpm,
      bars: bars,
      rawSecondsPerBeat: 60 / bpm,
      totalBeats: bars * 4
    });
    
    const beatsPerBar = 4;
    const totalBeats = bars * beatsPerBar; // 32 beats for 8 bars
    const secondsPerBeat = 60.0 / bpm; // High precision division
    const duration = totalBeats * secondsPerBeat;
    
    console.log(`🔍 Mathematical Duration Calculation:`, {
      bpm: bpm,
      secondsPerBeat: secondsPerBeat.toFixed(10),
      totalBeats: totalBeats,
      calculatedDuration: duration.toFixed(10),
      expectedFor174: ((32 * 60) / 174).toFixed(10),
      expectedFor173: ((32 * 60) / 173).toFixed(10)
    });
    
    return duration;
  }

  /**
   * Analyze track characteristics to detect a cappellas, vocals, etc.
   */
  private analyzeTrackCharacteristics(
    audioBuffer: AudioBuffer,
    contentBounds: { start: number; end: number; confidence: number }
  ): {
    isLikelyVocal: boolean;
    hasSparseSections: boolean;
    dynamicRange: number;
  } {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
    
    let silentWindows = 0;
    let totalWindows = 0;
    let maxRMS = 0;
    let minRMS = Infinity;
    
    // Analyze content section only
    const startSample = Math.floor(contentBounds.start * sampleRate);
    const endSample = Math.floor(contentBounds.end * sampleRate);
    
    for (let i = startSample; i < endSample - windowSize; i += windowSize) {
      const rms = this.calculateRMS(channelData, i, i + windowSize);
      totalWindows++;
      
      if (rms < this.dBFSToLinear(-40)) { // -40dBFS threshold for "quiet" sections
        silentWindows++;
      }
      
      maxRMS = Math.max(maxRMS, rms);
      minRMS = Math.min(minRMS, rms);
    }
    
    const sparseness = silentWindows / totalWindows;
    const dynamicRange = maxRMS / (minRMS + 0.0001);
    
    return {
      isLikelyVocal: sparseness > 0.2, // More than 20% sparse sections suggests vocals/a cappella
      hasSparseSections: sparseness > 0.1,
      dynamicRange
    };
  }

  /**
   * Determines the optimal loop duration based on content and BPM
   * Enhanced with better a cappella detection and BPM trust
   */
  private determineOptimalLoopDuration(
    contentBounds: { start: number; end: number; confidence: number },
    mathematicalDuration: number,
    fileDuration: number,
    trackCharacteristics: { isLikelyVocal: boolean; hasSparseSections: boolean; dynamicRange: number }
  ): number {
    const contentDuration = contentBounds.end - contentBounds.start;
    const durationRatio = contentDuration / mathematicalDuration;
    
    console.log(`🎵 Content Analysis Details:`, {
      contentDuration: contentDuration.toFixed(2) + 's',
      mathematicalDuration: mathematicalDuration.toFixed(2) + 's',
      ratio: durationRatio.toFixed(2),
      isLikelyVocal: trackCharacteristics.isLikelyVocal,
      hasSparseSections: trackCharacteristics.hasSparseSections,
      confidence: contentBounds.confidence.toFixed(2)
    });
    
    // STRATEGY 1: High confidence + content matches mathematical = trust both
    if (contentBounds.confidence > 0.8 && 
        Math.abs(durationRatio - 1.0) < this.beatGridTolerance) {
      console.log('🎵 Strategy: Mathematical (high confidence match)');
      return mathematicalDuration;
    }
    
    // STRATEGY 2: A cappella/vocal detection = ALWAYS trust BPM metadata
    if (trackCharacteristics.isLikelyVocal) {
      console.log('🎵 Strategy: Mathematical BPM (a cappella/vocal detected)');
      return mathematicalDuration;
    }
    
    // STRATEGY 3: File significantly shorter than mathematical = use file length
    if (fileDuration < mathematicalDuration * 0.85) {
      console.log('🎵 Strategy: File-length limited');
      return Math.min(contentDuration, fileDuration);
    }
    
    // STRATEGY 4: Content significantly shorter + high confidence = padded file
    if (durationRatio < 0.7 && contentBounds.confidence > 0.6) {
      const snappedDuration = this.snapToNearestBeat(contentDuration, mathematicalDuration / 32);
      console.log('🎵 Strategy: Content-trimmed (padded file detected)');
      return snappedDuration;
    }
    
    // STRATEGY 5: Low confidence or close to mathematical = trust BPM
    console.log('🎵 Strategy: Mathematical BPM (default/fallback)');
    return mathematicalDuration;
  }

  /**
   * Calculate overall confidence combining content detection and track analysis
   */
  private calculateOverallConfidence(
    contentBounds: { confidence: number },
    trackCharacteristics: { isLikelyVocal: boolean; hasSparseSections: boolean },
    mathematicalDuration: number,
    actualLoopDuration: number
  ): number {
    let confidence = contentBounds.confidence;
    
    // Boost confidence for a cappellas when using mathematical duration
    if (trackCharacteristics.isLikelyVocal && Math.abs(actualLoopDuration - mathematicalDuration) < 0.1) {
      confidence = Math.max(confidence, 0.9);
    }
    
    // Reduce confidence for mathematical fallback on non-vocal tracks
    if (!trackCharacteristics.isLikelyVocal && actualLoopDuration === mathematicalDuration && contentBounds.confidence < 0.3) {
      confidence = 0.0; // Mathematical fallback
    }
    
    return confidence;
  }

  /**
   * RMS (Root Mean Square) calculation for more accurate amplitude detection
   * Better than peak detection for finding actual audio content
   */
  private calculateRMS(data: Float32Array, start: number, end: number): number {
    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += data[i] * data[i];
    }
    return Math.sqrt(sum / (end - start));
  }

  /**
   * Convert dBFS to linear amplitude
   * -60 dBFS = 0.001 linear amplitude
   */
  private dBFSToLinear(dbfs: number): number {
    return Math.pow(10, dbfs / 20);
  }

  /**
   * Calculate confidence score for boundary detection
   * Higher score = clearer distinction between silence and content
   */
  private calculateDetectionConfidence(
    data: Float32Array,
    firstSound: number,
    lastSound: number,
    threshold: number
  ): number {
    if (firstSound === -1 || lastSound === -1) return 0;
    
    // Check how "sharp" the transition is from silence to sound
    const transitionWindow = Math.floor(data.length * 0.01); // 1% of file
    
    let beforeFirstRMS = 0;
    let afterFirstRMS = 0;
    
    if (firstSound > transitionWindow) {
      beforeFirstRMS = this.calculateRMS(data, firstSound - transitionWindow, firstSound);
      afterFirstRMS = this.calculateRMS(data, firstSound, firstSound + transitionWindow);
    }
    
    // Confidence based on ratio of sound to silence
    const ratio = afterFirstRMS / (beforeFirstRMS + 0.0001); // Avoid division by zero
    return Math.min(1, ratio / 10); // Normalize to 0-1
  }

  /**
   * Snap duration to nearest musical beat boundary
   * Ensures loops remain musically coherent
   */
  private snapToNearestBeat(duration: number, beatDuration: number): number {
    const beats = Math.round(duration / beatDuration);
    return beats * beatDuration;
  }
}

interface DeckWithState extends MixerAudioState {
  audioControls: MixerAudioControls;
  track?: Track;
}

class SimpleLoopSync {
  private audioContext: AudioContext;
  private masterDeck: DeckWithState; // The deck providing tempo
  private slaveDeck: DeckWithState; // The deck being synced
  private masterDeckId: 'A' | 'B'; // Which deck is master
  private slaveDeckId: 'A' | 'B'; // Which deck is slave
  // Sync engine for keeping decks in time
  private isActive: boolean = false;
  private transitionDuration: number = 0.8; // Smooth 800ms BPM transition
  private transitionInterval: NodeJS.Timeout | null = null; // For smooth transition
  private enableSyncTimeout: NodeJS.Timeout | null = null; // For beat-aligned enableSync
  private isUpdating: boolean = false; // 🎵 NEW: Prevent sync feedback loops

  constructor(
    audioContext: AudioContext,
    deckA: DeckWithState,
    deckB: DeckWithState,
    masterDeckId: 'A' | 'B' // 🎯 NEW: Explicitly specify which deck is master
  ) {
    this.audioContext = audioContext;
    this.masterDeckId = masterDeckId;
    this.slaveDeckId = masterDeckId === 'A' ? 'B' : 'A';

    // Assign master/slave based on parameter
    if (masterDeckId === 'A') {
      this.masterDeck = deckA;
      this.slaveDeck = deckB;
    } else {
      this.masterDeck = deckB;
      this.slaveDeck = deckA;
    }

    console.log(`🎛️ SimpleLoopSync: Deck ${this.masterDeckId} is master, Deck ${this.slaveDeckId} is slave`);
  }

  // Enhanced sync method with better debugging and fallback
  async enableSync(): Promise<number | null> {
    console.log(`🎵 SYNC: enableSync() called (Master: Deck ${this.masterDeckId}, Slave: Deck ${this.slaveDeckId})`);
    console.log('🎵 SYNC: Current state check:', {
      isActive: this.isActive,
      masterDeck_exists: !!this.masterDeck,
      slaveDeck_exists: !!this.slaveDeck,
      masterDeck_preciseLooper: !!this.masterDeck?.preciseLooper,
      slaveDeck_preciseLooper: !!this.slaveDeck?.preciseLooper,
      masterDeck_bpm: this.masterDeck?.bpm,
      slaveDeck_bpm: this.slaveDeck?.bpm,
      masterDeck_audio: !!this.masterDeck?.audio,
      slaveDeck_audio: !!this.slaveDeck?.audio
    });

    if (this.isActive) {
      console.log('🚨 SYNC: Already active, skipping');
      return null;
    }

    // ENHANCED: Don't require preciseLooper, use direct audio element
    if (!this.masterDeck || !this.slaveDeck || !this.masterDeck.audio || !this.slaveDeck.audio) {
      console.log('🚨 SYNC: Missing audio elements');
      return null;
    }

    console.log(`🎵 SYNC: Enabling dynamic loop sync (Deck ${this.masterDeckId} → Deck ${this.slaveDeckId})...`);

    // ENHANCED: Use immediate activation if no preciseLooper
    if (this.masterDeck.preciseLooper && this.slaveDeck.preciseLooper) {
      // Original beat-aligned activation
      const nextBeatTime = this.masterDeck.preciseLooper.getNextBeatTime();
      const waitTime = nextBeatTime - this.audioContext.currentTime;

      // Store timeout so it can be cleared in stop()
      this.enableSyncTimeout = setTimeout(() => {
        this.activateSync();
        this.enableSyncTimeout = null;
      }, waitTime * 1000);

      console.log(`🎵 SYNC: Will activate at beat: ${nextBeatTime.toFixed(2)}`);
      this.isActive = true;
      return nextBeatTime;
    } else {
      // ENHANCED: Direct activation without beat alignment
      console.log('🎵 SYNC: No preciseLooper, activating immediately');
      this.activateSync();
      this.isActive = true;
      return this.audioContext.currentTime;
    }
  }

  private activateSync(): void {
    // 🔧 FIX: Always use original track BPM, not potentially mutated state.bpm
    const masterBPM = this.masterDeck.track?.bpm || this.masterDeck.bpm;
    const slaveBPM = this.slaveDeck.track?.bpm || this.slaveDeck.bpm;

    console.log(`🎵 SYNC: activateSync() called with BPMs:`, {
      masterBPM,
      slaveBPM,
      masterDeckId: this.masterDeckId,
      slaveDeckId: this.slaveDeckId,
      masterDeck_track_bpm: this.masterDeck.track?.bpm,
      slaveDeck_track_bpm: this.slaveDeck.track?.bpm,
      masterDeck_state_bpm: this.masterDeck.bpm,
      slaveDeck_state_bpm: this.slaveDeck.bpm,
      masterDeck_audio_playbackRate: this.masterDeck.audio?.playbackRate,
      slaveDeck_audio_playbackRate: this.slaveDeck.audio?.playbackRate
    });

    if (!masterBPM || !slaveBPM) {
      console.warn('🚨 SYNC: Missing BPM data, cannot sync');
      return;
    }

    console.log(`🎵 SYNC: Syncing Deck ${this.slaveDeckId} (${slaveBPM} BPM) → Deck ${this.masterDeckId} (${masterBPM} BPM) using original track BPMs`);

    // Calculate playback rate adjustment
    const targetRate = masterBPM / slaveBPM;
    console.log(`🎵 SYNC: Calculated target playback rate for Deck ${this.slaveDeckId}: ${targetRate.toFixed(3)}`);

    // Apply smooth BPM transition (prevents chipmunk effect)
    this.smoothBPMTransition(targetRate);

    // ENHANCED: Skip beat alignment if no preciseLooper
    if (this.masterDeck.preciseLooper && this.slaveDeck.preciseLooper) {
      this.alignBeats();
    } else {
      console.log('🎵 SYNC: Skipping beat alignment (no preciseLooper)');
    }

    console.log('✅ SYNC: Dynamic loop sync activated!');
  }

  private smoothBPMTransition(targetRate: number): void {
    if (!this.slaveDeck.audio) return;

    const startRate = this.slaveDeck.audio.playbackRate;
    const startTime = Date.now();
    const duration = 800; // 0.8 seconds

    console.log(`🎵 SYNC: Starting smooth BPM transition for Deck ${this.slaveDeckId} to rate ${targetRate.toFixed(3)}`);
    console.log(`🎵 SYNC: Transition from ${startRate.toFixed(3)} to ${targetRate.toFixed(3)} over ${duration/1000}s`);

    // Clear any existing transition
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval);
    }

    this.transitionInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1.0);

      // Exponential easing for smooth transitions
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentRate = startRate + (targetRate - startRate) * easedProgress;

      if (this.slaveDeck.audio) {
        this.slaveDeck.audio.playbackRate = currentRate;
        // Removed verbose logging here - only log completion
      }

      if (progress >= 1.0) {
        if (this.transitionInterval) {
          clearInterval(this.transitionInterval);
          this.transitionInterval = null;
        }

        // Update slave deck's internal BPM tracking after transition
        this.slaveDeck.bpm = this.masterDeck.bpm;
        if (this.slaveDeck.preciseLooper) {
          this.slaveDeck.preciseLooper.updateBPM(this.masterDeck.bpm);
        }
        // 🎯 SYNC FIX: Also update audioControls BPM for consistency
        if (this.slaveDeck.audioControls) {
          this.slaveDeck.audioControls.setBPM(this.masterDeck.bpm);
        }
        console.log(`✅ SYNC: BPM transition complete - Deck ${this.slaveDeckId} now at ${currentRate.toFixed(3)}x playback rate`);
        console.log(`✅ SYNC: Final audio element playbackRate: ${this.slaveDeck.audio?.playbackRate.toFixed(3)}`);
        console.log(`✅ SYNC: Deck ${this.slaveDeckId} BPM updated to ${this.masterDeck.bpm} for smooth looping`);
      }
    }, 25);
  }

  private alignBeats(): void {
    // Get current position within 8-bar loops (0-1 normalized)
    const masterPosition = this.getMasterLoopPosition();
    const slavePosition = this.getSlaveLoopPosition();

    // Calculate offset needed to align
    const offset = masterPosition - slavePosition;

    console.log(`🎵 SYNC: Deck ${this.masterDeckId} position ${masterPosition.toFixed(3)}, Deck ${this.slaveDeckId} position ${slavePosition.toFixed(3)}`);

    // If offset is significant, schedule a micro-jump
    if (Math.abs(offset) > 0.01) { // More than 1% off
      console.log(`🎵 SYNC: Aligning beats (offset: ${offset.toFixed(3)})`);
      this.scheduleAlignment(offset);
    } else {
      console.log('✅ SYNC: Beats already aligned');
    }
  }

  private getMasterLoopPosition(): number {
    // Returns normalized position (0-1) within the loop
    if (!this.masterDeck.preciseLooper || !this.masterDeck.loopStartTime) return 0;

    const loopDuration = this.masterDeck.preciseLooper.getLoopDuration();
    const elapsed = this.audioContext.currentTime - this.masterDeck.loopStartTime;
    return (elapsed % loopDuration) / loopDuration;
  }

  private getSlaveLoopPosition(): number {
    if (!this.slaveDeck.preciseLooper || !this.slaveDeck.loopStartTime) return 0;

    const loopDuration = this.slaveDeck.preciseLooper.getLoopDuration();
    const elapsed = this.audioContext.currentTime - this.slaveDeck.loopStartTime;
    return (elapsed % loopDuration) / loopDuration;
  }

  private scheduleAlignment(offset: number): void {
    // For HTMLAudioElement, we use currentTime adjustment for alignment
    const audio = this.slaveDeck.audio;
    if (!audio || !this.slaveDeck.preciseLooper) return;

    const loopDuration = this.slaveDeck.preciseLooper.getLoopDuration();
    const targetPosition = this.getMasterLoopPosition() * loopDuration;

    // Quick alignment by adjusting currentTime
    try {
      audio.currentTime = targetPosition;
      this.slaveDeck.loopStartTime = this.audioContext.currentTime - targetPosition;
      console.log(`✅ SYNC: Beat alignment complete for Deck ${this.slaveDeckId} (position: ${targetPosition.toFixed(3)}s)`);
    } catch (error) {
      console.warn(`🚨 SYNC: Could not align beats for Deck ${this.slaveDeckId}:`, error);
    }
  }

  disableSync(): void {
    if (!this.isActive) return;

    console.log(`🎵 SYNC: Disabling sync (was: Deck ${this.masterDeckId} → Deck ${this.slaveDeckId})...`);
    this.isActive = false;

    // Clear any existing transition
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval);
      this.transitionInterval = null;
    }

    // Reset slave deck to its original playback rate
    const audio = this.slaveDeck.audio;
    if (audio) {
      this.smoothBPMTransition(1.0); // Reset to original speed
    }

    console.log('✅ SYNC: Sync disabled');
  }

  // 🎵 NEW: Handle real-time master BPM changes during sync
  updateMasterBPM(newMasterBPM: number): void {
    if (!this.isActive) {
      console.log('🎵 SYNC: Not active, ignoring master BPM update');
      return;
    }

    // 🎵 NEW: Prevent feedback loops
    if (this.isUpdating) {
      console.log('🎵 SYNC: Already updating, preventing feedback loop');
      return;
    }

    this.isUpdating = true;
    console.log(`🎵 SYNC: Updating Deck ${this.masterDeckId} BPM from ${this.masterDeck.bpm} to ${newMasterBPM}`);

    // Update master deck BPM in the sync engine
    this.masterDeck.bpm = newMasterBPM;

    // If slave deck is playing, apply real-time sync adjustment
    if (this.slaveDeck.audio && !this.slaveDeck.audio.paused) {
      // Recalculate sync for slave deck with new master BPM
      const originalSlaveBPM = this.slaveDeck.track?.bpm || this.slaveDeck.bpm;
      const newTargetRate = newMasterBPM / originalSlaveBPM;

      console.log(`🎵 SYNC: Recalculating sync - Deck ${this.slaveDeckId} ${originalSlaveBPM} BPM → Deck ${this.masterDeckId} ${newMasterBPM} BPM (rate: ${newTargetRate.toFixed(3)}x)`);

      // Apply smooth transition to new sync rate
      this.smoothBPMTransition(newTargetRate);
    } else {
      console.log(`🎵 SYNC: Deck ${this.slaveDeckId} not playing, sync will apply when it starts`);
    }

    console.log(`✅ SYNC: Master BPM updated to ${newMasterBPM}, Deck ${this.slaveDeckId} resynced`);

    // Reset the updating flag after a brief delay to prevent rapid updates
    setTimeout(() => {
      this.isUpdating = false;
    }, 100);
  }

  // 🧹 NEW: Comprehensive cleanup method
  stop(): void {
    console.log(`🧹 SYNC: Stopping sync engine (Master: Deck ${this.masterDeckId}, Slave: Deck ${this.slaveDeckId})`);

    // Disable sync if active
    if (this.isActive) {
      this.disableSync();
    }

    // Clear transition interval
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval);
      this.transitionInterval = null;
    }

    // Clear beat-aligned enableSync timeout
    if (this.enableSyncTimeout) {
      clearTimeout(this.enableSyncTimeout);
      this.enableSyncTimeout = null;
    }

    // Reset flags
    this.isActive = false;
    this.isUpdating = false;

    console.log('✅ SYNC: Sync engine stopped and cleaned up');
  }

  get active(): boolean {
    return this.isActive;
  }
}

// 🔄 PROFESSIONAL LOOPING: Based on MC Claude's research into Beatport's implementation
// Now with CONTENT-AWARE DETECTION for professional-grade loop handling
class PreciseLooper {
  private audioContext: AudioContext;
  private audioElement: HTMLAudioElement;
  private bpm: number;
  private scheduleAheadTime: number = 0.1; // 100ms lookahead
  private scheduleInterval: number = 0.025; // 25ms intervals
  private nextLoopTime: number = 0.0;
  private loopDuration: number;
  private isLooping: boolean = false;
  private schedulerTimeoutId: number | null = null;
  private deckId: 'A' | 'B';
  
  // 🎵 NEW: Content-aware detection system
  private contentAnalyzer: ContentAwareLooper;
  private loopBoundaries: LoopBoundaries | null = null;
  
  // 🔄 NEW: Dynamic loop length support
  private loopBars: number = 8; // Default to 8 bars
  private loopEnabled: boolean = true; // 🔄 NEW: Control whether looping is enabled
  private loopStartPosition: number = 0; // 🎯 NEW: Loop start position in bars

  constructor(audioContext: AudioContext, audioElement: HTMLAudioElement, bpm: number, deckId: 'A' | 'B', loopBars: number = 8) {
    console.log(`🔍 PreciseLooper Constructor Debug for Deck ${deckId}:`, {
      inputBPM: bpm,
      bpmType: typeof bpm,
      bpmString: bpm.toString(),
      bpmFixed: Number(bpm).toFixed(10)
    });
    
    this.audioContext = audioContext;
    this.audioElement = audioElement;
    this.bpm = bpm;
    this.deckId = deckId;
    this.loopBars = loopBars;
    this.loopDuration = this.calculateLoopDuration();
    
    // 🎵 Initialize content-aware analyzer
    this.contentAnalyzer = new ContentAwareLooper(audioContext);
    
    console.log(`🔄 PreciseLooper initialized for Deck ${deckId}: ${bpm} BPM, ${this.loopDuration.toFixed(2)}s loop`);
  }

  // 🎵 NEW: Analyze audio buffer for content-aware looping
  async analyzeAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
    try {
      console.log(`🔍 analyzeAudioBuffer Debug for Deck ${this.deckId}:`, {
        inputBPM: this.bpm,
        bpmType: typeof this.bpm,
        bpmString: this.bpm.toString(),
        bpmFixed: Number(this.bpm).toFixed(10),
        bars: 8
      });
      
      this.loopBoundaries = await this.contentAnalyzer.analyzeLoopContent(
        audioBuffer,
        this.bpm,
        this.loopBars // Dynamic bar length
      );
      
      // Update loop duration based on content analysis
      this.loopDuration = this.loopBoundaries.actualLoopDuration;
      
      console.log(`🎵 Deck ${this.deckId} Content Analysis:`, {
        mathematical: this.loopBoundaries.mathematicalDuration.toFixed(2) + 's',
        actual: this.loopBoundaries.actualLoopDuration.toFixed(2) + 's',
        contentStart: this.loopBoundaries.contentStart.toFixed(2) + 's',
        contentEnd: this.loopBoundaries.contentEnd.toFixed(2) + 's',
        confidence: (this.loopBoundaries.confidence * 100).toFixed(0) + '%',
        strategy: this.getLoopingStrategy()
      });
    } catch (error) {
      console.warn(`⚠️ Deck ${this.deckId} content analysis failed, using mathematical calculation:`, error);
      this.loopBoundaries = null;
      this.loopDuration = this.calculateLoopDuration();
    }
  }

  // 🎵 NEW: Get human-readable description of looping strategy
  private getLoopingStrategy(): string {
    if (!this.loopBoundaries) return 'Mathematical BPM';
    
    const mathDuration = this.loopBoundaries.mathematicalDuration;
    const actualDuration = this.loopBoundaries.actualLoopDuration;
    const confidence = this.loopBoundaries.confidence;
    const durationRatio = actualDuration / mathDuration;
    
    // Match the enhanced strategy logic
    if (confidence > 0.8 && Math.abs(durationRatio - 1.0) < 0.1) {
      return 'Mathematical (high confidence match)';
    } else if (confidence > 0.8 && Math.abs(actualDuration - mathDuration) < 0.1) {
      return 'Mathematical BPM (a cappella/vocal detected)';
    } else if (durationRatio < 0.7 && confidence > 0.6) {
      return 'Content-trimmed (padded file detected)';
    } else if (actualDuration < mathDuration * 0.85) {
      return 'File-length limited';
    } else if (confidence === 0.0) {
      return 'Mathematical fallback (0% confidence)';
    } else {
      return 'Mathematical BPM (trusted metadata)';
    }
  }

  // Calculate loop duration based on BPM and dynamic bar length  
  private calculateLoopDuration(): number {
    console.log(`🔍 PreciseLooper calculateLoopDuration Debug for Deck ${this.deckId}:`, {
      currentBPM: this.bpm,
      loopBars: this.loopBars,
      bpmType: typeof this.bpm,
      bpmString: this.bpm.toString(),
      bpmFixed: Number(this.bpm).toFixed(10)
    });
    
    const beatsPerBar = 4;
    const totalBeats = this.loopBars * beatsPerBar; // Dynamic beats total
    const secondsPerBeat = 60 / this.bpm;
    const duration = totalBeats * secondsPerBeat;
    
    console.log(`🔍 PreciseLooper Duration Calculation:`, {
      beatsPerBar: beatsPerBar,
      totalBeats: totalBeats,
      secondsPerBeat: secondsPerBeat.toFixed(10),
      calculatedDuration: duration.toFixed(10),
      expectedFor174: ((32 * 60) / 174).toFixed(10),
      expectedFor173: ((32 * 60) / 173).toFixed(10)
    });
    
    return duration;
  }

  // Find the next beat boundary for sync timing
  private getNextBeatTime(): number {
    const now = this.audioContext.currentTime;
    const beatDuration = 60 / this.bpm;
    const beatsElapsed = Math.floor(now / beatDuration);
    return (beatsElapsed + 1) * beatDuration;
  }

  // Core scheduling loop - runs every 25ms for precision
  private schedule(): void {
    const currentTime = this.audioContext.currentTime;
    
    // Schedule loop events 100ms ahead
    while (this.nextLoopTime < currentTime + this.scheduleAheadTime) {
      this.scheduleLoopReset(this.nextLoopTime);
      this.nextLoopTime += this.loopDuration;
    }
    
    // Continue scheduling if still looping
    if (this.isLooping) {
      this.schedulerTimeoutId = window.setTimeout(() => this.schedule(), this.scheduleInterval * 1000);
    }
  }

  // Schedule precise loop reset at exact timing
  private scheduleLoopReset(time: number): void {
    console.log(`🔄 Deck ${this.deckId} scheduling loop reset at ${time.toFixed(3)}s (${(time - this.audioContext.currentTime).toFixed(3)}s ahead)`);
    
    // Schedule the loop reset using Web Audio API precision
    setTimeout(() => {
      if (this.isLooping && this.audioElement) {
        try {
          // Use currentTime from audio context for sample-accurate timing
          const targetTime = this.audioContext.currentTime;
          const audioTimeBeforeReset = this.audioElement.currentTime;
          
          // 🎯 NEW: Calculate loop start position based on bar offset
          const barDuration = (60 / this.bpm) * 4; // 4 beats per bar
          const loopStartTime = this.loopStartPosition * barDuration;
          
          this.audioElement.currentTime = loopStartTime;
          console.log(`🎯 Deck ${this.deckId} LOOP EXECUTED: ${audioTimeBeforeReset.toFixed(3)}s → ${loopStartTime.toFixed(3)}s (bar ${this.loopStartPosition}) at ${targetTime.toFixed(3)}s`);
        } catch (error) {
          console.warn(`⚠️ Deck ${this.deckId} loop reset failed:`, error);
        }
      } else {
        console.log(`🔄 Deck ${this.deckId} loop reset skipped - isLooping: ${this.isLooping}, audioElement: ${!!this.audioElement}`);
      }
    }, (time - this.audioContext.currentTime) * 1000);
  }

  // Start precise looping
  startLooping(): void {
    if (this.isLooping) {
      console.log(`🔄 Deck ${this.deckId} startLooping() called but already looping`);
      return;
    }
    
    // 🔄 NEW: Check if looping is enabled
    if (!this.loopEnabled) {
      console.log(`🔄 Deck ${this.deckId} startLooping() called but looping is DISABLED - will play through normally`);
      return;
    }
    
    this.isLooping = true;
    this.nextLoopTime = this.getNextBeatTime(); // Sync to beat boundary
    console.log(`🔄 Deck ${this.deckId} starting precise looping, next loop at ${this.nextLoopTime.toFixed(3)}s`);
    console.log(`🔄 Deck ${this.deckId} current audio context time: ${this.audioContext.currentTime.toFixed(3)}s`);
    console.log(`🔄 Deck ${this.deckId} BPM: ${this.bpm}, loop duration: ${this.loopDuration.toFixed(3)}s`);
    console.log(`🔄 Deck ${this.deckId} audio element currentTime: ${this.audioElement.currentTime.toFixed(3)}s`);
    console.log(`🔄 Deck ${this.deckId} audio element paused: ${this.audioElement.paused}`);
    this.schedule();
  }

  // Stop precise looping
  stopLooping(): void {
    if (!this.isLooping) return;
    
    this.isLooping = false;
    if (this.schedulerTimeoutId) {
      clearTimeout(this.schedulerTimeoutId);
      this.schedulerTimeoutId = null;
    }
    console.log(`🔄 Deck ${this.deckId} stopped precise looping`);
  }

  // Update BPM and recalculate timing
  updateBPM(newBPM: number): void {
    console.log(`🔄 PreciseLooper updateBPM Debug for Deck ${this.deckId}:`, {
      inputBPM: newBPM,
      bpmType: typeof newBPM,
      bpmString: newBPM.toString(),
      bpmFixed: Number(newBPM).toFixed(10)
    });
    this.bpm = newBPM;
    this.loopDuration = this.calculateLoopDuration();
    console.log(`🔄 Deck ${this.deckId} BPM updated to ${newBPM}, new loop duration: ${this.loopDuration.toFixed(2)}s`);
  }

  // 🔄 NEW: Update loop length and recalculate duration
  updateLoopLength(newLoopBars: number): void {
    console.log(`🔄 PreciseLooper updateLoopLength Debug for Deck ${this.deckId}:`, {
      oldLoopBars: this.loopBars,
      newLoopBars: newLoopBars,
      oldDuration: this.loopDuration.toFixed(3) + 's'
    });
    
    this.loopBars = newLoopBars;
    this.loopDuration = this.calculateLoopDuration();
    
    // Re-analyze content if buffer is available
    if (this.loopBoundaries) {
      console.log(`🔄 Deck ${this.deckId} re-analyzing content for ${newLoopBars} bars`);
      // Note: This would need the audio buffer, which isn't stored in PreciseLooper
      // The re-analysis should happen at the audio controls level
    }
    
    console.log(`🔄 Deck ${this.deckId} loop length updated to ${newLoopBars} bars, new duration: ${this.loopDuration.toFixed(2)}s`);
  }

  // 🎵 NEW: Get loop boundaries for waveform display
  getLoopBoundaries(): LoopBoundaries | null {
    return this.loopBoundaries;
  }

  // 🔄 NEW: Get current loop duration for sync calculations
  getLoopDuration(): number {
    return this.loopDuration;
  }

  // Check if currently looping (public method)
  isCurrentlyLooping(): boolean {
    return this.isLooping;
  }

  // 🔄 NEW: Enable/disable looping per deck
  setLoopEnabled(enabled: boolean): void {
    this.loopEnabled = enabled;
    console.log(`🔄 Deck ${this.deckId} looping ${enabled ? 'ENABLED' : 'DISABLED'}`);
    
    // If disabling looping while currently looping, stop it
    if (!enabled && this.isLooping) {
      this.stopLooping();
      console.log(`🔄 Deck ${this.deckId} stopped looping due to disable`);
    }
  }

  // 🎯 NEW: Set loop start position in bars
  setLoopPosition(position: number): void {
    this.loopStartPosition = Math.max(0, position);
    console.log(`🎯 Deck ${this.deckId} loop position set to bar ${this.loopStartPosition}`);
    
    // If currently looping, we might want to update the loop immediately
    // For now, the position will take effect on the next loop cycle
  }

  // Cleanup resources
  cleanup(): void {
    this.stopLooping();
    console.log(`🧹 Deck ${this.deckId} PreciseLooper cleaned up`);
  }
}

export interface MixerAudioControls {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  setBPM: (bpm: number) => void; // 🔄 Update BPM for precise looping
  setLoopLength: (bars: number) => void; // 🔄 Update loop length
  setLoopEnabled: (enabled: boolean) => void; // 🔄 Enable/disable looping
  setLoopPosition: (position: number) => void; // 🎯 Set loop start position
  setHiCut: (enabled: boolean) => void; // 🎛️ Enable/disable high-cut EQ
  setLoCut: (enabled: boolean) => void; // 🎛️ Enable/disable low-cut EQ
  cleanup: () => void;
}

export class MixerAudioEngine {
  private static audioContext: AudioContext | null = null;
  private static masterGain: GainNode | null = null;
  // Track all active audio elements for cleanup and monitoring
  private static activeAudioElements: Set<HTMLAudioElement> = new Set();

  // Initialize the global audio context (only once)
  static async initializeAudioContext(): Promise<AudioContext> {
    if (!this.audioContext) {
      try {
        // Use singleton AudioContext
        this.audioContext = await audioContextManager.getAudioContext();
        console.log('🎵 MixerAudioEngine: Using singleton AudioContext');

        // Create master gain node
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        
        console.log('🎵 Mixer Audio Context initialized successfully, state:', this.audioContext.state);
      } catch (error) {
        console.error('🚨 Failed to initialize Audio Context:', error);
        throw error;
      }
    }
    
    return this.audioContext;
  }

  // MC Claude's Fresh Audio Element Pattern - Extended for Mixer with Seamless Looping
  static createFreshAudioElement(src: string): HTMLAudioElement {
    console.log('🎵 Creating fresh audio element with CORS solution + PRECISE LOOPING');

    // Create completely fresh audio element each time
    const audio = new Audio();

    // Set crossOrigin BEFORE setting src (critical order per MC Claude)
    audio.crossOrigin = 'anonymous';
    audio.volume = 1.0;
    audio.preload = 'auto';

    // 🔄 REMOVED: No longer using basic browser looping
    // audio.loop = true; // Replaced with PreciseLooper

    // Add cache-busting parameter for HTTP URLs only (not blob URLs!)
    const isBlob = src.startsWith('blob:');
    let finalSrc = src;

    if (!isBlob) {
      const separator = src.includes('?') ? '&' : '?';
      finalSrc = `${src}${separator}v=${Date.now()}`;
    }

    audio.src = finalSrc;

    // 🚨 CRITICAL: Append to DOM for proper CORS handling (MC Claude's solution)
    document.body.appendChild(audio);

    // Track this element for monitoring and cleanup
    this.activeAudioElements.add(audio);
    console.log(`✅ Audio element appended to DOM and tracked (${this.activeAudioElements.size} active)`);

    console.log('🔄 Audio element configured for PRECISE LOOPING (no more gaps!)');

    return audio;
  }

  // Create a complete mixer audio deck with Web Audio API integration
  static async createMixerDeck(audioUrl: string, deckId: 'A' | 'B', isRadio: boolean = false): Promise<{
    state: MixerAudioState;
    controls: MixerAudioControls;
  }> {
    console.log(`🎛️ Creating mixer deck ${deckId} with audio:`, audioUrl.substring(0, 50) + '...', isRadio ? '📻 RADIO MODE' : '');
    
    try {
      // Initialize audio context
      const audioContext = await this.initializeAudioContext();
      
              // Create fresh audio element using MC Claude's pattern
        const audio = this.createFreshAudioElement(audioUrl);
      
      // Wait for audio to be ready with proper cleanup on failure
      try {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error(`🚨 Deck ${deckId} audio load timeout after 10s`);
            console.error(`🚨 Audio state:`, {
              readyState: audio.readyState,
              networkState: audio.networkState,
              error: audio.error,
              src: audio.src
            });
            reject(new Error('Audio load timeout'));
          }, 10000);

          audio.addEventListener('canplaythrough', () => {
            clearTimeout(timeout);
            console.log(`✅ Deck ${deckId} audio ready (canplaythrough)`);
            resolve(true);
          }, { once: true });

          audio.addEventListener('error', (e) => {
            clearTimeout(timeout);
            const errorDetails = {
              code: audio.error?.code,
              message: audio.error?.message,
              networkState: audio.networkState,
              readyState: audio.readyState,
              src: audio.src
            };
            console.error(`🚨 Deck ${deckId} audio error event:`, errorDetails);
            reject(new Error(`Audio load error: ${audio.error?.message || `Code ${audio.error?.code}` || 'Unknown error'}`));
          }, { once: true });
        });
      } catch (loadError) {
        // Cleanup audio element on load failure
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
        this.activeAudioElements.delete(audio);
        console.error(`🚨 Deck ${deckId} audio load failed, cleaned up element`);
        throw loadError;
      }

      // Create Web Audio API nodes for professional mixing
      const source = audioContext.createMediaElementSource(audio);
      const gainNode = audioContext.createGain();
      const hiCutNode = audioContext.createBiquadFilter();
      const loCutNode = audioContext.createBiquadFilter();
      const analyzerNode = audioContext.createAnalyser();


      // Configure EQ nodes - Hi-Cut (low-pass filter to remove highs)
      hiCutNode.type = 'lowpass';
      hiCutNode.frequency.value = 20000; // Full range initially (bypassed)
      hiCutNode.Q.value = 0.7; // Gentle slope

      // Configure EQ nodes - Lo-Cut (high-pass filter to remove lows)
      loCutNode.type = 'highpass';
      loCutNode.frequency.value = 20; // Full range initially (bypassed)
      loCutNode.Q.value = 0.7; // Gentle slope

      // Configure analyzer for waveform visualization
      analyzerNode.fftSize = 1024; // Optimized: 1024 provides plenty of detail for visual waveforms (was 2048)
      analyzerNode.smoothingTimeConstant = 0.8;
      console.log(`🎛️ Deck ${deckId} analyzer node created:`, analyzerNode);

      // Connect audio graph: source → lo-cut → hi-cut → gain → analyzer → master
      // FX chain and gate will be inserted between hiCutNode and gainNode by SimplifiedMixer
      source.connect(loCutNode);
      loCutNode.connect(hiCutNode);
      hiCutNode.connect(gainNode);
      gainNode.connect(analyzerNode);
      analyzerNode.connect(this.masterGain!);

      // Initialize state
      const state: MixerAudioState = {
        audio,
        audioContext,
        source,
        gainNode,
        hiCutNode,
        loCutNode,
        analyzerNode,
        isLoaded: true,
        isPlaying: false,
        currentTime: 0,
        duration: audio.duration || 0,
        bpm: 120, // Default, will be updated from track data
        // 🔄 Initialize PreciseLooper with default 8-bar loop
        preciseLooper: new PreciseLooper(audioContext, audio, 120, deckId, 8)
      };

      // 🎵 NEW: Load audio buffer for content analysis (skip for radio streams)
      if (!isRadio) {
        try {
          console.log(`🎵 Deck ${deckId} loading audio buffer for content analysis...`);
          const response = await fetch(audioUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          state.audioBuffer = audioBuffer;
          console.log(`🎵 Deck ${deckId} audio buffer loaded: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.sampleRate}Hz`);
        } catch (bufferError) {
          console.warn(`⚠️ Deck ${deckId} could not load audio buffer for analysis:`, bufferError);
          // Continue without buffer - will use mathematical calculations
        }
      } else {
        console.log(`📻 Deck ${deckId} is radio stream - skipping buffer load`);
      }

      // Create controls interface
      const controls: MixerAudioControls = {
        play: async () => {
          try {
            console.log(`🎵 Deck ${deckId} play() called`);
            console.log(`🎵 Deck ${deckId} preciseLooper exists: ${!!state.preciseLooper}`);
            console.log(`🎵 Deck ${deckId} audio element exists: ${!!audio}`);
            console.log(`🎵 Deck ${deckId} audio element src: ${audio.src.substring(0, 50)}...`);
            
            await audio.play();
            state.isPlaying = true;
            
            // 🔄 NEW: Track loop start time for sync calculations
            state.loopStartTime = audioContext.currentTime;
            
            console.log(`🎵 Deck ${deckId} audio.play() completed, loopStartTime: ${state.loopStartTime.toFixed(3)}s`);
            
            // 🔄 NEW: Start precise looping when audio plays
            if (state.preciseLooper) {
              console.log(`🎵 Deck ${deckId} calling preciseLooper.startLooping()`);
              state.preciseLooper.startLooping();
            } else {
              console.error(`🚨 Deck ${deckId} preciseLooper is null/undefined!`);
            }
            
            console.log(`🎵 Deck ${deckId} playing with precise looping (started at ${state.loopStartTime.toFixed(3)}s)`);
          } catch (error) {
            console.error(`🚨 Failed to play deck ${deckId}:`, error);
            throw error;
          }
        },

        pause: () => {
          audio.pause();
          state.isPlaying = false;
          
          // 🔄 NEW: Stop precise looping when audio pauses
          if (state.preciseLooper) {
            state.preciseLooper.stopLooping();
          }
          
          console.log(`🎵 Deck ${deckId} paused`);
        },

        stop: () => {
          audio.pause();
          audio.currentTime = 0;
          state.isPlaying = false;
          state.currentTime = 0;
          
          // 🔄 NEW: Stop precise looping when audio stops
          if (state.preciseLooper) {
            state.preciseLooper.stopLooping();
          }
          
          console.log(`⏹️ Deck ${deckId} stopped, precise looping stopped`);
        },

        setVolume: (volume: number) => {
          const clampedVolume = Math.max(0, Math.min(1, volume));
          gainNode.gain.value = clampedVolume;
          console.log(`🔊 Deck ${deckId} volume: ${Math.round(clampedVolume * 100)}%`);
        },

        setPlaybackRate: (rate: number) => {
          const clampedRate = Math.max(0.5, Math.min(2.0, rate));
          audio.playbackRate = clampedRate;
          console.log(`⚡ Deck ${deckId} playback rate: ${clampedRate.toFixed(2)}x`);
        },

        // 🔄 NEW: Update BPM for precise looping
        setBPM: (bpm: number) => {
          state.bpm = bpm;
          if (state.preciseLooper) {
            state.preciseLooper.updateBPM(bpm);
            
            // 🎵 NEW: Run content analysis with new BPM if buffer is available
            if (state.audioBuffer) {
              state.preciseLooper.analyzeAudioBuffer(state.audioBuffer).then(() => {
                console.log(`🎵 Deck ${deckId} content analysis completed with BPM ${bpm}`);
              }).catch(error => {
                console.warn(`⚠️ Deck ${deckId} content analysis failed:`, error);
              });
            }
          }
          console.log(`🎵 Deck ${deckId} BPM updated to ${bpm} for precise looping`);
        },

        // 🔄 NEW: Update loop length for dynamic bar selection
        setLoopLength: (bars: number) => {
          if (state.preciseLooper) {
            state.preciseLooper.updateLoopLength(bars);
            
            // 🎵 NEW: Re-analyze content with new loop length if buffer is available
            if (state.audioBuffer) {
              state.preciseLooper.analyzeAudioBuffer(state.audioBuffer).then(() => {
                console.log(`🎵 Deck ${deckId} content analysis completed with ${bars} bars`);
              }).catch(error => {
                console.warn(`⚠️ Deck ${deckId} content analysis failed:`, error);
              });
            }
          }
          console.log(`🎵 Deck ${deckId} loop length updated to ${bars} bars`);
        },

        // 🔄 NEW: Enable/disable looping independently per deck
        setLoopEnabled: (enabled: boolean) => {
          if (state.preciseLooper) {
            state.preciseLooper.setLoopEnabled(enabled);
          }
          console.log(`🔄 Deck ${deckId} looping ${enabled ? 'ENABLED' : 'DISABLED'}`);
        },

        // 🎯 NEW: Set loop start position in bars
        setLoopPosition: (position: number) => {
          if (state.preciseLooper) {
            state.preciseLooper.setLoopPosition(position);
          }
          console.log(`🎯 Deck ${deckId} loop position set to bar ${position}`);
        },

        // 🎛️ NEW: High-cut EQ control (removes high frequencies)
        setHiCut: (enabled: boolean) => {
          const now = audioContext.currentTime;
          if (enabled) {
            // Cut frequencies above 2kHz - VERY noticeable, DJ-style
            hiCutNode.frequency.cancelScheduledValues(now);
            hiCutNode.frequency.setTargetAtTime(2000, now, 0.015);
            hiCutNode.Q.cancelScheduledValues(now);
            hiCutNode.Q.setTargetAtTime(1.5, now, 0.015); // Steeper slope for more dramatic effect
            console.log(`🎛️ Deck ${deckId} HI-CUT enabled (removing highs above 2kHz - muffled/warm sound)`);
          } else {
            // Restore full range
            hiCutNode.frequency.cancelScheduledValues(now);
            hiCutNode.frequency.setTargetAtTime(20000, now, 0.015);
            hiCutNode.Q.cancelScheduledValues(now);
            hiCutNode.Q.setTargetAtTime(0.7, now, 0.015);
            console.log(`🎛️ Deck ${deckId} HI-CUT disabled (full range)`);
          }
        },

        // 🎛️ Low-cut EQ control (removes low frequencies)
        setLoCut: (enabled: boolean) => {
          const now = audioContext.currentTime;
          if (enabled) {
            // Cut frequencies below 500Hz - VERY noticeable, removes most bass/kick
            loCutNode.frequency.cancelScheduledValues(now);
            loCutNode.frequency.setTargetAtTime(500, now, 0.015);
            loCutNode.Q.cancelScheduledValues(now);
            loCutNode.Q.setTargetAtTime(1.5, now, 0.015); // Steeper slope for more dramatic effect
            console.log(`🎛️ Deck ${deckId} LO-CUT enabled (removing lows below 500Hz - thin/tinny sound)`);
          } else {
            // Restore full range
            loCutNode.frequency.cancelScheduledValues(now);
            loCutNode.frequency.setTargetAtTime(20, now, 0.015);
            loCutNode.Q.cancelScheduledValues(now);
            loCutNode.Q.setTargetAtTime(0.7, now, 0.015);
            console.log(`🎛️ Deck ${deckId} LO-CUT disabled (full range)`);
          }
        },

        cleanup: () => {
          console.log(`🧹 Cleaning up deck ${deckId} audio`);

          // 🔄 NEW: Cleanup precise looper first
          if (state.preciseLooper) {
            state.preciseLooper.cleanup();
          }

          // AGGRESSIVE CLEANUP: Stop all audio immediately
          audio.pause();
          audio.currentTime = 0;

          // Clear the source to stop loading
          audio.src = '';
          audio.load(); // Force audio element to reset

          // 🚨 CRITICAL: Remove from DOM (MC Claude's pattern)
          if (audio.parentNode) {
            audio.parentNode.removeChild(audio);
            console.log(`✅ Deck ${deckId} audio element removed from DOM`);
          }

          // Remove from tracking set
          MixerAudioEngine.activeAudioElements.delete(audio);
          console.log(`✅ Deck ${deckId} audio element untracked (${MixerAudioEngine.activeAudioElements.size} remaining)`);

          // Disconnect all Web Audio nodes
          try {
            source.disconnect();
            loCutNode.disconnect();
            hiCutNode.disconnect();
            gainNode.disconnect();
            analyzerNode.disconnect();
            console.log(`✅ Deck ${deckId} audio nodes disconnected`);
          } catch (error) {
            console.warn(`⚠️ Deck ${deckId} cleanup warning:`, error);
          }

          // Reset state completely
          state.isLoaded = false;
          state.isPlaying = false;
          state.currentTime = 0;

          console.log(`✅ Deck ${deckId} cleanup completed`);
        }
      };

      // Set up event listeners for state updates with seamless looping monitoring
      audio.addEventListener('loadedmetadata', () => {
        state.duration = audio.duration;
        console.log(`🔄 Deck ${deckId} loaded: ${state.duration.toFixed(2)}s (seamless looping enabled)`);
      });

      // Enhanced looping event monitoring
      audio.addEventListener('ended', () => {
        // Check if we're supposed to be looping
        if (state.preciseLooper && state.preciseLooper.isCurrentlyLooping() && state.isPlaying) {
          console.log(`🔄 Deck ${deckId} ended during looping - auto-restarting playback`);
          // Restart playback immediately
          audio.currentTime = 0;
          audio.play().then(() => {
            console.log(`✅ Deck ${deckId} auto-restart successful`);
          }).catch(error => {
            console.error(`🚨 Deck ${deckId} auto-restart failed:`, error);
            state.isPlaying = false;
          });
        } else {
          // Normal ending (not during looping)
          console.log(`🔚 Deck ${deckId} ended (unexpected with looping enabled)`);
          state.isPlaying = false;
        }
      });

      // Monitor for seamless looping and state updates
      let lastTime = 0;
      audio.addEventListener('timeupdate', () => {
        const currentTime = audio.currentTime;
        
        // Detect seamless loop point (time jumped backward significantly)
        if (lastTime > 0 && currentTime < lastTime && (lastTime - currentTime) > 1) {
          console.log(`🔄 Deck ${deckId} seamless loop: ${lastTime.toFixed(2)}s → ${currentTime.toFixed(2)}s`);
        }
        
        lastTime = currentTime;
        state.currentTime = currentTime;
      });

      console.log(`✅ Deck ${deckId} audio system ready`);
      return { state, controls };

    } catch (error) {
      console.error(`🚨 Failed to create mixer deck ${deckId}:`, error);
      throw error;
    }
  }

  // Crossfader implementation with equal-power curve
  static applyCrossfader(deckAGain: GainNode, deckBGain: GainNode, position: number) {
    // Position: 0 = full A, 0.5 = center, 1 = full B
    const clampedPosition = Math.max(0, Math.min(1, position));
    
    // Equal power crossfade curve for professional sound
    const gainA = Math.cos(clampedPosition * Math.PI / 2);
    const gainB = Math.sin(clampedPosition * Math.PI / 2);
    
    deckAGain.gain.value = gainA;
    deckBGain.gain.value = gainB;
    
    console.log(`🎚️ Crossfader: A=${Math.round(gainA * 100)}% B=${Math.round(gainB * 100)}%`);
  }

  // BPM synchronization between decks
  static syncBPM(masterBPM: number, targetDeck: MixerAudioControls, targetBPM: number) {
    const playbackRate = masterBPM / targetBPM;
    targetDeck.setPlaybackRate(playbackRate);
    console.log(`🔄 BPM Sync: ${targetBPM} → ${masterBPM} BPM (rate: ${playbackRate.toFixed(2)}x)`);
  }

  // Get frequency data for waveform visualization with safety checks
  static getFrequencyData(analyzerNode: AnalyserNode | null | undefined): Uint8Array {
    // Safety check: ensure analyzerNode exists and has the required method
    if (!analyzerNode || typeof analyzerNode.getByteFrequencyData !== 'function') {
      console.warn('🚨 Invalid or missing analyzer node, returning empty frequency data');
      return new Uint8Array(128); // Return empty array with standard size
    }

    try {
      const bufferLength = analyzerNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzerNode.getByteFrequencyData(dataArray);
      return dataArray;
    } catch (error) {
      console.warn('🚨 Error getting frequency data:', error);
      return new Uint8Array(128); // Fallback empty array
    }
  }

  // Get the audio context for external use (e.g., FX components)
  static getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  // Get the master gain node for recording
  static getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  // Cleanup all audio resources
  static cleanup() {
    // Clean up all tracked audio elements
    if (this.activeAudioElements.size > 0) {
      console.log(`🧹 Cleaning up ${this.activeAudioElements.size} active audio elements`);
      this.activeAudioElements.forEach(audio => {
        audio.pause();
        audio.src = '';
        if (audio.parentNode) {
          audio.parentNode.removeChild(audio);
        }
      });
      this.activeAudioElements.clear();
      console.log('✅ All audio elements cleaned up');
    }

    // Note: We do NOT close the audioContext as it's a singleton
    // Just disconnect and nullify references
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    this.audioContext = null; // Remove reference but don't close
    console.log('🧹 Mixer Audio resources cleaned up (AudioContext singleton preserved)');
  }
}

// 🎛️ EXPORT: Make SimpleLoopSync available for mixer integration
export { SimpleLoopSync };

// Export utility function for easy integration
export const createMixerAudio = MixerAudioEngine.createMixerDeck.bind(MixerAudioEngine);
export const initMixerAudio = MixerAudioEngine.initializeAudioContext.bind(MixerAudioEngine);
export const applyCrossfader = MixerAudioEngine.applyCrossfader.bind(MixerAudioEngine);
export const syncBPM = MixerAudioEngine.syncBPM.bind(MixerAudioEngine);
export const getFrequencyData = MixerAudioEngine.getFrequencyData.bind(MixerAudioEngine);
export const getAudioContext = MixerAudioEngine.getAudioContext.bind(MixerAudioEngine);
export const getMasterGain = MixerAudioEngine.getMasterGain.bind(MixerAudioEngine); 