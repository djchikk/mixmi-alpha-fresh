"use client";

import React, { useState, useEffect, useRef, memo } from 'react';
import { IPTrack } from '@/types';
import CompactTrackCardWithFlip from './CompactTrackCardWithFlip';

interface OptimizedCompactCardProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
  priority?: boolean; // For above-the-fold items
}

const OptimizedCompactCard = memo(({ 
  track, 
  priority = false,
  ...props 
}: OptimizedCompactCardProps) => {
  const [isVisible, setIsVisible] = useState(priority);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) return; // Skip observer for priority items

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '100px', // Start loading 100px before visible
        threshold: 0.01
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  // Preload image when visible
  useEffect(() => {
    if (isVisible && track.cover_image_url && !imageLoaded) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.onerror = () => setImageLoaded(true); // Mark as loaded even on error
      img.src = track.cover_image_url;
    }
  }, [isVisible, track.cover_image_url, imageLoaded]);

  return (
    <div ref={cardRef} className="w-[160px] h-[160px]">
      {isVisible ? (
        <CompactTrackCardWithFlip track={track} {...props} />
      ) : (
        // Skeleton placeholder with same dimensions as CompactTrackCard
        <div className="w-full h-full bg-slate-800 rounded-lg animate-pulse">
          <div className="w-full h-full rounded-lg bg-slate-700" />
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo - only re-render if these props change
  return (
    prevProps.track.id === nextProps.track.id &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.showEditControls === nextProps.showEditControls
  );
});

OptimizedCompactCard.displayName = 'OptimizedCompactCard';

export default OptimizedCompactCard;