"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { IPTrack } from '@/types';
import { useMixer } from '@/contexts/MixerContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import TrackCard from './TrackCard';
import { createPortal } from 'react-dom';
import { useDrag } from 'react-dnd';
import InfoIcon from '../shared/InfoIcon';

interface CompactTrackCardProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
  isGlobeView?: boolean; // New prop for globe-specific behavior
}

export default function CompactTrackCard({ 
  track, 
  isPlaying, 
  onPlayPreview, 
  onStopPreview,
  showEditControls,
  onPurchase,
  onEditTrack,
  onDeleteTrack,
  isGlobeView = false
}: CompactTrackCardProps) {
  const router = useRouter();
  const { addTrackToCollection } = useMixer();
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false); // For globe view flip

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

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    if (isExpanded) {
      document.addEventListener('keydown', handleEsc);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isExpanded]);

  // Determine border color based on content type
  const getBorderColor = () => {
    switch (track.content_type) {
      case 'loop':
        return 'border-[#9772F4]'; // Vibrant purple for loops
      case 'full_song':
        return 'border-[#FFE4B5]'; // Peach-gold for full songs
      default:
        return 'border-blue-400'; // Fallback
    }
  };

  // Handle adding to collection
  const handleAddToCollection = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Visual feedback
    const button = e.currentTarget as HTMLButtonElement;
    button.style.transform = 'scale(0.95)';
    button.style.backgroundColor = '#10b981';
    setTimeout(() => {
      button.style.transform = 'scale(1)';
      button.style.backgroundColor = '#101726';
    }, 150);
    
    // Add track to collection (always to the end)
    addTrackToCollection(track);
    showToast('Added to collection', 'success');
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

  // Handle delete click
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteTrack?.(track.id);
  };

  // Handle info click - globe view flips, store view expands
  const handleInfoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isGlobeView) {
      setIsFlipped(!isFlipped);
    } else {
      setIsExpanded(true);
    }
  };

  // Handle card click (non-button areas)
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't expand if clicking on the hover overlay area with buttons
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.hover-overlay')) {
      return;
    }
    setIsExpanded(true);
  };

  return (
    <div>
      <div className="relative group">
        {/* Compact Card Container - 160x160px */}
        <div 
          ref={drag}
          className={`w-[160px] h-[160px] rounded-lg overflow-hidden transition-all duration-300 cursor-pointer ${getBorderColor()} border-2 bg-slate-800 ${isDragging ? 'opacity-50' : ''}`}
          style={{ 
            cursor: isDragging ? 'grabbing' : 'grab',
            ...(isGlobeView ? { perspective: '1000px' } : {})
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={handleCardClick}
        >
        {/* Flip Container for Globe View */}
        <div 
          className="relative w-full h-full transition-transform duration-700 ease-in-out"
          style={isGlobeView ? { 
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          } : {}}
        >
          {/* Front of Card */}
          <div 
            className="absolute inset-0 w-full h-full"
            style={isGlobeView ? { 
              backfaceVisibility: 'hidden',
              zIndex: isFlipped ? -1 : 2
            } : {}}
          >
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
          
          {/* Hover Overlay */}
          {isHovered && (
            <div className="hover-overlay absolute inset-0 bg-black bg-opacity-75 flex flex-col justify-between p-3 transition-opacity duration-200">
              
              {/* Top Section: Title, Artist, Controls */}
              <div>
                {/* Top row: Info and optional delete */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0 mr-2">
                    {isGlobeView ? (
                      <>
                        <h3 
                          className="font-bold text-white text-sm truncate cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/store/${track.artist}`);
                          }}
                        >
                          {track.title}
                        </h3>
                        <p 
                          className="text-gray-300 text-xs truncate cursor-pointer hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/profile/${track.artist}`, '_blank');
                          }}
                        >
                          {track.artist}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-bold text-white text-sm truncate">{track.title}</h3>
                        <p className="text-gray-300 text-xs truncate">{track.artist}</p>
                      </>
                    )}
                  </div>
                  
                  {/* Controls */}
                  <div className="flex gap-1 flex-shrink-0">
                    {showEditControls && (
                      <button
                        onClick={handleDeleteClick}
                        title="Delete track"
                        className="text-white hover:text-red-400 transition-colors text-lg"
                      >
                        🗑️
                      </button>
                    )}
                    <InfoIcon
                      size="sm"
                      onClick={handleInfoClick}
                      title="Expand for details"
                    />
                  </div>
                </div>
              </div>

              {/* Center: Play Button */}
              <div className="flex items-center justify-center">
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

              {/* Bottom Section: BPM, Collection, Price */}
              <div className="flex items-center justify-between gap-1">
                {/* BPM Badge */}
                {track.bpm && (
                  <span className="text-xs bg-slate-700 px-1.5 py-0.5 rounded text-gray-300">
                    {track.bpm}
                  </span>
                )}
                {!track.bpm && <div className="w-10"></div>}
                
                {/* Collection Button */}
                <button
                  onClick={handleAddToCollection}
                  title="Add to Collection"
                  className="w-8 h-8 bg-[#101726] hover:bg-[#1a1f3a] rounded-full flex items-center justify-center text-white transition-all border border-gray-600 hover:border-[#81E4F2] group"
                >
                  <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                  </svg>
                </button>
                
                {/* Buy Button */}
                <button
                  onClick={handlePurchaseClick}
                  className="bg-accent hover:bg-accent/90 text-slate-900 font-bold py-1 px-2 rounded transition-all transform hover:scale-105 text-xs"
                >
                  {track.price_stx}
                </button>
              </div>
            </div>
          )}
        </div>
          </div>
          
          {/* Back of Card - Only for Globe View */}
          {isGlobeView && (
            <div 
              className="absolute inset-0 w-full h-full p-3 overflow-hidden"
              style={{ 
                background: '#0F172A',
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                zIndex: isFlipped ? 2 : -1
              }}
            >
              <div className="h-full flex flex-col">
                {/* Header with close button */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm truncate">{track.title}</h3>
                    <p className="text-gray-400 text-xs">{track.artist}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    className="ml-2 flex-shrink-0 w-5 h-5 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                    title="Close"
                  >
                    <span className="text-white text-sm">×</span>
                  </button>
                </div>
                
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto text-xs space-y-2">
                  {/* Tags */}
                  {track.tags && track.tags.length > 0 && (
                    <div>
                      <p className="text-gray-400 mb-1">Tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {track.tags.map((tag, index) => (
                          <span key={index} className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-gray-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Description */}
                  {track.description && (
                    <div>
                      <p className="text-gray-400 mb-1">Description:</p>
                      <p className="text-gray-300 text-xs leading-relaxed">{track.description}</p>
                    </div>
                  )}
                  
                  {/* License */}
                  {track.license && (
                    <div>
                      <p className="text-gray-400 mb-1">License:</p>
                      <p className="text-gray-300">{track.license}</p>
                    </div>
                  )}
                </div>
                
                {/* View in Store Link */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/store/${track.artist}`);
                  }}
                  className="mt-2 w-full text-center text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  View full details in Creator Store →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {isExpanded && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        />
        
        {/* Modal Content */}
        <div className="relative z-10 transition-transform duration-200 scale-100">
          <TrackCard
            track={track}
            isPlaying={isPlaying}
            onPlayPreview={onPlayPreview}
            onStopPreview={onStopPreview}
            showEditControls={showEditControls}
            onPurchase={onPurchase}
            onEditTrack={onEditTrack}
            onDeleteTrack={onDeleteTrack}
          />
          
          {/* Close button */}
          <button
            onClick={() => setIsExpanded(false)}
            className="absolute -top-10 -right-10 bg-white/10 hover:bg-white/20 text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors"
            title="Close (ESC)"
          >
            ×
          </button>
        </div>
        </div>,
        document.body
      )}
    </div>
  );
}