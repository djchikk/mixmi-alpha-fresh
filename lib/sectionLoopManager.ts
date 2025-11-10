/**
 * SectionLoopManager
 *
 * Handles time calculations for dividing songs into 8-bar sections.
 * Each section is exactly 8 bars (32 beats) long.
 *
 * Example: 120 BPM song
 * - 8 bars = 32 beats
 * - 32 beats ÷ 120 BPM = 0.2667 minutes = 16 seconds per section
 */

export interface SectionTimeRange {
  startTime: number;  // in seconds
  endTime: number;    // in seconds
  duration: number;   // in seconds
  sectionIndex: number;
}

export class SectionLoopManager {
  private static readonly BEATS_PER_BAR = 4;
  private static readonly BARS_PER_SECTION = 8;
  private static readonly BEATS_PER_SECTION = SectionLoopManager.BEATS_PER_BAR * SectionLoopManager.BARS_PER_SECTION; // 32

  /**
   * Calculate the duration of one 8-bar section in seconds
   *
   * @param bpm - Beats per minute
   * @returns Duration in seconds
   */
  static getSectionDuration(bpm: number): number {
    if (!bpm || bpm <= 0) {
      console.warn('⚠️ Invalid BPM for section calculation, defaulting to 120');
      bpm = 120;
    }

    // seconds per section = (beats per section / BPM) * 60
    const secondsPerSection = (this.BEATS_PER_SECTION / bpm) * 60;
    return secondsPerSection;
  }

  /**
   * Get the time range for a specific section
   *
   * @param sectionIndex - Zero-based section index
   * @param bpm - Beats per minute
   * @param nudgeOffsetBars - Nudge offset in bars (can be fractional, e.g., 0.125 for 1/8 bar)
   * @returns Time range object with start, end, and duration
   */
  static getSectionTimeRange(sectionIndex: number, bpm: number, nudgeOffsetBars: number = 0): SectionTimeRange {
    const sectionDuration = this.getSectionDuration(bpm);

    // Calculate nudge offset in seconds
    const secondsPerBar = (this.BEATS_PER_BAR / bpm) * 60;
    const nudgeOffsetSeconds = nudgeOffsetBars * secondsPerBar;

    // Apply nudge offset to section boundaries
    const startTime = (sectionIndex * sectionDuration) + nudgeOffsetSeconds;
    const endTime = startTime + sectionDuration;

    return {
      startTime,
      endTime,
      duration: sectionDuration,
      sectionIndex
    };
  }

  /**
   * Calculate total number of 8-bar sections in a song
   *
   * @param songDuration - Total song duration in seconds
   * @param bpm - Beats per minute
   * @returns Number of complete sections (rounded up to include partial sections)
   */
  static getTotalSections(songDuration: number, bpm: number): number {
    if (!songDuration || songDuration <= 0) {
      console.warn('⚠️ Invalid song duration');
      return 0;
    }

    const sectionDuration = this.getSectionDuration(bpm);
    const totalSections = Math.ceil(songDuration / sectionDuration);

    console.log('📊 Section calculation:', {
      songDuration: songDuration.toFixed(2),
      bpm,
      sectionDuration: sectionDuration.toFixed(2),
      totalSections
    });

    return totalSections;
  }

  /**
   * Determine which section contains a given playback time
   *
   * @param currentTime - Current playback time in seconds
   * @param bpm - Beats per minute
   * @returns Zero-based section index
   */
  static getSectionFromTime(currentTime: number, bpm: number): number {
    const sectionDuration = this.getSectionDuration(bpm);
    const sectionIndex = Math.floor(currentTime / sectionDuration);
    return sectionIndex;
  }

  /**
   * Validate if a section index is valid for a given song
   *
   * @param sectionIndex - Section index to validate
   * @param songDuration - Total song duration in seconds
   * @param bpm - Beats per minute
   * @returns True if section index is valid
   */
  static isValidSection(sectionIndex: number, songDuration: number, bpm: number): boolean {
    if (sectionIndex < 0) return false;
    const totalSections = this.getTotalSections(songDuration, bpm);
    return sectionIndex < totalSections;
  }

  /**
   * Get all section time ranges for a song
   *
   * @param songDuration - Total song duration in seconds
   * @param bpm - Beats per minute
   * @returns Array of section time ranges
   */
  static getAllSectionRanges(songDuration: number, bpm: number): SectionTimeRange[] {
    const totalSections = this.getTotalSections(songDuration, bpm);
    const sections: SectionTimeRange[] = [];

    for (let i = 0; i < totalSections; i++) {
      sections.push(this.getSectionTimeRange(i, bpm));
    }

    return sections;
  }

  /**
   * Format section label for display
   *
   * @param sectionIndex - Zero-based section index
   * @returns Formatted label (e.g., "Section 1", "Section 2")
   */
  static getSectionLabel(sectionIndex: number): string {
    return `Section ${sectionIndex + 1}`;
  }

  /**
   * Get section info for debugging/display
   *
   * @param sectionIndex - Section index
   * @param bpm - Beats per minute
   * @returns Human-readable section info
   */
  static getSectionInfo(sectionIndex: number, bpm: number): string {
    const range = this.getSectionTimeRange(sectionIndex, bpm);
    const startMins = Math.floor(range.startTime / 60);
    const startSecs = Math.floor(range.startTime % 60);
    const endMins = Math.floor(range.endTime / 60);
    const endSecs = Math.floor(range.endTime % 60);

    return `${this.getSectionLabel(sectionIndex)} (${startMins}:${startSecs.toString().padStart(2, '0')} - ${endMins}:${endSecs.toString().padStart(2, '0')})`;
  }
}
