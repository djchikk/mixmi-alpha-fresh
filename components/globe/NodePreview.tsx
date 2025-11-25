"use client";

import React from 'react';
import { TrackNode } from './types';

interface NodePreviewProps {
  node: TrackNode | null;
  cursorX: number;
  cursorY: number;
  visible: boolean;
}

/**
 * NodePreview - 60px cursor-following preview
 *
 * Appears instantly on hover, follows cursor, disappears when:
 * 1. Dwell timer triggers (350ms) and full card launches
 * 2. User moves away from node
 *
 * Design:
 * - 60x60px square
 * - Cover image with content-type border color
 * - BPM badge in bottom-right corner
 * - pointerEvents: 'none' to not interfere with hover
 */
export default function NodePreview({ node, cursorX, cursorY, visible }: NodePreviewProps) {
  if (!visible || !node) {
    return null;
  }

  // Get border color based on content type
  const getBorderColor = () => {
    if (node.content_type === 'full_song') return '#FFE4B5'; // Gold
    if (node.content_type === 'loop') return '#9772F4'; // Purple
    if (node.content_type === 'video_clip') return '#2792F5'; // Blue
    if (node.content_type === 'radio_station') return '#FB923C'; // Orange
    if (node.content_type === 'grabbed_radio') return '#FB923C'; // Orange
    return '#9772F4'; // Default purple
  };

  const borderColor = getBorderColor();

  return (
    <div
      className="fixed z-[500] rounded-lg overflow-hidden shadow-2xl border-2 transition-opacity duration-150"
      style={{
        left: `${cursorX + 15}px`, // Offset from cursor
        top: `${cursorY + 15}px`,
        width: '60px',
        height: '60px',
        borderColor,
        pointerEvents: 'none', // Critical: don't interfere with hover
        opacity: visible ? 1 : 0
      }}
    >
      {/* Cover Image */}
      <img
        src={node.imageUrl || '/placeholder-track.png'}
        alt={node.title}
        className="w-full h-full object-cover"
      />

      {/* BPM Badge - bottom right corner */}
      {node.bpm && (
        <div
          className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold bg-black/80 text-white"
          style={{ fontFamily: 'monospace' }}
        >
          {node.bpm}
        </div>
      )}

      {/* Content Type Indicator - top left corner (small dot) */}
      <div
        className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full"
        style={{ backgroundColor: borderColor }}
      />
    </div>
  );
}
