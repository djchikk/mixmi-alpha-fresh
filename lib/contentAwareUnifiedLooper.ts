/**
 * Content-Aware Unified Looper - Enhanced Professional DJ Looping System
 * Based on MC Claude's Master Clock + Content-Aware Integration Architecture
 * 
 * Extends the existing UnifiedLooper with:
 * - Content boundary detection and analysis
 * - Intelligent strategy selection (content-aware/file-matched/mathematical)
 * - Preprocessing during track loading
 * - Professional confidence scoring
 * - Cached content analysis results
 */

import { ContentAnalysisEngine, LoopMetadata, ContentBoundaries } from './contentAwareEngine';
import { ContentAwareMasterClock } from './contentAwareMasterClock';

/**
 * Enhanced Unified Looper with Content Awareness
 * Maintains all Master Clock benefits while adding precise content boundary detection
 */
export class ContentAwareUnifiedLooper {
  private deckId: string;
  private audioElement: HTMLAudioElement;
  private audioContext: AudioContext;
  private masterClock: ContentAwareMasterClock;
  private contentAnalyzer: ContentAnalysisEngine;
  
  // Core looping state
  private bpm: number;
  private isLooping: boolean = false;
  private currentLoopEventId: string | null = null;
  private loopStartTime: number = 0;
  
  // Content-aware properties
  private audioBuffer: AudioBuffer | null = null;
  private loopMetadata: LoopMetadata | null = null;
  private trackId: string = '';
  
  // Loop timing based on strategy
  private loopStart: number = 0;
  private loopEnd: number = 0;
  private loopDuration: number = 0;

  constructor(
    deckId: string,
    audioElement: HTMLAudioElement,
    audioContext: AudioContext,
    masterClock: ContentAwareMasterClock,
    bpm: number
  ) {
    this.deckId = deckId;
    this.audioElement = audioElement;
    this.audioContext = audioContext;
    this.masterClock = masterClock;
    this.bpm = bpm;
    this.contentAnalyzer = new ContentAnalysisEngine(audioContext);
    
    console.log(`🎵 Content-Aware Unified Looper: Initialized for deck ${deckId}`);
  }

  /**
   * Enhanced track loading with content analysis preprocessing
   * MC Claude's one-time analysis pattern (10-20ms cost)
   */
  async setBuffer(buffer: AudioBuffer, bpm: number, trackId: string): Promise<void> {
    this.audioBuffer = buffer;
    this.bpm = bpm;
    this.trackId = trackId;
    
    console.log(`🎵 Content-Aware Looper: Starting analysis for ${trackId}...`);
    
    // Perform content analysis during loading (one-time cost)
    const boundaries = await this.contentAnalyzer.analyzeContent(buffer, trackId);
    
    // Calculate all duration strategies
    const mathematicalDuration = this.calculate8BarDuration();
    const fileDuration = this.audioElement.duration || buffer.duration;
    const contentDuration = boundaries.contentEnd - boundaries.contentStart;
    
    // Determine optimal strategy using MC Claude's algorithm
    const strategy = this.contentAnalyzer.determineLoopStrategy(
      mathematicalDuration,
      fileDuration,
      contentDuration,
      boundaries
    );
    
    // Create complete loop metadata
    this.loopMetadata = {
      fileDuration,
      mathematicalDuration,
      contentDuration,
      loopStrategy: strategy,
      boundaries
    };
    
    // Apply the selected strategy
    this.applyLoopStrategy();
    
    // Cache metadata in Master Clock for sync operations
    this.masterClock.setLoopMetadata(this.deckId, this.loopMetadata);
    
    console.log(`🎵 Content-Aware Analysis Complete: ${trackId}`, {
      strategy,
      mathematical: mathematicalDuration.toFixed(3) + 's',
      file: fileDuration.toFixed(3) + 's', 
      content: contentDuration.toFixed(3) + 's',
      silencePadding: boundaries.silencePadding.toFixed(3) + 's',
      confidence: (boundaries.confidence * 100).toFixed(0) + '%',
      analysisTime: boundaries.analysisTime.toFixed(0) + 'ms',
      loopStart: this.loopStart.toFixed(3) + 's',
      loopEnd: this.loopEnd.toFixed(3) + 's',
      loopDuration: this.loopDuration.toFixed(3) + 's'
    });
  }

  /**
   * Apply the selected loop strategy to set precise timing
   * MC Claude's strategy-based boundary selection
   */
  private applyLoopStrategy(): void {
    if (!this.loopMetadata) return;
    
    switch (this.loopMetadata.loopStrategy) {
      case 'content-aware':
        // Use precise content boundaries (solves 612ms silence padding issue)
        this.loopStart = this.loopMetadata.boundaries.contentStart;
        this.loopEnd = this.loopMetadata.boundaries.contentEnd;
        this.loopDuration = this.loopMetadata.contentDuration;
        console.log(`🎯 Content-Aware Strategy: Using precise content boundaries (${this.loopDuration.toFixed(3)}s)`);
        break;
        
      case 'file-matched':
        // File matches mathematical (like 174 BPM case)
        this.loopStart = 0;
        this.loopEnd = this.loopMetadata.fileDuration;
        this.loopDuration = this.loopMetadata.fileDuration;
        console.log(`🎯 File-Matched Strategy: Using full file duration (${this.loopDuration.toFixed(3)}s)`);
        break;
        
      case 'mathematical':
        // Mathematical fallback for reliability
        this.loopStart = 0;
        this.loopDuration = this.loopMetadata.mathematicalDuration;
        this.loopEnd = this.loopDuration;
        console.log(`🎯 Mathematical Strategy: Using BPM calculation (${this.loopDuration.toFixed(3)}s)`);
        break;
    }
  }

  /**
   * Start content-aware looping with Master Clock coordination
   */
  startLooping(): void {
    if (this.isLooping) {
      console.log(`🏆 Content-Aware Looper: Deck ${this.deckId} already looping`);
      return;
    }

    if (!this.loopMetadata) {
      console.warn(`🚨 Content-Aware Looper: No metadata for deck ${this.deckId} - cannot start`);
      return;
    }

    this.isLooping = true;
    this.loopStartTime = this.audioContext.currentTime;
    
    // Schedule first loop using content-aware Master Clock
    const nextLoopTime = this.loopStartTime + this.loopDuration;
    
    this.currentLoopEventId = this.masterClock.scheduleContentAwareLoop(
      this.deckId,
      nextLoopTime,
      () => this.executeContentAwareLoop()
    );

    console.log(`🏆 Content-Aware Looper: Deck ${this.deckId} started at ${this.loopStartTime.toFixed(3)}s, next loop at ${nextLoopTime.toFixed(3)}s`, {
      strategy: this.loopMetadata.loopStrategy,
      duration: this.loopDuration.toFixed(3) + 's',
      start: this.loopStart.toFixed(3) + 's',
      end: this.loopEnd.toFixed(3) + 's'
    });
  }

  /**
   * Stop content-aware looping
   */
  stopLooping(): void {
    if (!this.isLooping) return;

    this.isLooping = false;
    
    // Cancel scheduled loop event
    if (this.currentLoopEventId) {
      this.masterClock.cancelEvent(this.currentLoopEventId);
      this.currentLoopEventId = null;
    }

    console.log(`🏆 Content-Aware Looper: Deck ${this.deckId} stopped`);
  }

  /**
   * Execute content-aware loop with precise boundary timing
   * Handles all three strategies with proper audio positioning
   */
  private executeContentAwareLoop(): void {
    if (!this.isLooping || !this.audioElement || !this.loopMetadata) return;

    try {
      const actualCurrentTime = this.audioContext.currentTime;
      const audioCurrentTime = this.audioElement.currentTime;
      
      // Enhanced debugging for MC Claude's precision analysis
      console.log(`🔧 Content-Aware Loop Execution: Deck ${this.deckId}`, {
        strategy: this.loopMetadata.loopStrategy,
        audioContextTime: actualCurrentTime.toFixed(4),
        audioElementTime: audioCurrentTime.toFixed(4),
        expectedLoopStartTime: this.loopStartTime.toFixed(4),
        loopDuration: this.loopDuration.toFixed(4),
        loopStart: this.loopStart.toFixed(4),
        loopEnd: this.loopEnd.toFixed(4),
        timeSinceLoopStart: (actualCurrentTime - this.loopStartTime).toFixed(4),
        expectedEndTime: (this.loopStartTime + this.loopDuration).toFixed(4),
        actualTimeDifference: (actualCurrentTime - (this.loopStartTime + this.loopDuration)).toFixed(4)
      });
      
      // Content-aware loop reset (sets position based on strategy)
      this.audioElement.currentTime = this.loopStart;
      
      // Calculate next loop time with proper Master Clock timing
      this.loopStartTime += this.loopDuration;
      const nextLoopTime = this.loopStartTime + this.loopDuration;
      
      // Schedule next loop using content-aware Master Clock
      this.currentLoopEventId = this.masterClock.scheduleContentAwareLoop(
        this.deckId,
        nextLoopTime,
        () => this.executeContentAwareLoop()
      );

      console.log(`🏆 Content-Aware Loop: Deck ${this.deckId} looped at ${this.loopStart.toFixed(3)}s, next at ${nextLoopTime.toFixed(3)}s`, {
        strategy: this.loopMetadata.loopStrategy,
        precision: this.loopDuration.toFixed(3) + 's timing'
      });
      
    } catch (error) {
      console.error(`🚨 Content-Aware Looper ERROR: Deck ${this.deckId}:`, error);
      this.stopLooping();
    }
  }

  /**
   * Update BPM with content-aware recalculation
   */
  updateBPM(newBPM: number, forceRecalculation: boolean = false): void {
    this.bpm = newBPM;
    
    if (this.loopMetadata && (forceRecalculation || this.loopMetadata.loopStrategy === 'mathematical')) {
      // Recalculate mathematical duration
      const newMathematicalDuration = this.calculate8BarDuration();
      this.loopMetadata.mathematicalDuration = newMathematicalDuration;
      
      // Re-determine strategy with new BPM
      const strategy = this.contentAnalyzer.determineLoopStrategy(
        newMathematicalDuration,
        this.loopMetadata.fileDuration,
        this.loopMetadata.contentDuration,
        this.loopMetadata.boundaries
      );
      
      this.loopMetadata.loopStrategy = strategy;
      this.applyLoopStrategy();
      
      // Update Master Clock metadata
      this.masterClock.setLoopMetadata(this.deckId, this.loopMetadata);
    }
    
    console.log(`🏆 Content-Aware BPM Update: Deck ${this.deckId} BPM updated to ${newBPM}`, {
      strategy: this.loopMetadata?.loopStrategy || 'pending',
      duration: this.loopDuration.toFixed(3) + 's'
    });
  }

  /**
   * Calculate mathematical 8-bar duration (base calculation)
   */
  private calculate8BarDuration(): number {
    const beatsPerBar = 4;
    const bars = 8;
    const totalBeats = beatsPerBar * bars;
    const secondsPerBeat = 60 / this.bpm;
    return totalBeats * secondsPerBeat;
  }

  /**
   * Check if currently looping
   */
  isCurrentlyLooping(): boolean {
    return this.isLooping;
  }

  /**
   * Get next loop time from Master Clock
   */
  getNextLoopTime(): number | null {
    return this.masterClock.getNextLoopTime(this.deckId);
  }

  /**
   * Get current loop metadata for debugging/sync
   */
  getLoopMetadata(): LoopMetadata | null {
    return this.loopMetadata;
  }

  /**
   * Get content analysis cache statistics
   */
  getCacheStats(): { size: number; trackIds: string[] } {
    return this.contentAnalyzer.getCacheStats();
  }

  /**
   * Clear content analysis cache
   */
  clearCache(): void {
    this.contentAnalyzer.clearCache();
  }

  /**
   * Force re-analysis of current track (for debugging)
   */
  async reanalyzeCurrentTrack(): Promise<void> {
    if (this.audioBuffer && this.trackId) {
      this.contentAnalyzer.clearCache(); // Clear cache for fresh analysis
      await this.setBuffer(this.audioBuffer, this.bpm, this.trackId);
    }
  }
} 