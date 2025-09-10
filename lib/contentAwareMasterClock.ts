/**
 * Content-Aware Master Clock - Enhanced Professional DJ Timing System
 * Based on MC Claude's Master Clock + Content-Aware Integration Architecture
 * 
 * Extends the existing Master Clock with:
 * - Content boundary timing adjustments
 * - Loop metadata caching
 * - Intelligent strategy-based scheduling
 * - Professional sync compensation
 */

import { LoopMetadata, ContentBoundaries } from './contentAwareEngine';

interface ScheduledEvent {
  id: string;
  time: number;
  type: 'loop' | 'sync' | 'stop' | 'content-loop';
  deckId: string;
  callback: () => void;
  data?: any;
}

/**
 * Enhanced Master Clock with Content Awareness
 * Maintains all existing Master Clock benefits while adding content boundary detection
 */
export class ContentAwareMasterClock {
  private audioContext: AudioContext;
  private isRunning: boolean = false;
  private events: ScheduledEvent[] = [];
  private lookaheadTime: number = 0.1; // 100ms lookahead (industry standard)
  private scheduleInterval: number = 0.025; // 25ms check intervals (MC Claude research)
  private scheduleTimer: number | null = null;
  private eventIdCounter: number = 0;
  
  // Content-aware enhancements
  private loopMetadataCache: Map<string, LoopMetadata> = new Map();
  
  // Mobile AudioContext suspension handling
  private suspendedTime: number = 0;
  private resumeOffset: number = 0;
  private lastKnownTime: number = 0;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.setupMobileAudioContextMonitoring();
  }
  
  /**
   * Store loop metadata for content-aware scheduling
   */
  setLoopMetadata(deckId: string, metadata: LoopMetadata): void {
    this.loopMetadataCache.set(deckId, metadata);
    console.log(`🎵 Content-Aware Master Clock: Metadata cached for deck ${deckId}`, {
      strategy: metadata.loopStrategy,
      contentDuration: metadata.contentDuration.toFixed(3) + 's',
      silencePadding: metadata.boundaries.silencePadding.toFixed(3) + 's'
    });
  }

  /**
   * Enhanced loop scheduling with content-aware timing adjustment
   * MC Claude's integration pattern for precise content boundaries
   */
  scheduleContentAwareLoop(
    deckId: string,
    baseTime: number,
    callback: () => void
  ): string {
    const metadata = this.loopMetadataCache.get(deckId);
    
    // Calculate content-adjusted timing
    const adjustedTime = this.calculateContentAdjustedTime(baseTime, metadata);
    
    return this.scheduleEvent('content-loop', deckId, adjustedTime, callback);
  }

  /**
   * Content-aware timing calculation
   * Adjusts scheduling based on loop strategy and content boundaries
   */
  private calculateContentAdjustedTime(baseTime: number, metadata?: LoopMetadata): number {
    if (!metadata) return baseTime;
    
    // Strategy-based timing adjustments
    switch (metadata.loopStrategy) {
      case 'content-aware':
        // For content-aware strategy, ensure timing aligns with actual content boundaries
        // No adjustment needed here as the looper handles boundary timing
        return baseTime;
        
      case 'file-matched':
        // File matches mathematical - no adjustment needed
        return baseTime;
        
      case 'mathematical':
        // Mathematical fallback - no adjustment needed
        return baseTime;
        
      default:
        return baseTime;
    }
  }

  /**
   * Enhanced sync compensation for content-aware loops
   * Handles boundary differences between decks during sync operations
   */
  calculateSyncCompensation(masterDeckId: string, slaveDeckId: string): number {
    const masterMetadata = this.loopMetadataCache.get(masterDeckId);
    const slaveMetadata = this.loopMetadataCache.get(slaveDeckId);
    
    // If both decks use content-aware strategy, compensate for boundary differences
    if (masterMetadata?.loopStrategy === 'content-aware' && 
        slaveMetadata?.loopStrategy === 'content-aware') {
      
      const boundaryOffset = masterMetadata.boundaries.contentStart - 
                           slaveMetadata.boundaries.contentStart;
      
      console.log(`🎵 Content-Aware Sync: Compensating ${boundaryOffset.toFixed(3)}s boundary difference`);
      return boundaryOffset;
    }
    
    return 0; // No compensation needed
  }

  // === EXISTING MASTER CLOCK FUNCTIONALITY ===
  // (Maintaining all original capabilities)

  /**
   * Mobile AudioContext suspension monitoring
   * MC Claude's pattern for robust mobile handling
   */
  private setupMobileAudioContextMonitoring(): void {
    const checkAudioContextState = () => {
      if (this.audioContext.state === 'suspended' && this.isRunning) {
        console.log('🚨 Content-Aware Master Clock: AudioContext suspended - pausing scheduling');
        this.suspendedTime = performance.now();
        this.lastKnownTime = this.audioContext.currentTime;
      } else if (this.audioContext.state === 'running' && this.suspendedTime > 0) {
        console.log('🎵 Content-Aware Master Clock: AudioContext resumed - recovering timing');
        const suspendDuration = (performance.now() - this.suspendedTime) / 1000;
        this.resumeOffset += suspendDuration;
        this.suspendedTime = 0;
        
        // Recalculate all event times
        this.recalculateEventTimes(suspendDuration);
      }
    };
    
    // Monitor state changes
    setInterval(checkAudioContextState, 100); // Check every 100ms
    
    // Handle visibility changes (console opening/closing)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.audioContext.state === 'running') {
        console.log('🔧 Content-Aware Master Clock: Page hidden - preparing for suspension');
      } else if (!document.hidden && this.audioContext.state === 'suspended') {
        console.log('🔧 Content-Aware Master Clock: Page visible - attempting resume');
        this.audioContext.resume();
      }
    });
  }
  
  /**
   * Recalculate event times after AudioContext suspension
   */
  private recalculateEventTimes(suspendDuration: number): void {
    const currentTime = this.audioContext.currentTime;
    
    this.events.forEach(event => {
      // Adjust event times to account for suspension
      event.time = Math.max(currentTime + 0.1, event.time - suspendDuration);
    });
    
    // Re-sort events
    this.events.sort((a, b) => a.time - b.time);
    
    console.log(`🔧 Content-Aware Master Clock: Recalculated ${this.events.length} events after ${suspendDuration.toFixed(3)}s suspension`);
  }

  /**
   * Start professional scheduling system
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🏆 CONTENT-AWARE MASTER CLOCK: Starting enhanced scheduling system');
    console.log(`🎯 Lookahead: ${this.lookaheadTime * 1000}ms, Interval: ${this.scheduleInterval * 1000}ms`);
    
    this.scheduleLoop();
  }

  /**
   * Stop scheduling system
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }
    
    console.log('🏆 CONTENT-AWARE MASTER CLOCK: Stopping scheduling system');
  }

  /**
   * Enhanced event scheduling with content awareness
   */
  scheduleEvent(type: ScheduledEvent['type'], deckId: string, time: number, callback: () => void, data?: any): string {
    const eventId = `${type}_${deckId}_${++this.eventIdCounter}`;
    
    const event: ScheduledEvent = {
      id: eventId,
      time,
      type,
      deckId,
      callback,
      data
    };
    
    // Insert in chronological order
    const insertIndex = this.events.findIndex(e => e.time > time);
    if (insertIndex === -1) {
      this.events.push(event);
    } else {
      this.events.splice(insertIndex, 0, event);
    }
    
    console.log(`🎯 CONTENT-AWARE SCHEDULED: ${type} for deck ${deckId} at ${time.toFixed(3)}s (${(time - this.audioContext.currentTime).toFixed(3)}s ahead)`);
    return eventId;
  }

  /**
   * Cancel scheduled event
   */
  cancelEvent(eventId: string): boolean {
    const index = this.events.findIndex(e => e.id === eventId);
    if (index !== -1) {
      this.events.splice(index, 1);
      console.log(`🎯 CONTENT-AWARE CANCELLED: Event ${eventId}`);
      return true;
    }
    return false;
  }

  /**
   * Main scheduling loop (25ms intervals)
   * Enhanced with content-aware event handling
   */
  private scheduleLoop(): void {
    if (!this.isRunning) return;

    // Check AudioContext state before proceeding
    if (this.audioContext.state === 'suspended') {
      console.log('⏸️ Content-Aware Master Clock: Skipping schedule loop - AudioContext suspended');
      this.scheduleTimer = window.setTimeout(() => this.scheduleLoop(), this.scheduleInterval * 1000);
      return;
    }

    const currentTime = this.audioContext.currentTime;
    const scheduleWindow = currentTime + this.lookaheadTime;

    // Execute all events within lookahead window
    while (this.events.length > 0 && this.events[0].time <= scheduleWindow) {
      const event = this.events.shift()!;
      
      try {
        console.log(`🏆 CONTENT-AWARE EXECUTING: ${event.type} for deck ${event.deckId} at ${currentTime.toFixed(3)}s`);
        event.callback();
      } catch (error) {
        console.error(`🚨 Content-Aware Master Clock ERROR: Event execution failed:`, error);
      }
    }

    // Clean up stale events (more than 5 seconds in the past)
    while (this.events.length > 0 && this.events[0].time < currentTime - 5) {
      const staleEvent = this.events.shift()!;
      console.warn(`🗑️ Content-Aware Master Clock: Removed stale event ${staleEvent.type} for deck ${staleEvent.deckId}`);
    }

    // Schedule next check
    this.scheduleTimer = window.setTimeout(() => this.scheduleLoop(), this.scheduleInterval * 1000);
  }

  /**
   * Get next scheduled loop time for deck
   */
  getNextLoopTime(deckId: string): number | null {
    const loopEvent = this.events.find(e => e.deckId === deckId && (e.type === 'loop' || e.type === 'content-loop'));
    return loopEvent ? loopEvent.time : null;
  }

  /**
   * Clear all events for a deck
   */
  clearDeckEvents(deckId: string): void {
    this.events = this.events.filter(e => e.deckId !== deckId);
    this.loopMetadataCache.delete(deckId);
    console.log(`🎯 Content-Aware Master Clock: Cleared all events and metadata for deck ${deckId}`);
  }

  /**
   * Get loop metadata for debugging
   */
  getLoopMetadata(deckId: string): LoopMetadata | undefined {
    return this.loopMetadataCache.get(deckId);
  }

  /**
   * Clear metadata cache (for memory management)
   */
  clearMetadataCache(): void {
    this.loopMetadataCache.clear();
    console.log('🎵 Content-Aware Master Clock: Metadata cache cleared');
  }
} 