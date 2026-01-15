/**
 * Utility functions for AI assistance display and formatting
 */

import { IPTrack } from '@/types';

/**
 * Get the display text for AI assistance status
 * Returns emoji + text based on whether AI collaborated
 *
 * Two states only - keeping it simple:
 * - Neither flag: 100% Human (purely human creation)
 * - Any AI flag: Human/AI Collab (AI contributed as a collaborator)
 *
 * Philosophy: AI is a collaborator with standing, not a tool or threat.
 * Music is always human-created; AI helps with visuals, curation, etc.
 */
export function getAIAssistanceDisplay(track: IPTrack): {
  emoji: string;
  text: string;
  hasAI: boolean;
} {
  const ideaAI = track.ai_assisted_idea || false;
  const implementationAI = track.ai_assisted_implementation || false;

  // Any AI involvement = Human/AI Collab
  if (ideaAI || implementationAI) {
    return {
      emoji: '🙌🤖',
      text: 'Human/AI Collab',
      hasAI: true
    };
  }

  // No AI involvement = 100% Human
  return {
    emoji: '🙌',
    text: '100% Human',
    hasAI: false
  };
}

/**
 * Get a short label for AI assistance (for badges/chips)
 */
export function getAIAssistanceLabel(track: IPTrack): string | null {
  const ideaAI = track.ai_assisted_idea || false;
  const implementationAI = track.ai_assisted_implementation || false;

  if (!ideaAI && !implementationAI) {
    return null; // No badge needed
  }

  return 'AI-Assisted';
}
