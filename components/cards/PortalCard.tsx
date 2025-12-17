"use client";

import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import Link from 'next/link';
import SafeImage from '../shared/SafeImage';

// Portal data interface - simpler than IPTrack since portals aren't playable content
export interface Portal {
  id: string;
  name: string;
  description: string;  // 2 lines max
  imageUrl: string;
  profileUrl: string;
  // Location data for globe placement
  coordinates?: {
    lat: number;
    lng: number;
  };
  location?: string;
  content_type: 'portal';  // Always 'portal'
}

interface PortalCardProps {
  portal: Portal;
}

export default function PortalCard({ portal }: PortalCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Set up drag - portals can only be dragged to globe for pinning
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'PORTAL_CARD',  // Distinct type so mixer/crate reject it
    item: () => ({
      portal: {
        ...portal,
        imageUrl: portal.imageUrl,
      },
      source: 'portal'
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [portal]);

  // Clear hover state when dragging
  React.useEffect(() => {
    if (isDragging) {
      setIsHovered(false);
    }
  }, [isDragging]);

  return (
    <div
      ref={drag}
      className="relative w-[160px] h-[160px] flex items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.7 : 1,
      }}
    >
      {/* Circular card with iridescent border */}
      <div className="portal-card-container relative w-[152px] h-[152px] rounded-full overflow-hidden">
        {/* Iridescent border - using pseudo-element technique */}
        <div className="portal-border absolute inset-0 rounded-full" />

        {/* Inner content area */}
        <div className="absolute inset-[4px] rounded-full overflow-hidden bg-slate-900">
          {/* Profile image - fills the circle */}
          <SafeImage
            src={portal.imageUrl}
            alt={portal.name}
            className="w-full h-full object-cover"
            fill
          />

          {/* Hover overlay - dark with name and description */}
          {isHovered && !isDragging && (
            <div className="portal-hover-overlay absolute inset-0 bg-black/90 flex flex-col items-center justify-center px-4 text-center overflow-hidden">
              {/* Scan line effect */}
              <div className="portal-scanline absolute inset-0 pointer-events-none" />

              {/* Portal name - clickable link to profile */}
              <Link
                href={portal.profileUrl}
                className="text-white font-semibold text-sm hover:text-[#81E4F2] transition-colors leading-tight relative z-10"
                onClick={(e) => e.stopPropagation()}
              >
                {portal.name}
              </Link>

              {/* Description - 2 lines max, not clickable */}
              <p className="text-white/70 text-xs mt-1 line-clamp-2 leading-tight relative z-10">
                {portal.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* CSS for iridescent shimmer animation */}
      <style jsx>{`
        .portal-border {
          background: linear-gradient(
            135deg,
            #FFFFFF 0%,
            #D4C4F8 14%,
            #FFFFFF 28%,
            #C4D4F8 42%,
            #FFFFFF 56%,
            #F8D4E4 70%,
            #FFFFFF 84%,
            #D4F8E4 100%
          );
          background-size: 400% 400%;
          animation: shimmer 6s ease-in-out infinite;
        }

        @keyframes shimmer {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        .portal-hover-overlay {
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .portal-scanline {
          background: linear-gradient(
            to bottom,
            transparent 0%,
            transparent 45%,
            rgba(129, 228, 242, 0.08) 50%,
            transparent 55%,
            transparent 100%
          );
          background-size: 100% 200%;
          animation: scanline 2s linear infinite;
        }

        @keyframes scanline {
          0% {
            background-position: 0% 0%;
          }
          100% {
            background-position: 0% 200%;
          }
        }
      `}</style>
    </div>
  );
}
