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
 * Regular nodes: Single cover image with border
 * Cluster nodes: 2x2 mini-grid preview
 */
export default function NodePreview({ node, cursorX, cursorY, visible }: NodePreviewProps) {
  if (!visible || !node) {
    return null;
  }

  // Check if this is a cluster node (cyan #81E4F2)
  const isCluster = node.color === '#81E4F2';

  // Get border color based on content type
  const getBorderColor = () => {
    if (node.color === '#81E4F2') return '#81E4F2'; // Cyan for clusters
    if (node.content_type === 'full_song') return '#FFE4B5'; // Gold
    if (node.content_type === 'loop') return '#9772F4'; // Purple
    if (node.content_type === 'video_clip') return '#2792F5'; // Blue
    if (node.content_type === 'radio_station') return '#FB923C'; // Orange
    if (node.content_type === 'grabbed_radio') return '#FB923C'; // Orange
    return '#9772F4'; // Default purple
  };

  const borderColor = getBorderColor();

  if (isCluster) {
    // Cluster preview: 2x2 mini-grid
    return (
      <div
        className="fixed z-[500] rounded-lg overflow-hidden shadow-2xl border-2 bg-slate-900"
        style={{
          left: `${cursorX + 15}px`,
          top: `${cursorY + 15}px`,
          width: '60px',
          height: '60px',
          borderColor,
          pointerEvents: 'none',
          opacity: visible ? 1 : 0
        }}
      >
        {/* 2x2 grid of mini-covers */}
        <div className="grid grid-cols-2 gap-[2px] w-full h-full p-[2px]">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="relative bg-slate-800 rounded-sm overflow-hidden">
              <img
                src={node.imageUrl || '/placeholder-track.png'}
                alt=""
                className="w-full h-full object-cover opacity-90"
              />
            </div>
          ))}
        </div>

        {/* Track count badge */}
        {node.trackCount && (
          <div
            className="absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded text-[7px] font-bold bg-black/90 text-cyan-400"
            style={{ fontFamily: 'monospace' }}
          >
            {node.trackCount}
          </div>
        )}
      </div>
    );
  }

  // Regular node preview: Single cover
  return (
    <div
      className="fixed z-[500] rounded-lg overflow-hidden shadow-2xl border-2 transition-opacity duration-150"
      style={{
        left: `${cursorX + 15}px`,
        top: `${cursorY + 15}px`,
        width: '60px',
        height: '60px',
        borderColor,
        pointerEvents: 'none',
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
