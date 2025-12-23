/**
 * Streaming Pass Utilities
 * Manages playlist streaming pass logic with weighted time consumption
 * Songs consume 4x credits vs loops for fair artist compensation
 */

export interface StreamingPass {
  purchaseDate: number; // timestamp
  totalSeconds: number; // total credits purchased
  remainingSeconds: number; // credits remaining
  txId?: string; // Stacks transaction ID
}

const STORAGE_KEY = 'playlist-streaming-pass';

// Pricing: 1 hour (3600 seconds) = 2 STX
export const PASS_PRICE_STX = 2;
export const PASS_DURATION_SECONDS = 3600; // 1 hour

// Time consumption multipliers
export const LOOP_MULTIPLIER = 1; // Loops consume 1x time
export const SONG_MULTIPLIER = 4; // Songs consume 4x time

/**
 * Get current streaming pass from localStorage
 */
export function getStreamingPass(): StreamingPass | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Save streaming pass to localStorage
 */
export function saveStreamingPass(pass: StreamingPass): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pass));
}

/**
 * Check if streaming pass is active and has credits
 */
export function hasActivePass(): boolean {
  const pass = getStreamingPass();
  return pass !== null && pass.remainingSeconds > 0;
}

/**
 * Create a new streaming pass
 */
export function createStreamingPass(txId?: string): StreamingPass {
  const pass: StreamingPass = {
    purchaseDate: Date.now(),
    totalSeconds: PASS_DURATION_SECONDS,
    remainingSeconds: PASS_DURATION_SECONDS,
    txId
  };

  saveStreamingPass(pass);
  return pass;
}

/**
 * Consume streaming time based on content type
 * @param seconds Real playback seconds
 * @param contentType 'loop' or 'full_song'
 * @returns Remaining seconds, or null if no pass
 */
export function consumeStreamingTime(
  seconds: number,
  contentType: 'loop' | 'full_song'
): number | null {
  const pass = getStreamingPass();
  if (!pass) return null;

  // Calculate weighted consumption
  const multiplier = contentType === 'full_song' ? SONG_MULTIPLIER : LOOP_MULTIPLIER;
  const consumed = seconds * multiplier;

  // Deduct from remaining
  pass.remainingSeconds = Math.max(0, pass.remainingSeconds - consumed);

  saveStreamingPass(pass);
  return pass.remainingSeconds;
}

/**
 * Format seconds as MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get human-readable estimate of what remaining time can buy
 */
export function getStreamingEstimate(remainingSeconds: number): string {
  const loopMinutes = Math.floor(remainingSeconds / 60);
  const songMinutes = Math.floor(remainingSeconds / (60 * SONG_MULTIPLIER));

  if (loopMinutes === 0) return 'Less than 1 min of loops';

  return `~${loopMinutes} min of loops or ~${songMinutes} min of songs`;
}

/**
 * Clear streaming pass (for testing or expiry)
 */
export function clearStreamingPass(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
