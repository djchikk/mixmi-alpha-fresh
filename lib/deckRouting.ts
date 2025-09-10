import { IPTrack } from '@/types';

/**
 * Simple deck routing logic:
 * - First track goes to Deck A
 * - Second track goes to Deck B
 * - All subsequent tracks alternate between decks
 * 
 * @param track - The track to route
 * @param deckACrateLength - Current number of tracks in Deck A
 * @param deckBCrateLength - Current number of tracks in Deck B
 * @returns 'A' or 'B' indicating target deck
 */
export function getSmartDeckRoute(
  track: IPTrack, 
  deckACrateLength: number, 
  deckBCrateLength: number
): 'A' | 'B' {
  const totalTracks = deckACrateLength + deckBCrateLength;
  
  // First track goes to A
  if (totalTracks === 0) {
    return 'A';
  }
  // Second track goes to B
  else if (totalTracks === 1) {
    return 'B';
  }
  // After that, alternate based on which has fewer
  else {
    return deckACrateLength <= deckBCrateLength ? 'A' : 'B';
  }
}