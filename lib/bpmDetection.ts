// =====================================================
// BPM Detection Utility for 8-Bar Loops
// =====================================================
// 
// Calculates BPM from audio file duration assuming standard 8-bar loop format
// Formula: BPM = (8 bars × 4 beats/bar × 60 seconds) / duration_in_seconds
//          BPM = 1920 / duration_in_seconds
//
// =====================================================

export interface BPMDetectionResult {
  detected: boolean;
  bpm: number | null;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

/**
 * Detects BPM from audio file duration assuming 8-bar loop
 * @param audioFile - Audio file to analyze
 * @returns Promise with BPM detection result
 */
export async function detectBPMFromAudioFile(audioFile: File): Promise<BPMDetectionResult> {
  try {
    const duration = await getAudioDuration(audioFile);
    return detectBPMFromDuration(duration);
  } catch (error) {
    console.error('Error detecting BPM from audio file:', error);
    return {
      detected: false,
      bpm: null,
      confidence: 'low',
      reasoning: 'Failed to analyze audio file'
    };
  }
}

/**
 * Detects BPM from duration assuming 8-bar loop
 * @param durationSeconds - Duration in seconds
 * @returns BPM detection result
 */
export function detectBPMFromDuration(durationSeconds: number): BPMDetectionResult {
  if (durationSeconds <= 0) {
    return {
      detected: false,
      bpm: null,
      confidence: 'low',
      reasoning: 'Invalid duration'
    };
  }

  // Calculate BPM assuming 8 bars × 4 beats = 32 beats total
  const exactBPM = 1920 / durationSeconds;
  
  // 🔧 ENHANCED: More intelligent rounding to preserve accuracy
  // Round to nearest 0.5 BPM for better precision, then to integer
  const halfRoundedBPM = Math.round(exactBPM * 2) / 2;
  const calculatedBPM = Math.round(halfRoundedBPM);
  
  // 🔍 DEBUG: Log the rounding process to understand precision loss
  console.log(`🔍 BPM Detection Precision Debug:`, {
    durationSeconds: durationSeconds.toFixed(3),
    exactBPM: exactBPM.toFixed(6),
    halfRoundedBPM: halfRoundedBPM.toFixed(1),
    finalCalculatedBPM: calculatedBPM,
    roundingDifference: (calculatedBPM - exactBPM).toFixed(3)
  });

  // Validate BPM is in reasonable range for music
  if (calculatedBPM < 60 || calculatedBPM > 200) {
    return {
      detected: false,
      bpm: calculatedBPM,
      confidence: 'low',
      reasoning: `Calculated BPM (${calculatedBPM}) outside typical range (60-200). May not be 8-bar loop.`
    };
  }

  // Determine confidence based on duration ranges that typically produce good BPMs
  let confidence: 'high' | 'medium' | 'low';
  let reasoning: string;

  if (durationSeconds >= 8 && durationSeconds <= 32) {
    // 8-32 seconds = 60-240 BPM range (most common)
    confidence = 'high';
    reasoning = `Duration ${durationSeconds.toFixed(1)}s suggests ${calculatedBPM} BPM for 8-bar loop`;
  } else if (durationSeconds >= 6 && durationSeconds <= 40) {
    // 6-40 seconds = 48-320 BPM range (reasonable)
    confidence = 'medium';  
    reasoning = `Duration ${durationSeconds.toFixed(1)}s suggests ${calculatedBPM} BPM (please verify)`;
  } else {
    // Outside typical loop duration ranges
    confidence = 'low';
    reasoning = `Unusual duration ${durationSeconds.toFixed(1)}s for 8-bar loop. BPM ${calculatedBPM} may be incorrect.`;
  }

  return {
    detected: true,
    bpm: calculatedBPM,
    confidence,
    reasoning
  };
}

/**
 * Gets audio file duration using Web Audio API
 * @param audioFile - Audio file to analyze
 * @returns Promise with duration in seconds
 */
async function getAudioDuration(audioFile: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    
    audio.onloadedmetadata = () => {
      resolve(audio.duration);
    };
    
    audio.onerror = () => {
      reject(new Error('Failed to load audio metadata'));
    };
    
    // Create object URL and load
    const url = URL.createObjectURL(audioFile);
    audio.src = url;
    
    // Clean up object URL after loading
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
  });
}

/**
 * Common BPM ranges for different genres (for validation/suggestions)
 */
export const BPM_RANGES = {
  'Hip Hop': { min: 70, max: 140 },
  'House': { min: 120, max: 130 },
  'Techno': { min: 120, max: 140 },
  'Drum & Bass': { min: 160, max: 180 },
  'Dubstep': { min: 135, max: 145 },
  'Trap': { min: 100, max: 160 },
  'Pop': { min: 100, max: 130 },
  'Rock': { min: 110, max: 140 },
  'Jazz': { min: 120, max: 180 },
  'Ambient': { min: 60, max: 90 }
} as const;

/**
 * Suggests likely genres based on detected BPM
 * @param bpm - Detected BPM
 * @returns Array of likely genre matches
 */
export function suggestGenresForBPM(bpm: number): string[] {
  const matches: string[] = [];
  
  for (const [genre, range] of Object.entries(BPM_RANGES)) {
    if (bpm >= range.min && bpm <= range.max) {
      matches.push(genre);
    }
  }
  
  return matches;
}

/**
 * Validates if BPM makes sense for a loop
 * @param bpm - BPM to validate
 * @returns Validation result with suggestions
 */
export function validateLoopBPM(bpm: number): {
  valid: boolean;
  suggestions: string[];
} {
  const suggestions: string[] = [];
  
  if (bpm < 60) {
    suggestions.push('BPM seems too slow for most loops. Consider doubling it?');
  } else if (bpm > 200) {
    suggestions.push('BPM seems very fast. Consider halving it?');
  }
  
  if (bpm >= 60 && bpm <= 200) {
    const genres = suggestGenresForBPM(bpm);
    if (genres.length > 0) {
      suggestions.push(`Typical for: ${genres.join(', ')}`);
    }
  }
  
  return {
    valid: bpm >= 60 && bpm <= 200,
    suggestions
  };
} 