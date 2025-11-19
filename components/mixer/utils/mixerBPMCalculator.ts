/**
 * mixerBPMCalculator.ts
 *
 * BPM calculation utilities for the Universal Mixer.
 * Determines master BPM based on content type priority and manual overrides.
 *
 * Priority hierarchy:
 * 1. Manual override (user-selected master deck)
 * 2. Loop (priority 3)
 * 3. Full song (priority 2)
 * 4. Radio stations are always ignored for BPM
 *
 * @author Sandy Hoover & Claude Code
 * @created 2025-11-19
 */

import { Track } from '../types';

export interface DeckState {
  track: Track | null;
  contentType?: string;
}

/**
 * Determine master BPM based on manual selection or content-type hierarchy
 *
 * @param deckA - Deck A state with track and content type
 * @param deckB - Deck B state with track and content type
 * @param masterDeckId - Optional manual master deck override ('A' or 'B')
 * @returns The calculated master BPM (default 120)
 */
export function determineMasterBPM(
  deckA: DeckState,
  deckB: DeckState,
  masterDeckId?: 'A' | 'B'
): number {
  // 🎯 HIGHEST PRIORITY: If user manually set master, use that (but not for radio)
  if (masterDeckId) {
    if (masterDeckId === 'A' && deckA.track?.bpm &&
        deckA.contentType !== 'radio_station' && deckA.contentType !== 'grabbed_radio') {
      console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (manual override)`);
      return deckA.track.bpm;
    } else if (masterDeckId === 'B' && deckB.track?.bpm &&
        deckB.contentType !== 'radio_station' && deckB.contentType !== 'grabbed_radio') {
      console.log(`🎵 Master BPM: ${deckB.track.bpm} from Deck B (manual override)`);
      return deckB.track.bpm;
    }
  }

  // Radio stations should NOT affect master BPM - completely ignore them
  const isRadioA = deckA.contentType === 'radio_station' || deckA.contentType === 'grabbed_radio';
  const isRadioB = deckB.contentType === 'radio_station' || deckB.contentType === 'grabbed_radio';

  // If both are radio, default to 120
  if (isRadioA && isRadioB) {
    console.log(`🎵 Master BPM: 120 (both decks are radio)`);
    return 120;
  }

  // If only one is radio, use the non-radio deck's BPM
  if (isRadioA && deckB.track?.bpm) {
    console.log(`🎵 Master BPM: ${deckB.track.bpm} from Deck B (${deckB.contentType}, radio ignored)`);
    return deckB.track.bpm;
  }
  if (isRadioB && deckA.track?.bpm) {
    console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (${deckA.contentType}, radio ignored)`);
    return deckA.track.bpm;
  }

  // Neither is radio - use priority system for loops vs songs
  const getPriority = (contentType?: string): number => {
    if (contentType === 'loop') return 3;
    if (contentType === 'full_song') return 2;
    return 0;
  };

  const priorityA = getPriority(deckA.contentType);
  const priorityB = getPriority(deckB.contentType);

  // Higher priority deck sets BPM
  if (priorityA > priorityB && deckA.track?.bpm) {
    console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (${deckA.contentType})`);
    return deckA.track.bpm;
  } else if (priorityB > priorityA && deckB.track?.bpm) {
    console.log(`🎵 Master BPM: ${deckB.track.bpm} from Deck B (${deckB.contentType})`);
    return deckB.track.bpm;
  } else if (priorityA === priorityB && deckA.track?.bpm) {
    // Same priority, use Deck A
    console.log(`🎵 Master BPM: ${deckA.track.bpm} from Deck A (same priority, default)`);
    return deckA.track.bpm;
  } else if (deckB.track?.bpm) {
    // Fallback to Deck B if A has no BPM
    console.log(`🎵 Master BPM: ${deckB.track.bpm} from Deck B (fallback)`);
    return deckB.track.bpm;
  }

  // Default to 120 BPM
  console.log(`🎵 Master BPM: 120 (default)`);
  return 120;
}
