"use client";

import React, { useState, useEffect, useRef } from 'react';
import { IPTrack } from '@/types';
import TrackCard from './TrackCard';

interface OptimizedTrackCardProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
}

export default function OptimizedTrackCard(props: OptimizedTrackCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px' // Start loading when card is 50px away from viewport
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Preload image when visible
  useEffect(() => {
    if (isVisible && props.track.cover_image_url && !imageLoaded) {
      const img = new Image();
      img.onload = () => setImageLoaded(true);
      img.src = props.track.cover_image_url;
    }
  }, [isVisible, props.track.cover_image_url, imageLoaded]);

  return (
    <div ref={cardRef} style={{ minHeight: '400px' }}>
      {isVisible ? (
        <TrackCard {...props} />
      ) : (
        // Skeleton placeholder
        <div className="w-full h-full bg-slate-800 rounded-lg animate-pulse">
          <div className="aspect-square bg-slate-700 rounded-t-lg" />
          <div className="p-4 space-y-2">
            <div className="h-4 bg-slate-700 rounded w-3/4" />
            <div className="h-3 bg-slate-700 rounded w-1/2" />
          </div>
        </div>
      )}
    </div>
  );
}