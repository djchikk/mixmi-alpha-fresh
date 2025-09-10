/**
 * Singleton AudioContext Manager
 * Ensures only one AudioContext instance exists across the entire application
 * Prevents multiple audio contexts from being created during navigation
 */

class AudioContextManager {
  private static instance: AudioContextManager;
  private audioContext: AudioContext | null = null;
  private initializationPromise: Promise<AudioContext> | null = null;

  private constructor() {}

  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  async getAudioContext(): Promise<AudioContext> {
    // If already initializing, wait for that to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // If already initialized and not closed, return existing
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return this.audioContext;
    }

    // Initialize new context
    this.initializationPromise = this.initializeContext();
    return this.initializationPromise;
  }

  private async initializeContext(): Promise<AudioContext> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Handle AudioContext suspension (mobile compatibility)
      if (this.audioContext.state === 'suspended') {
        const resumeAudioContext = async () => {
          if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
          }
          // Remove listeners after first interaction
          document.removeEventListener('click', resumeAudioContext);
          document.removeEventListener('touchstart', resumeAudioContext);
        };

        document.addEventListener('click', resumeAudioContext);
        document.addEventListener('touchstart', resumeAudioContext);
      }

      console.log('✅ AudioContext initialized (singleton):', this.audioContext.state);
      return this.audioContext;
    } catch (error) {
      console.error('❌ Failed to initialize AudioContext:', error);
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  /**
   * Suspend the audio context (useful for saving resources)
   */
  async suspend(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'running') {
      await this.audioContext.suspend();
      console.log('⏸️ AudioContext suspended');
    }
  }

  /**
   * Resume the audio context
   */
  async resume(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log('▶️ AudioContext resumed');
    }
  }

  /**
   * Get the current state of the audio context
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state || null;
  }

  /**
   * Check if audio context is active and ready
   */
  isReady(): boolean {
    return this.audioContext !== null && this.audioContext.state === 'running';
  }

  /**
   * Close the audio context (only call this on app shutdown)
   * Note: Once closed, a new AudioContext must be created
   */
  async close(): Promise<void> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
      console.log('🔚 AudioContext closed');
    }
  }
}

// Export singleton instance
export const audioContextManager = AudioContextManager.getInstance();