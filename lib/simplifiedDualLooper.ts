/**
 * SIMPLIFIED DUAL LOOPER
 * MC Claude's back-to-basics approach - what actually worked!
 * Going back to simple setTimeout scheduling with dual deck support
 */

interface DeckState {
  isPlaying: boolean;
  nextLoopTime: number;
  bpm: number;
  loopDuration: number;
  audioBuffer: AudioBuffer | null;
  currentSource: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
}

export class SimplifiedDualLooper {
  private audioContext: AudioContext;
  private scheduleAheadTime = 0.1;  // 100ms lookahead
  private scheduleInterval = 0.025; // 25ms intervals
  private schedulerTimer: number | null = null;
  
  // Deck states
  private deckA: DeckState;
  private deckB: DeckState;
  
  // Sync state
  private syncEnabled = false;
  private masterBPM = 120;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    
    this.deckA = {
      isPlaying: false,
      nextLoopTime: 0,
      bpm: 120,
      loopDuration: 0,
      audioBuffer: null,
      currentSource: null,
      gainNode: null
    };
    
    this.deckB = {
      isPlaying: false,
      nextLoopTime: 0,
      bpm: 120,
      loopDuration: 0,
      audioBuffer: null,
      currentSource: null,
      gainNode: null
    };

    console.log('🎯 SimplifiedDualLooper initialized - back to working basics!');
  }

  /**
   * SIMPLE MATH - Just use BPM calculation
   * This worked perfectly in the original implementation!
   */
  private calculateLoopDuration(bpm: number): number {
    return (8 * 4 * 60) / bpm; // 8 bars, 4 beats per bar
  }

  /**
   * Load track - NO complex content analysis
   * Just decode and store
   */
  async loadTrack(deck: 'A' | 'B', audioBuffer: AudioBuffer, bpm: number) {
    const deckState = deck === 'A' ? this.deckA : this.deckB;
    
    // Create gain node for volume control
    deckState.gainNode = this.audioContext.createGain();
    deckState.gainNode.connect(this.audioContext.destination);
    
    deckState.audioBuffer = audioBuffer;
    deckState.bpm = bpm;
    deckState.loopDuration = this.calculateLoopDuration(bpm);
    
    console.log(`📀 SimplifiedDualLooper - Deck ${deck} loaded:`, {
      bpm,
      calculatedDuration: deckState.loopDuration.toFixed(3),
      fileDuration: audioBuffer.duration.toFixed(3),
      strategy: 'Mathematical (Simple & Reliable)' 
    });
  }

  /**
   * Start playback - Simple and reliable
   */
  play(deck: 'A' | 'B') {
    const deckState = deck === 'A' ? this.deckA : this.deckB;
    if (!deckState.audioBuffer || deckState.isPlaying) return;
    
    deckState.isPlaying = true;
    
    // If sync is on and other deck is playing, align to beat
    if (this.syncEnabled && this.getOtherDeck(deck).isPlaying) {
      deckState.nextLoopTime = this.getNextBeatTime();
      console.log(`🔄 SimplifiedDualLooper - Deck ${deck} syncing to beat at ${deckState.nextLoopTime.toFixed(3)}s`);
    } else {
      deckState.nextLoopTime = this.audioContext.currentTime;
      console.log(`▶️ SimplifiedDualLooper - Deck ${deck} starting immediately at ${deckState.nextLoopTime.toFixed(3)}s`);
    }
    
    // Start the single scheduler if not running
    if (!this.schedulerTimer) {
      this.startScheduler();
    }
  }

  /**
   * THE WORKING SCHEDULER - From original PreciseLooper
   * Single scheduler for both decks!
   */
  private startScheduler() {
    const schedule = () => {
      const currentTime = this.audioContext.currentTime;
      const scheduleEndTime = currentTime + this.scheduleAheadTime;
      
      // Schedule deck A if playing
      if (this.deckA.isPlaying) {
        while (this.deckA.nextLoopTime < scheduleEndTime) {
          this.scheduleLoop('A', this.deckA.nextLoopTime);
          this.deckA.nextLoopTime += this.deckA.loopDuration;
        }
      }
      
      // Schedule deck B if playing
      if (this.deckB.isPlaying) {
        while (this.deckB.nextLoopTime < scheduleEndTime) {
          this.scheduleLoop('B', this.deckB.nextLoopTime);
          this.deckB.nextLoopTime += this.deckB.loopDuration;
        }
      }
      
      // Continue if any deck is playing
      if (this.deckA.isPlaying || this.deckB.isPlaying) {
        this.schedulerTimer = window.setTimeout(schedule, this.scheduleInterval * 1000);
      } else {
        this.schedulerTimer = null;
        console.log('⏹️ SimplifiedDualLooper scheduler stopped');
      }
    };
    
    console.log('🎛️ SimplifiedDualLooper scheduler started');
    schedule();
  }

  /**
   * Simple loop scheduling - No complex event system
   */
  private scheduleLoop(deck: 'A' | 'B', time: number) {
    const deckState = deck === 'A' ? this.deckA : this.deckB;
    if (!deckState.audioBuffer || !deckState.gainNode) return;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = deckState.audioBuffer;
    source.connect(deckState.gainNode);
    
    // Use mathematical duration for looping - THIS IS KEY!
    source.start(time, 0, deckState.loopDuration);
    
    console.log(`🔄 SimplifiedDualLooper - Deck ${deck} loop scheduled at ${time.toFixed(3)}s, duration: ${deckState.loopDuration.toFixed(3)}s`);
    
    // Clean up old source after it's done
    const previousSource = deckState.currentSource;
    source.onended = () => {
      if (previousSource) {
        previousSource.disconnect();
      }
    };
    
    deckState.currentSource = source;
  }

  /**
   * Enable sync - Simple BPM matching
   */
  enableSync(masterBPM?: number) {
    this.syncEnabled = true;
    this.masterBPM = masterBPM || this.deckA.bpm;
    
    console.log(`🔄 SimplifiedDualLooper sync enabled, master BPM: ${this.masterBPM}`);
    
    // Update deck B to match master BPM
    if (this.deckB.isPlaying && this.deckB.bpm !== this.masterBPM) {
      const ratio = this.masterBPM / this.deckB.bpm;
      
      // Update playback rate of current source
      if (this.deckB.currentSource) {
        this.deckB.currentSource.playbackRate.exponentialRampToValueAtTime(
          ratio,
          this.audioContext.currentTime + 0.5
        );
      }
      
      // Update loop duration for future loops
      this.deckB.loopDuration = this.calculateLoopDuration(this.masterBPM);
      console.log(`🎵 SimplifiedDualLooper - Deck B synced to ${this.masterBPM} BPM`);
    }
  }

  /**
   * Simple beat alignment helper
   */
  private getNextBeatTime(): number {
    const beatDuration = 60 / this.masterBPM;
    const currentTime = this.audioContext.currentTime;
    const timeSinceBeat = currentTime % beatDuration;
    return currentTime + (beatDuration - timeSinceBeat);
  }

  private getOtherDeck(deck: 'A' | 'B'): DeckState {
    return deck === 'A' ? this.deckB : this.deckA;
  }

  /**
   * Stop deck
   */
  stop(deck: 'A' | 'B') {
    const deckState = deck === 'A' ? this.deckA : this.deckB;
    deckState.isPlaying = false;
    
    if (deckState.currentSource) {
      deckState.currentSource.stop();
      deckState.currentSource.disconnect();
      deckState.currentSource = null;
    }
    
    console.log(`⏹️ SimplifiedDualLooper - Deck ${deck} stopped`);
  }

  /**
   * Pause deck
   */
  pause(deck: 'A' | 'B') {
    this.stop(deck); // For now, pause is the same as stop
  }

  /**
   * Update BPM
   */
  updateBPM(deck: 'A' | 'B', bpm: number) {
    const deckState = deck === 'A' ? this.deckA : this.deckB;
    deckState.bpm = bpm;
    deckState.loopDuration = this.calculateLoopDuration(bpm);
    
    console.log(`🎵 SimplifiedDualLooper - Deck ${deck} BPM updated to ${bpm}, new duration: ${deckState.loopDuration.toFixed(3)}s`);
  }

  /**
   * Set volume
   */
  setVolume(deck: 'A' | 'B', volume: number) {
    const deckState = deck === 'A' ? this.deckA : this.deckB;
    if (deckState.gainNode) {
      deckState.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.stop('A');
    this.stop('B');
    
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    
    // Disconnect gain nodes
    if (this.deckA.gainNode) {
      this.deckA.gainNode.disconnect();
      this.deckA.gainNode = null;
    }
    if (this.deckB.gainNode) {
      this.deckB.gainNode.disconnect();
      this.deckB.gainNode = null;
    }
    
    console.log('🧹 SimplifiedDualLooper cleanup complete');
  }

  /**
   * Get deck info
   */
  getDeckInfo(deck: 'A' | 'B') {
    const deckState = deck === 'A' ? this.deckA : this.deckB;
    return {
      isPlaying: deckState.isPlaying,
      bpm: deckState.bpm,
      loopDuration: deckState.loopDuration,
      hasAudio: !!deckState.audioBuffer
    };
  }
} 