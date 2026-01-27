/**
 * Day Pass Utilities
 *
 * Manages playlist day pass logic:
 * - $1 USDC for 24 hours unlimited streaming
 * - Tracks plays for revenue distribution
 * - Time-based expiry (not credit-based)
 */

export interface DayPass {
  id: string;
  userAddress: string;
  purchasedAt: string;
  expiresAt: string;
  amountUsdc: number;
  txHash?: string;
  status: 'active' | 'expired' | 'distributed';
}

export interface DayPassStatus {
  hasActivePass: boolean;
  dayPassId?: string;
  expiresAt?: string;
  remainingSeconds?: number;
  totalPlays?: number;
}

export interface PlayLogEntry {
  trackId: string;
  contentType: string;
  durationSeconds: number;
}

import { PRICING } from '@/config/pricing';

// Pricing (imported from central config)
export const DAY_PASS_PRICE_USDC = PRICING.streaming.dayPassPrice;
export const DAY_PASS_DURATION_HOURS = PRICING.streaming.dayPassDurationHours;

// Credit values for revenue distribution
export const CREDITS = {
  FULL_SONG: 5,
  LOOP_PACK: 5,
  EP: 5,
  LOOP: 1,
} as const;

/**
 * Calculate credits for a content type
 */
export function calculateCredits(contentType: string): number {
  switch (contentType) {
    case 'full_song':
      return CREDITS.FULL_SONG;
    case 'loop_pack':
    case 'ep':
      return CREDITS.LOOP_PACK;
    default:
      return CREDITS.LOOP;
  }
}

/**
 * Format remaining time as HH:MM:SS
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '00:00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if a day pass is still active
 */
export function isPassActive(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date();
}

/**
 * Calculate expiry time (24 hours from now)
 */
export function calculateExpiryTime(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + DAY_PASS_DURATION_HOURS);
  return expiry;
}

// ============ Client-side API helpers ============

/**
 * Check if current user has an active day pass
 */
export async function checkDayPassStatus(userAddress: string): Promise<DayPassStatus> {
  try {
    const response = await fetch(`/api/day-pass/status?userAddress=${encodeURIComponent(userAddress)}`);
    if (!response.ok) {
      return { hasActivePass: false };
    }
    return response.json();
  } catch (error) {
    console.error('Error checking day pass status:', error);
    return { hasActivePass: false };
  }
}

/**
 * Log a track play (call when track finishes playing)
 */
export async function logPlay(
  dayPassId: string,
  trackId: string,
  contentType: string,
  durationSeconds: number
): Promise<boolean> {
  try {
    const response = await fetch('/api/day-pass/log-play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dayPassId,
        trackId,
        contentType,
        durationSeconds,
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Error logging play:', error);
    return false;
  }
}

/**
 * Initiate day pass purchase
 */
export async function purchaseDayPass(userAddress: string): Promise<{
  success: boolean;
  dayPassId?: string;
  txBytes?: string;
  sponsorSignature?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/day-pass/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userAddress }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error };
    }

    return { success: true, ...data };
  } catch (error) {
    console.error('Error purchasing day pass:', error);
    return { success: false, error: 'Failed to purchase day pass' };
  }
}

// ============ Local storage for offline resilience ============

const LOCAL_STORAGE_KEY = 'mixmi-day-pass';

interface LocalDayPassState {
  dayPassId: string;
  expiresAt: string;
  pendingPlays: PlayLogEntry[];
}

/**
 * Cache day pass state locally (for offline resilience)
 */
export function cacheDayPassLocally(dayPassId: string, expiresAt: string): void {
  if (typeof window === 'undefined') return;

  const state: LocalDayPassState = {
    dayPassId,
    expiresAt,
    pendingPlays: [],
  };

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Get locally cached day pass state
 */
export function getLocalDayPass(): LocalDayPassState | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return null;

  try {
    const state = JSON.parse(stored) as LocalDayPassState;
    // Check if expired
    if (!isPassActive(state.expiresAt)) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

/**
 * Queue a play locally (for offline/retry)
 */
export function queuePlayLocally(play: PlayLogEntry): void {
  if (typeof window === 'undefined') return;

  const state = getLocalDayPass();
  if (!state) return;

  state.pendingPlays.push(play);
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

/**
 * Get and clear pending plays (for sync)
 */
export function flushPendingPlays(): PlayLogEntry[] {
  if (typeof window === 'undefined') return [];

  const state = getLocalDayPass();
  if (!state || state.pendingPlays.length === 0) return [];

  const plays = [...state.pendingPlays];
  state.pendingPlays = [];
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));

  return plays;
}

/**
 * Clear local day pass state
 */
export function clearLocalDayPass(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCAL_STORAGE_KEY);
}
