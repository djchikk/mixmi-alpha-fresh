"use client";

import React, { useMemo } from 'react';
import { TrackNode } from './types';
import { X } from 'lucide-react';

interface NullIslandModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: TrackNode[];
  onSelectNode: (node: TrackNode) => void;
}

// Content type grouping configuration
const CONTENT_TYPE_GROUPS = [
  {
    key: 'radio',
    label: 'Radio Stations',
    emoji: '📻',
    types: ['radio_station', 'station_pack', 'grabbed_radio'],
    color: '#FF6B4A' // Tomato Coral
  },
  {
    key: 'loops',
    label: 'Loops',
    emoji: '🔁',
    types: ['loop', 'loop_pack'],
    color: '#9772F4' // Purple
  },
  {
    key: 'songs',
    label: 'Songs & EPs',
    emoji: '🎵',
    types: ['full_song', 'ep'],
    color: '#D4AF37' // Champagne Gold
  },
  {
    key: 'video',
    label: 'Video Clips',
    emoji: '🎬',
    types: ['video_clip'],
    color: '#2792F5' // Sky Blue
  },
  {
    key: 'other',
    label: 'Other',
    emoji: '🎶',
    types: [], // Catch-all for unknown types
    color: '#81E4F2' // Cyan (Accent)
  }
];

/**
 * Null Island Modal - Shows content at (0,0) with a fun explainer header
 * The legendary home of location-less content! 🏝️
 */
export function NullIslandModal({
  isOpen,
  onClose,
  nodes,
  onSelectNode
}: NullIslandModalProps) {
  if (!isOpen) return null;

  const handleSelectNode = (node: TrackNode) => {
    onSelectNode(node);
    onClose();
  };

  // Group nodes by content type
  const groupedNodes = useMemo(() => {
    const groups: Record<string, TrackNode[]> = {};

    // Initialize groups
    CONTENT_TYPE_GROUPS.forEach(group => {
      groups[group.key] = [];
    });

    // Sort nodes into groups
    nodes.forEach(node => {
      // Skip cluster nodes - we want individual tracks
      if (node.content_type === 'cluster') return;

      const group = CONTENT_TYPE_GROUPS.find(g =>
        g.types.includes(node.content_type || '')
      ) || CONTENT_TYPE_GROUPS.find(g => g.key === 'other')!;

      groups[group.key].push(node);
    });

    return groups;
  }, [nodes]);

  // Count actual tracks (not clusters)
  const totalTracks = useMemo(() => {
    return Object.values(groupedNodes).reduce((sum, group) => sum + group.length, 0);
  }, [groupedNodes]);

  // Get content type color (matches CONTENT_TYPE_GROUPS)
  const getContentTypeColor = (contentType: string) => {
    switch (contentType) {
      case 'loop':
      case 'loop_pack':
        return '#9772F4'; // Purple
      case 'full_song':
      case 'ep':
        return '#D4AF37'; // Champagne Gold
      case 'radio_station':
      case 'station_pack':
      case 'grabbed_radio':
        return '#FF6B4A'; // Tomato Coral
      case 'video_clip':
        return '#2792F5'; // Sky Blue
      default:
        return '#81E4F2'; // Cyan (Accent)
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col bg-gradient-to-br from-[#1a2744] to-[#0f1829] border border-[#81E4F2]/40 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Section */}
        <div className="p-6 pb-4 border-b border-[#81E4F2]/20">
          {/* Island emoji header */}
          <div className="text-center mb-3">
            <span className="text-4xl">🏝️</span>
          </div>

          {/* Title with count */}
          <h3 className="text-xl font-bold text-center text-[#81E4F2] mb-2">
            Welcome to Null Island!
          </h3>

          {/* Description */}
          <p className="text-xs text-gray-400 leading-relaxed text-center">
            The home of coordinates <span className="font-mono text-[#81E4F2]">(0°, 0°)</span> - where location-free music lives.
            {totalTracks > 0 && (
              <span className="block mt-1 text-gray-300">
                {totalTracks} {totalTracks === 1 ? 'track' : 'tracks'} found here
              </span>
            )}
          </p>
        </div>

        {/* Content List - Grouped by Type */}
        <div className="overflow-y-auto flex-1 p-4">
          {totalTracks === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm mb-3">No tracks at Null Island yet!</p>
              <p className="text-gray-500 text-xs">
                Upload content without a location tag and it will drift here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {CONTENT_TYPE_GROUPS.map(group => {
                const groupTracks = groupedNodes[group.key];
                if (groupTracks.length === 0) return null;

                return (
                  <div key={group.key}>
                    {/* Group Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{group.emoji}</span>
                      <h4
                        className="text-sm font-semibold"
                        style={{ color: group.color }}
                      >
                        {group.label}
                      </h4>
                      <span className="text-xs text-gray-500">
                        ({groupTracks.length})
                      </span>
                      <div
                        className="flex-1 h-px ml-2"
                        style={{ backgroundColor: `${group.color}30` }}
                      />
                    </div>

                    {/* Group Items */}
                    <div className="space-y-1.5 ml-1">
                      {groupTracks.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => handleSelectNode(node)}
                          className="w-full text-left p-2.5 rounded-lg border border-gray-700/50 hover:border-[#81E4F2]/60 hover:bg-[#81E4F2]/5 transition-all duration-200 group"
                        >
                          <div className="flex items-center space-x-3">
                            {node.imageUrl && (
                              <img
                                src={node.imageUrl}
                                alt={node.title}
                                className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                              />
                            )}
                            {!node.imageUrl && (
                              <div
                                className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center"
                                style={{ backgroundColor: `${group.color}20` }}
                              >
                                <span className="text-lg">{group.emoji}</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white text-sm truncate group-hover:text-[#81E4F2] transition-colors">
                                {node.title}
                              </h4>
                              <p className="text-xs text-gray-400 truncate">
                                {node.artist}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fun fact footer */}
        <div className="p-4 pt-3 border-t border-[#81E4F2]/20">
          <div className="bg-[#81E4F2]/10 border border-[#81E4F2]/30 rounded-lg p-2 text-center">
            <p className="text-xs text-[#81E4F2]">
              <span className="font-semibold">Fun fact:</span> In the real world, Null Island is a weather buoy in the Gulf of Guinea!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
