/**
 * Content Analysis Engine - Professional Audio Boundary Detection
 * Based on MC Claude's Master Clock + Content-Aware Integration Architecture
 * 
 * Performs one-time content analysis during track loading with:
 * - Industry-standard -60dBFS threshold detection
 * - RMS-based boundary analysis
 * - Intelligent caching system
 * - Professional confidence scoring
 */

export interface ContentBoundaries {
  contentStart: number;
  contentEnd: number;
  silencePadding: number;
  confidence: number;
  analysisTime: number;
}

export interface LoopMetadata {
  fileDuration: number;
  mathematicalDuration: number;
  contentDuration: number;
  loopStrategy: 'content-aware' | 'mathematical' | 'file-matched';
  boundaries: ContentBoundaries;
}

/**
 * Content Analysis Engine - Runs during track loading
 * Professional audio content boundary detection with caching
 */
export class ContentAnalysisEngine {
  private audioContext: AudioContext;
  private silenceThreshold: number = -60; // dBFS (industry standard)
  private analysisCache: Map<string, ContentBoundaries> = new Map();

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
  }

  /**
   * Analyze content boundaries with intelligent caching
   * @param audioBuffer - Decoded audio buffer
   * @param trackId - Unique track identifier for caching
   * @returns Content boundaries with confidence scoring
   */
  async analyzeContent(
    audioBuffer: AudioBuffer,
    trackId: string
  ): Promise<ContentBoundaries> {
    // Check cache first for performance
    const cached = this.analysisCache.get(trackId);
    if (cached) {
      console.log(`🎵 Content Analysis: Using cached boundaries for ${trackId}`);
      return cached;
    }

    const startTime = performance.now();
    
    // Perform fresh content analysis
    const boundaries = await this.detectContentBoundaries(audioBuffer);
    
    boundaries.analysisTime = performance.now() - startTime;
    
    // Cache results for future use
    this.analysisCache.set(trackId, boundaries);
    
    console.log(`🎵 Content Analysis Complete: ${trackId}`, {
      contentStart: boundaries.contentStart.toFixed(3) + 's',
      contentEnd: boundaries.contentEnd.toFixed(3) + 's',
      silencePadding: boundaries.silencePadding.toFixed(3) + 's',
      confidence: (boundaries.confidence * 100).toFixed(0) + '%',
      analysisTime: boundaries.analysisTime.toFixed(0) + 'ms'
    });
    
    return boundaries;
  }

  /**
   * Professional content boundary detection using RMS analysis
   * Industry-standard -60dBFS threshold with 10ms analysis windows
   */
  private async detectContentBoundaries(audioBuffer: AudioBuffer): Promise<ContentBoundaries> {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms analysis windows
    const linearThreshold = Math.pow(10, this.silenceThreshold / 20); // Convert dBFS to linear
    
    let firstSound = -1;
    let lastSound = -1;
    
    // Forward scan for first sound above threshold
    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      const rms = this.calculateRMS(channelData, i, i + windowSize);
      if (rms > linearThreshold) {
        firstSound = i;
        break;
      }
    }
    
    // Backward scan for last sound above threshold
    for (let i = channelData.length - windowSize; i >= 0; i -= windowSize) {
      const rms = this.calculateRMS(channelData, i, i + windowSize);
      if (rms > linearThreshold) {
        lastSound = i + windowSize;
        break;
      }
    }
    
    // Convert samples to time
    const contentStart = firstSound >= 0 ? firstSound / sampleRate : 0;
    const contentEnd = lastSound >= 0 ? lastSound / sampleRate : audioBuffer.duration;
    const silencePadding = audioBuffer.duration - contentEnd;
    
    // Calculate confidence based on boundary clarity
    const confidence = this.calculateConfidence(channelData, firstSound, lastSound, linearThreshold);
    
    return {
      contentStart,
      contentEnd,
      silencePadding,
      confidence,
      analysisTime: 0 // Will be set by caller
    };
  }

  /**
   * Calculate RMS (Root Mean Square) for audio segment
   * Professional audio analysis technique for signal strength detection
   */
  private calculateRMS(data: Float32Array, start: number, end: number): number {
    let sum = 0;
    const actualEnd = Math.min(end, data.length);
    
    for (let i = start; i < actualEnd; i++) {
      sum += data[i] * data[i];
    }
    
    return Math.sqrt(sum / (actualEnd - start));
  }

  /**
   * Professional confidence calculation based on boundary clarity
   * Higher confidence = clearer content boundaries detected
   */
  private calculateConfidence(
    data: Float32Array,
    firstSound: number,
    lastSound: number,
    threshold: number
  ): number {
    if (firstSound === -1 || lastSound === -1) return 0;
    
    // Sample signal strength around detected boundaries
    const boundaryStart = Math.max(0, firstSound - 1000);
    const boundaryEnd = Math.min(data.length, lastSound + 1000);
    
    const boundaryStrength = this.calculateRMS(data, boundaryStart, boundaryEnd);
    
    // Confidence based on signal-to-threshold ratio
    const confidenceRatio = (boundaryStrength / threshold) / 10;
    
    return Math.min(1, Math.max(0, confidenceRatio));
  }

  /**
   * Intelligent strategy selection based on content analysis
   * MC Claude's three-strategy system for optimal loop timing
   */
  determineLoopStrategy(
    mathematicalDuration: number,
    fileDuration: number,
    contentDuration: number,
    boundaries: ContentBoundaries
  ): 'content-aware' | 'mathematical' | 'file-matched' {
    const tolerance = 0.1; // 100ms tolerance for duration matching (increased sensitivity)
    
    // Strategy 1: Content-aware (improved sensitivity for BPM timing issues)
    if (boundaries.confidence > 0.5 && boundaries.silencePadding > 0.05) {
      // Check if content vs mathematical has significant discrepancy
      const contentMathDiff = Math.abs(contentDuration - mathematicalDuration);
      if (contentMathDiff > tolerance) {
        return 'content-aware'; // Use precise content boundaries for timing mismatches
      }
    }
    
    // Strategy 2: File-matched (like 174 BPM case - file matches mathematical)
    if (Math.abs(fileDuration - mathematicalDuration) < tolerance) {
      return 'file-matched';
    }
    
    // Strategy 3: Mathematical fallback (low confidence or minimal padding)
    return 'mathematical';
  }

  /**
   * Clear analysis cache (for memory management)
   */
  clearCache(): void {
    this.analysisCache.clear();
    console.log('🎵 Content Analysis: Cache cleared');
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { size: number; trackIds: string[] } {
    return {
      size: this.analysisCache.size,
      trackIds: Array.from(this.analysisCache.keys())
    };
  }
} 