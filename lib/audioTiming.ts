/**
 * Centralized audio timing utilities for sample-accurate bar/beat calculations
 * Used by mixer recording, waveform display, and audio editing features
 */

const BEATS_PER_BAR = 4;
const SECONDS_PER_MINUTE = 60;

export class AudioTiming {
  /**
   * Calculate the duration in seconds for a given number of bars at a BPM
   * @param bars - Number of bars
   * @param bpm - Beats per minute
   * @returns Duration in seconds
   */
  static calculateBarDuration(bars: number, bpm: number): number {
    const totalBeats = bars * BEATS_PER_BAR;
    const secondsPerBeat = SECONDS_PER_MINUTE / bpm;
    return totalBeats * secondsPerBeat;
  }

  /**
   * Convert time in seconds to bar number
   * @param time - Time in seconds
   * @param bpm - Beats per minute
   * @returns Bar number (can be fractional)
   */
  static timeToBar(time: number, bpm: number): number {
    const secondsPerBeat = SECONDS_PER_MINUTE / bpm;
    const secondsPerBar = BEATS_PER_BAR * secondsPerBeat;
    return time / secondsPerBar;
  }

  /**
   * Convert bar number to time in seconds
   * @param bar - Bar number (can be fractional)
   * @param bpm - Beats per minute
   * @returns Time in seconds
   */
  static barToTime(bar: number, bpm: number): number {
    const secondsPerBeat = SECONDS_PER_MINUTE / bpm;
    const secondsPerBar = BEATS_PER_BAR * secondsPerBeat;
    return bar * secondsPerBar;
  }

  /**
   * Quantize a time value to the nearest bar boundary
   * @param time - Time in seconds
   * @param bpm - Beats per minute
   * @returns Time quantized to nearest bar start
   */
  static quantizeToBar(time: number, bpm: number): number {
    const bar = Math.round(this.timeToBar(time, bpm));
    return this.barToTime(bar, bpm);
  }

  /**
   * Quantize a time value to the nearest beat boundary
   * @param time - Time in seconds
   * @param bpm - Beats per minute
   * @returns Time quantized to nearest beat
   */
  static quantizeToBeat(time: number, bpm: number): number {
    const secondsPerBeat = SECONDS_PER_MINUTE / bpm;
    const beat = Math.round(time / secondsPerBeat);
    return beat * secondsPerBeat;
  }

  /**
   * Get the bar number for a given time (1-indexed for display)
   * @param time - Time in seconds
   * @param bpm - Beats per minute
   * @returns Bar number starting from 1
   */
  static getBarNumber(time: number, bpm: number): number {
    return Math.floor(this.timeToBar(time, bpm)) + 1;
  }

  /**
   * Get the beat within the current bar (1-indexed for display)
   * @param time - Time in seconds
   * @param bpm - Beats per minute
   * @returns Beat number (1-4)
   */
  static getBeatInBar(time: number, bpm: number): number {
    const secondsPerBeat = SECONDS_PER_MINUTE / bpm;
    const totalBeats = time / secondsPerBeat;
    return (Math.floor(totalBeats) % BEATS_PER_BAR) + 1;
  }

  /**
   * Format time as bars:beats for display
   * @param time - Time in seconds
   * @param bpm - Beats per minute
   * @returns Formatted string like "1:1" or "8:4"
   */
  static formatBarBeat(time: number, bpm: number): string {
    const bar = this.getBarNumber(time, bpm);
    const beat = this.getBeatInBar(time, bpm);
    return `${bar}:${beat}`;
  }

  /**
   * Check if a time value is close to a bar boundary
   * @param time - Time in seconds
   * @param bpm - Beats per minute
   * @param toleranceBeats - How close in beats (default 0.1 = 1/10th of a beat)
   * @returns True if within tolerance of bar boundary
   */
  static isNearBarBoundary(time: number, bpm: number, toleranceBeats: number = 0.1): boolean {
    const secondsPerBeat = SECONDS_PER_MINUTE / bpm;
    const tolerance = toleranceBeats * secondsPerBeat;
    const quantized = this.quantizeToBar(time, bpm);
    return Math.abs(time - quantized) < tolerance;
  }
}
