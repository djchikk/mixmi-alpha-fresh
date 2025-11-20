/**
 * Utility functions for AI assistance display and formatting
 */

import { IPTrack } from '@/types';

/**
 * Get the display text for AI assistance status
 * Returns emoji + text based on what AI was used for
 */
export function getAIAssistanceDisplay(track: IPTrack): {
  emoji: string;
  text: string;
  hasAI: boolean;
} {
  const ideaAI = track.ai_assisted_idea || false;
  const implementationAI = track.ai_assisted_implementation || false;

  // Neither - 100% Human
  if (!ideaAI && !implementationAI) {
    return {
      emoji: '🙌',
      text: '100% Human',
      hasAI: false
    };
  }

  // Both - AI-Assisted (Concept & Production)
  if (ideaAI && implementationAI) {
    return {
      emoji: '🤖',
      text: 'AI-Assisted (Concept & Production)',
      hasAI: true
    };
  }

  // Idea only - AI-Assisted (Concept)
  if (ideaAI) {
    return {
      emoji: '🤖',
      text: 'AI-Assisted (Concept)',
      hasAI: true
    };
  }

  // Implementation only - AI-Assisted (Production)
  return {
    emoji: '🤖',
    text: 'AI-Assisted (Production)',
    hasAI: true
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
