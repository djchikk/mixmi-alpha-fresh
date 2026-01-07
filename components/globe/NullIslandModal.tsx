"use client";

import React, { useMemo, useRef, useState } from 'react';
import { TrackNode } from './types';
import { X, Play, Pause, GripVertical } from 'lucide-react';
import { useDrag } from 'react-dnd';

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
    color: '#FFC044' // Tomato Coral
  },
  {
    key: 'loops',
    label: 'Loops',
    emoji: '🔁',
    types: ['loop', 'loop_pack'],
    color: '#A084F9' // Purple
  },
  {
    key: 'songs',
    label: 'Songs & EPs',
    emoji: '🎵',
    types: ['full_song', 'ep'],
    color: '#A8E66B' // Champagne Gold
  },
  {
    key: 'video',
    label: 'Video Clips',
    emoji: '🎬',
    types: ['video_clip'],
    color: '#5BB5F9' // Sky Blue
  },
  {
    key: 'other',
    label: 'Other',
    emoji: '🎶',
    types: [], // Catch-all for unknown types
    color: '#81E4F2' // Cyan (Accent)
  }
];

// Draggable track item component
interface DraggableTrackItemProps {
  node: TrackNode;
  groupEmoji: string;
  groupColor: string;
  onSelect: () => void;
  playingId: string | null;
  onPlay: (id: string) => void;
  onPause: () => void;
}

function DraggableTrackItem({
  node,
  groupEmoji,
  groupColor,
  onSelect,
  playingId,
  onPlay,
  onPause
}: DraggableTrackItemProps) {
  const isRadio = ['radio_station', 'station_pack', 'grabbed_radio'].includes(node.content_type || '');
  const isPlaying = playingId === node.id;

  // Set up drag
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      // Convert TrackNode to track format expected by drop targets
      const track = {
        id: node.id,
        title: node.title,
        artist: node.artist,
        content_type: node.content_type,
        imageUrl: node.thumb_64_url || node.imageUrl,
        cover_image_url: node.imageUrl, // Keep original high-res
        audioUrl: node.audioUrl || node.stream_url || (node.content_type === 'video_clip' ? node.video_url : undefined),
        stream_url: node.stream_url,
        video_url: node.video_url,
        bpm: node.bpm,
        price_stx: node.price_stx,
        tags: node.tags,
        location: node.location,
        coordinates: node.coordinates
      };
      return { track, source: 'null-island' };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [node]);

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlaying) {
      onPause();
    } else {
      onPlay(node.id);
    }
  };

  // Get playable URL
  const playableUrl = node.stream_url || node.audioUrl || (node.content_type === 'video_clip' ? node.video_url : undefined);
  const canPreview = !!playableUrl;

  return (
    <div
      ref={drag}
      onClick={onSelect}
      className={`w-full text-left p-2.5 rounded-lg border border-gray-700/50 hover:border-[#81E4F2]/60 hover:bg-[#81E4F2]/5 transition-all duration-200 group cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50 border-[#81E4F2]' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      <div className="flex items-center space-x-3">
        {/* Drag handle indicator */}
        <div className="text-gray-500 group-hover:text-[#81E4F2]/60 transition-colors">
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Thumbnail with play overlay */}
        <div className="relative flex-shrink-0">
          {node.imageUrl ? (
            <img
              src={node.thumb_64_url || node.imageUrl}
              alt={node.title}
              className="w-10 h-10 rounded-md object-cover"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-md flex items-center justify-center"
              style={{ backgroundColor: `${groupColor}20` }}
            >
              <span className="text-lg">{groupEmoji}</span>
            </div>
          )}

          {/* Play/Pause overlay button */}
          {canPreview && (
            <button
              onClick={handlePlayClick}
              className={`absolute inset-0 flex items-center justify-center rounded-md transition-all ${
                isPlaying
                  ? 'bg-black/60'
                  : 'bg-black/40 opacity-0 group-hover:opacity-100'
              }`}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" fill="white" />
              ) : (
                <Play className="w-5 h-5 text-white" fill="white" />
              )}
            </button>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm truncate group-hover:text-[#81E4F2] transition-colors">
            {node.title}
          </h4>
          <p className="text-xs text-gray-400 truncate">
            {node.artist}
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const handleSelectNode = (node: TrackNode) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
    onSelectNode(node);
    onClose();
  };

  const handlePlay = (id: string) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Find the node
    const node = nodes.find(n => n.id === id);
    if (!node) return;

    // Get playable URL (radio uses proxy)
    let url = node.stream_url || node.audioUrl || (node.content_type === 'video_clip' ? node.video_url : undefined);

    if (!url) return;

    // Proxy radio streams
    const isRadio = ['radio_station', 'station_pack', 'grabbed_radio'].includes(node.content_type || '');
    if (isRadio && node.stream_url) {
      url = `/api/radio-proxy?url=${encodeURIComponent(node.stream_url)}`;
    }

    // Create and play audio
    const audio = new Audio(url);
    audio.volume = 0.7;
    audio.play().catch(err => {
      console.error('Playback failed:', err);
      setPlayingId(null);
    });

    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };

    audioRef.current = audio;
    setPlayingId(id);
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  // Cleanup on close
  React.useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

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

          {/* Drag hint */}
          {totalTracks > 0 && (
            <p className="text-[10px] text-gray-500 text-center mt-2">
              Drag tracks to Crate, Mixer, Playlist, or Cart
            </p>
          )}
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
                        <DraggableTrackItem
                          key={node.id}
                          node={node}
                          groupEmoji={group.emoji}
                          groupColor={group.color}
                          onSelect={() => handleSelectNode(node)}
                          playingId={playingId}
                          onPlay={handlePlay}
                          onPause={handlePause}
                        />
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
