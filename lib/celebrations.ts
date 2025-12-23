import confetti from 'canvas-confetti';
import { ContentType } from '@/types';

// Beautiful color sets for rotating celebrations
const colorSets = [
  // Golden vibes (perfect for EPs!)
  ['#A8E66B', '#FFF8DC', '#F0E68C', '#DAA520', '#B8860B'],
  
  // Purple dreams (perfect for loop packs!)
  ['#A084F9', '#B19CD9', '#DDA0DD', '#9370DB', '#8A2BE2'],
  
  // Cyan splash (matches our UI accent)
  ['#81E4F2', '#87CEEB', '#ADD8E6', '#40E0D0', '#00CED1'],
  
  // Coral celebration (warm and exciting)
  ['#FF6B6B', '#FF8E8E', '#FFB6C1', '#FFA07A', '#FF7F7F'],
  
  // Teal magic (cool and fresh)
  ['#4ECDC4', '#45B7AA', '#96D1CC', '#20B2AA', '#48D1CC'],
  
  // Rainbow chaos (pure joy!)
  ['#A8E66B', '#A084F9', '#81E4F2', '#FF6B6B', '#4ECDC4', '#FFA500']
];

// Keep track of which color set to use next
let colorSetIndex = 0;

/**
 * Get the next color set and rotate through them
 */
function getNextColorSet(): string[] {
  const colors = colorSets[colorSetIndex];
  colorSetIndex = (colorSetIndex + 1) % colorSets.length;
  return colors;
}

/**
 * Get content-specific colors (while still having variety)
 */
function getContentColors(contentType: ContentType): string[] {
  switch (contentType) {
    case 'ep':
      return ['#A8E66B', '#FFF8DC', '#F0E68C', '#DAA520']; // Gold family
    case 'loop_pack':
      return ['#A084F9', '#B19CD9', '#DDA0DD', '#9370DB']; // Purple family
    case 'full_song':
      return ['#81E4F2', '#87CEEB', '#ADD8E6', '#40E0D0']; // Cyan family
    case 'loop':
      return ['#A084F9', '#B19CD9', '#DDA0DD', '#9370DB']; // Purple family
    default:
      return getNextColorSet();
  }
}

/**
 * Basic celebration - classic confetti burst
 */
export function celebrate() {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: getNextColorSet(),
    gravity: 0.6,
    drift: 0.1,
    scalar: 1.2
  });
}

/**
 * Epic celebration - multiple bursts with variety
 */
export function epicCelebration() {
  const colors = getNextColorSet();
  
  // First burst - center
  confetti({
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: 0.4, y: 0.7 },
    colors
  });
  
  // Second burst - right side
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 0.6, y: 0.7 },
      colors
    });
  }, 150);
  
  // Third burst - finale from top
  setTimeout(() => {
    confetti({
      particleCount: 30,
      spread: 360,
      origin: { x: 0.5, y: 0.3 },
      colors
    });
  }, 300);
}

/**
 * Content-specific celebration with appropriate colors
 */
export function celebrateContentUpload(contentType: ContentType, songCount?: number) {
  const colors = getContentColors(contentType);
  
  if (contentType === 'ep' || contentType === 'loop_pack') {
    // Multi-content gets epic celebration!
    console.log(`🎊 EPIC ${contentType.toUpperCase()} CELEBRATION!`);
    
    // Multiple bursts for packs/EPs
    for (let i = 0; i < (songCount || 3); i++) {
      setTimeout(() => {
        confetti({
          particleCount: 60,
          angle: 60 + (i * 15), // Vary the angle
          spread: 60,
          origin: { 
            x: 0.3 + (i * 0.15), // Spread across screen
            y: 0.5 + (Math.random() * 0.3) // Vary height more
          },
          colors,
          gravity: 0.5, // Slower fall
          drift: 0.1,   // Some sideways drift
          scalar: 1.3   // Bigger particles
        });
      }, i * 300); // Longer gaps between bursts
    }
    
    // Add a finale burst
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 360,
        origin: { x: 0.5, y: 0.4 },
        colors,
        gravity: 0.4,
        scalar: 1.5
      });
    }, (songCount || 3) * 300 + 500);
    
  } else {
    // Single content gets enhanced burst
    console.log(`🎉 ${contentType.toUpperCase()} CELEBRATION!`);
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors,
      gravity: 0.5,
      drift: 0.1,
      scalar: 1.3
    });
  }
}

/**
 * Rainbow chaos celebration - pure joy!
 */
export function rainbowCelebration() {
  const rainbowColors = ['#A8E66B', '#A084F9', '#81E4F2', '#FF6B6B', '#4ECDC4', '#FFA500', '#FF69B4', '#32CD32'];
  
  // Scatter confetti from multiple points
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      confetti({
        particleCount: 30,
        angle: Math.random() * 360,
        spread: Math.random() * 50 + 50,
        origin: { 
          x: Math.random(), 
          y: Math.random() * 0.5 + 0.2 
        },
        colors: rainbowColors
      });
    }, i * 100);
  }
}

/**
 * Gentle celebration for smaller actions
 */
export function gentleCelebration() {
  confetti({
    particleCount: 30,
    spread: 40,
    origin: { y: 0.8 },
    colors: getNextColorSet()
  });
}