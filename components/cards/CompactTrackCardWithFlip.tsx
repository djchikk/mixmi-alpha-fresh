"use client";

import React, { useState } from 'react';
import { IPTrack } from '@/types';
// Removed mixer dependency for alpha version
import { useToast } from '@/contexts/ToastContext';
import TrackDetailsModal from '../modals/TrackDetailsModal';
import { useDrag } from 'react-dnd';
import InfoIcon from '../shared/InfoIcon';
import SafeImage from '../shared/SafeImage';
import { GripVertical } from 'lucide-react';

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
  // Alpha version - no mixer collection functionality
  const { showToast } = useToast();
  const [isFlipped, setIsFlipped] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isDescriptionHovered, setIsDescriptionHovered] = useState(false);

  // Set up drag
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      // Optimize image for small displays when dragging
      const originalImageUrl = track.cover_image_url || (track as any).imageUrl;
      
      // DETAILED DEBUGGING for carousel performance issue
      console.log('🔍 DRAG DEBUG - Track being dragged:', {
        id: track.id,
        title: track.title,
        cover_image_url: track.cover_image_url,
        imageUrl: (track as any).imageUrl,
        originalImageUrl: originalImageUrl,
        isFromCluster: !!(track.id && track.id.includes('cluster'))
      });
      
      // CRITICAL DEBUG: Check optimization logic
      const timestamp = Date.now();
      const shouldOptimize = !!originalImageUrl;
      const optimizedUrl = shouldOptimize ? `${originalImageUrl}?t=${timestamp}&w=64&h=64` : originalImageUrl;
      
      console.log('🔧 OPTIMIZATION DEBUG:', {
        originalImageUrl,
        shouldOptimize,
        optimizedUrl,
        timestamp
      });
      
      const optimizedTrack = {
        ...track,
        imageUrl: optimizedUrl,
        cover_image_url: optimizedUrl,
        // Ensure we have audioUrl for mixer compatibility  
        audioUrl: track.audio_url
      };
      
      console.log('🌍 Globe card being dragged with optimization:', optimizedTrack);
      // Extra debug for carousel tracks
      if (track.id && track.id.includes('cluster')) {
        console.log('🎠 Carousel track drag detected - optimization applied:', !!originalImageUrl);
      }
      
      // Network performance debug
      if (originalImageUrl && originalImageUrl.length > 100) {
        console.warn('⚠️ Large image URL detected:', originalImageUrl.substring(0, 100) + '...');
      }
      
      return { track: optimizedTrack };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track]);

  // Get track type
  const getTrackType = () => {
    if (track.content_type === 'full_song') return 'Song';
    if (track.content_type === 'ep') {
      return 'EP';
    }
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
    if (track.content_type === 'ep') return 'border-[#FFE4B5]';
    if (track.content_type === 'loop') return 'border-[#9772F4]';
    if (track.content_type === 'loop_pack') return 'border-[#9772F4]';
    // Fallback for legacy data
    return track.sample_type === 'vocals' ? 'border-[#9772F4]' : 'border-[#FFE4B5]';
  };

  // Get border thickness - thicker for multi-content (loop packs and EPs)
  const getBorderThickness = () => {
    return (track.content_type === 'loop_pack' || track.content_type === 'ep') ? 'border-4' : 'border-2';
  };


  // Handle play click
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayPreview(track.id, track.audio_url);
  };

  // Handle purchase click - add to cart
  const handlePurchaseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Use global cart function if available (for globe context)
    if ((window as any).addToCart) {
      (window as any).addToCart(track);
    } else {
      // Fallback to onPurchase prop (for other contexts like Creator Store)
      onPurchase?.(track);
    }
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

  // Handle info click - TEST: goes directly to modal instead of flip
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(true);
  };

  // Handle expand to modal
  const handleExpandClick = (e: React.MouseEvent) => {
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
            cursor: isDragging ? 'grabbing' : 'grab',
            perspective: '1000px'
          }}
        >
          {/* Flip Container */}
          <div 
            className="relative w-full h-full transition-transform duration-700 ease-in-out"
            style={{ 
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            {/* FRONT OF CARD */}
            <div 
              className="absolute inset-0 w-full h-full"
              style={{ 
                backfaceVisibility: 'hidden',
                zIndex: isFlipped ? -1 : 2
              }}
            >
              {/* Cover Image - Full Card */}
              <div className="relative w-full h-full">
                {track.cover_image_url ? (
                  <SafeImage 
                    src={track.cover_image_url} 
                    alt={track.title}
                    className="w-full h-full object-cover"
                    fill
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
                
                {/* Drag Handle - Left side, vertically centered */}
                {isHovered && !isFlipped && (
                  <div 
                    className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-black/70 backdrop-blur-sm rounded p-1 transition-all duration-200 hover:bg-black/90 border border-transparent hover:border-[#81E4F2] z-10"
                    title="Drag to crate or mixer (loops only for mixer)"
                  >
                    <GripVertical className="w-4 h-4 text-gray-100 hover:text-white" />
                  </div>
                )}

                {/* Hover Overlay */}
                {isHovered && !isFlipped && (
                  <div className="hover-overlay absolute inset-0 bg-black bg-opacity-50 flex flex-col justify-between p-3 animate-fadeIn">
                    
                    {/* Top Section: Title, Artist, Info */}
                    <div>
                      {/* Top row: Title/Artist and Info icon */}
                      <div className="flex justify-between items-start mb-2 gap-1">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white text-sm truncate pr-1">{track.title}</h3>
                          <p className="text-gray-300 text-xs truncate">{track.artist}</p>
                        </div>
                        
                        {/* Info Icon - slightly larger */}
                        <div className="flex-shrink-0">
                          <InfoIcon
                            size="md"
                            onClick={handleInfoClick}
                            title="See all info + drag individual tracks from Loop Packs/EPs"
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

                    {/* Bottom Section: Price, Content Type Badge, BPM */}
                    <div className="flex items-center justify-between gap-1">
                      {/* Buy Button (left) */}
                      <button
                        onClick={handlePurchaseClick}
                        className="bg-accent text-slate-900 font-bold py-1 px-3 rounded transition-all transform hover:scale-105 border border-transparent hover:border-slate-900 text-xs"
                        title="Price in STX - click to add to cart"
                      >
                        {track.price_stx}
                      </button>

                      {/* Content Type Badge (center) */}
                      <span className="text-[10px] px-1.5 py-0.5 font-mono font-medium text-white/90">
                        {track.content_type === 'ep' && 'EP'}
                        {track.content_type === 'loop_pack' && 'PACK'}
                        {track.content_type === 'loop' && 'LOOP'}
                        {track.content_type === 'full_song' && 'SONG'}
                        {!track.content_type && 'TRACK'}
                      </span>
                      
                      {/* BPM Badge (right) - hide for EPs since they have multiple songs with different BPMs */}
                      {track.bpm && track.content_type !== 'ep' ? (
                        <span 
                          className="bg-black/70 px-2 py-1 rounded text-sm text-white/90 font-mono font-semibold"
                          title="BPM"
                        >
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

            {/* BACK OF CARD - New Layout */}
            <div 
              className="absolute inset-0 w-full h-full bg-slate-900 flex flex-col"
              style={{ 
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                zIndex: isFlipped ? 2 : -1
              }}
            >
              {/* Close button - upper right corner */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                }}
                className="absolute top-2 right-2 z-20 w-6 h-6 bg-black/80 hover:bg-black text-gray-400 hover:text-white rounded-full flex items-center justify-center transition-all text-xs border border-gray-700"
                title="Close"
              >
                ✕
              </button>

              {/* Expand button - top center */}
              <div className="flex justify-center pt-2 pb-1">
                <button
                  onClick={handleExpandClick}
                  className="bg-slate-800/50 hover:bg-slate-700 text-gray-400 hover:text-white rounded px-2 py-1 flex items-center gap-1 transition-all text-xs"
                  title="Expand for full details"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span className="text-[10px]">Details</span>
                </button>
              </div>

              {/* Main content area - description with hover expand */}
              <div className="flex-1 px-3 overflow-hidden flex items-center">
                <div className="w-full">
                  {track.description ? (
                    <div 
                      className="text-gray-300 text-xs leading-relaxed transition-all duration-300 overflow-hidden cursor-pointer"
                      onMouseEnter={() => setIsDescriptionHovered(true)}
                      onMouseLeave={() => setIsDescriptionHovered(false)}
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: isDescriptionHovered ? 'none' : 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: isDescriptionHovered ? 'auto' : 'hidden'
                      }}
                    >
                      {track.description}
                    </div>
                  ) : (
                    <div className="text-gray-500 text-xs italic text-center">
                      No description available
                    </div>
                  )}
                </div>
              </div>

              {/* License - pinned to bottom */}
              <div className="border-t border-gray-800 px-3 py-2">
                <div className="text-gray-400 text-[10px] font-mono uppercase tracking-wider text-center">
                  {getLicenseDisplay()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for animations and custom scrollbar */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 2px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>

      {/* Expanded Modal (when expand button is clicked) */}
      <TrackDetailsModal
        track={track}
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
      />
    </>
  );
}