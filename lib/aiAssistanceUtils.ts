/**
 * Utility functions for AI assistance display and formatting
 */

import { IPTrack } from '@/types';

/**
 * Get the display text for AI assistance status
 * Returns emoji + text based on what AI was used for
 *
 * Three states:
 * - Neither flag: 100% Human
 * - Idea only: AI-Assisted (human-AI collaboration)
 * - Both flags: AI-Generated (minimal human intervention)
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

  // Both - AI-Generated
  if (ideaAI && implementationAI) {
    return {
      emoji: '🤖',
      text: 'AI-Generated',
      hasAI: true
    };
  }

  // Idea only - AI-Assisted
  if (ideaAI) {
    return {
      emoji: '🙌🤖',
      text: 'AI-Assisted',
      hasAI: true
    };
  }

  // Implementation only (edge case, shouldn't happen with current form logic)
  return {
    emoji: '🙌🤖',
    text: 'AI-Assisted',
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
