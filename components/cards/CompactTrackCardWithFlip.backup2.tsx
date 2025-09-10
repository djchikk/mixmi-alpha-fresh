"use client";

import React, { useState } from 'react';
import { IPTrack } from '@/types';
// Removed mixer dependency for alpha version
import { useToast } from '@/contexts/ToastContext';
import TrackDetailsModal from '../modals/TrackDetailsModal';
import { useDrag } from 'react-dnd';
import InfoIcon from '../shared/InfoIcon';

interface CompactTrackCardWithFlipProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
}

export default function CompactTrackCardWithFlip({ 
  track, 
  isPlaying, 
  onPlayPreview, 
  onStopPreview,
  showEditControls,
  onPurchase,
  onEditTrack,
  onDeleteTrack
}: CompactTrackCardWithFlipProps) {
  // Alpha version - no mixer collection functionality - SIMPLIFIED: Direct to modal
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Set up drag
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      return { track };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track]);

  // Get track type
  const getTrackType = () => {
    if (track.content_type === 'full_song') return 'Song';
    if (track.content_type === 'loop') {
      return track.loop_category || 'Loop';
    }
    if (track.content_type === 'loop_pack') {
      return `Loop Pack (${(track as any).loops_per_pack || '?'} loops)`;
    }
    return track.sample_type === 'vocals' ? 'Vocal' : 
           track.sample_type === 'instrumentals' ? 'Instrumental' : 
           'Track';
  };

  // Get border color based on content type
  const getBorderColor = () => {
    if (track.content_type === 'full_song') return 'border-[#FFE4B5]';
    if (track.content_type === 'loop') return 'border-[#9772F4]';
    if (track.content_type === 'loop_pack') return 'border-[#9772F4]';
    // Fallback for legacy data
    return track.sample_type === 'vocals' ? 'border-[#9772F4]' : 'border-[#FFE4B5]';
  };

  // Get border thickness - thicker for loop packs
  const getBorderThickness = () => {
    return track.content_type === 'loop_pack' ? 'border-4' : 'border-2';
  };


  // Handle play click
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayPreview(track.id, track.audio_url);
  };

  // Handle purchase click
  const handlePurchaseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPurchase?.(track);
  };

  // Handle delete click with confirmation
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      `Remove "${track.title}" from your store?\n\n` +
      `This will permanently remove it from your store, but you can still find it in your vault under the "Deleted" filter.`
    );
    
    if (confirmed) {
      onDeleteTrack?.(track.id);
      showToast('Track removed from store', 'success');
    }
  };

  // Handle info click - now goes directly to modal (no flip)
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
  };

  // Format license type for display - simplified
  const getLicenseDisplay = () => {
    if (track.content_type === 'loop') {
      // Loops have two options
      if (track.license_selection === 'platform_remix') return 'Remix Only';
      if (track.license_selection === 'platform_download') return 'Remix + Download';
      return 'Remix Only'; // Default for loops
    } else {
      // Songs are download only (no remixing allowed)
      return 'Download Only';
    }
  };


  return (
    <>
      <div className="relative group">
        {/* Compact Card Container - 160x160px with flip */}
        <div 
          ref={drag}
          className={`w-[160px] h-[160px] rounded-lg overflow-hidden transition-all duration-300 ${getBorderColor()} ${getBorderThickness()} bg-slate-800 ${isDragging ? 'opacity-50' : ''}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          {/* Card Content - SIMPLIFIED: No flip container */}
          <div className="relative w-full h-full">
              {/* Cover Image - Full Card */}
              <div className="relative w-full h-full">
                {track.cover_image_url ? (
                  <img 
                    src={track.cover_image_url} 
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
                
                {/* Hover Overlay - SIMPLIFIED: Direct to modal */}
                {isHovered && (
                  <div className="hover-overlay absolute inset-0 bg-black bg-opacity-75 flex flex-col justify-between p-3 animate-fadeIn">
                    
                    {/* Top Section: Title, Artist, Info */}
                    <div>
                      {/* Top row: Title/Artist and Info icon */}
                      <div className="flex justify-between items-start mb-2 gap-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white text-sm truncate pr-1">{track.title}</h3>
                          <p className="text-gray-300 text-xs truncate">{track.artist}</p>
                        </div>
                        
                        {/* Info Icon - now opens modal directly */}
                        <div className="flex-shrink-0">
                          <InfoIcon
                            size="md"
                            onClick={handleInfoClick}
                            title="View details"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Center: Play Button and Delete Button */}
                    <div className="flex items-center justify-center relative">
                      {/* Delete Button - positioned on right side */}
                      {showEditControls && (
                        <button
                          onClick={handleDeleteClick}
                          title="Remove from store"
                          className="absolute right-0 w-6 h-6 bg-red-900/50 hover:bg-red-600 rounded flex items-center justify-center transition-all border border-red-700 hover:border-red-500 group"
                        >
                          <svg className="w-4 h-4 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Play Button - centered */}
                      {track.audio_url && (
                        <button
                          onClick={handlePlayClick}
                          onMouseLeave={() => {
                            if (isPlaying && onStopPreview) {
                              onStopPreview();
                            }
                          }}
                          className="w-12 h-12 bg-[#101726] hover:bg-[#1a1f3a] rounded-full flex items-center justify-center transition-colors border border-gray-600 hover:border-[#81E4F2]"
                        >
                          {isPlaying ? (
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Bottom Section: Price on left, BPM on right */}
                    <div className="flex items-center justify-between gap-1">
                      {/* Buy Button (left) */}
                      <button
                        onClick={handlePurchaseClick}
                        className="bg-accent hover:bg-accent/90 text-slate-900 font-bold py-1 px-3 rounded transition-all transform hover:scale-105 text-xs"
                      >
                        {track.price_stx}
                      </button>
                      
                      {/* BPM Badge (right) - styled like Collection Bar */}
                      {track.bpm ? (
                        <span className="bg-black/70 px-2 py-1 rounded text-sm text-white/90 font-mono font-semibold">
                          {track.bpm}
                        </span>
                      ) : (
                        <div className="w-12"></div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* CSS for animations - SIMPLIFIED */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>

      {/* Details Modal - Opens directly on info click */}
      <TrackDetailsModal
        track={track}
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
      />
    </>
  );
}