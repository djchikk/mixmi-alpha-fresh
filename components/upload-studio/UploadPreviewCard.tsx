"use client";

import React, { useState } from 'react';
import SafeImage from '../shared/SafeImage';
import TrackDetailsModal from '../modals/TrackDetailsModal';
import { IPTrack } from '@/types';

interface ExtractedData {
  content_type?: string;
  title?: string;
  artist?: string;
  bpm?: number;
  cover_image_url?: string;
  tags?: string[];
  location?: string;
  additional_locations?: string[];
  description?: string;
  notes?: string;
  allow_downloads?: boolean;
  download_price_stx?: number;
  composition_splits?: Array<{ name: string; percentage: number }>;
  production_splits?: Array<{ name: string; percentage: number }>;
}

interface UploadPreviewCardProps {
  data: ExtractedData;
  coverImageUrl?: string;
}

export default function UploadPreviewCard({ data, coverImageUrl }: UploadPreviewCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Get border color based on content type
  const getBorderColor = () => {
    switch (data.content_type) {
      case 'full_song':
      case 'song':
      case 'ep':
        return '#A8E66B'; // Lime green
      case 'loop':
      case 'loop_pack':
        return '#A084F9'; // Lavender
      case 'video_clip':
        return '#5BB5F9'; // Sky blue
      case 'radio_station':
      case 'station_pack':
        return '#FFC044'; // Golden amber
      default:
        return '#4B5563'; // Gray for empty state
    }
  };

  // Get content type label
  const getTypeLabel = () => {
    switch (data.content_type) {
      case 'full_song':
      case 'song':
        return 'SONG';
      case 'ep':
        return 'EP';
      case 'loop':
        return 'LOOP';
      case 'loop_pack':
        return 'PACK';
      case 'video_clip':
        return 'VIDEO';
      case 'radio_station':
        return 'RADIO';
      case 'station_pack':
        return '📻 PACK';
      default:
        return null;
    }
  };

  // Build a preview track object for the details modal
  const buildPreviewTrack = (): IPTrack => {
    return {
      id: 'preview',
      title: data.title || 'Untitled',
      artist: data.artist || 'Unknown Artist',
      content_type: data.content_type || 'loop',
      bpm: data.bpm,
      description: data.description,
      notes: data.notes,
      tags: data.tags,
      cover_image_url: coverImageUrl || data.cover_image_url,
      download_price_stx: data.download_price_stx,
      allow_downloads: data.allow_downloads,
      // Location info
      location: data.location,
      primary_location: data.location,
      // IP splits
      composition_splits: data.composition_splits,
      production_splits: data.production_splits,
    } as IPTrack;
  };

  const borderColor = getBorderColor();
  const typeLabel = getTypeLabel();
  const hasContent = data.content_type || data.title || data.artist || coverImageUrl;
  const coverUrl = coverImageUrl || data.cover_image_url;

  // Collect all locations
  const allLocations: string[] = [];
  if (data.location) {
    allLocations.push(data.location.split(',')[0]); // Just city name
  }
  if (data.additional_locations) {
    data.additional_locations.forEach(loc => {
      allLocations.push(loc.split(',')[0]); // Just city name
    });
  }

  return (
    <div className="flex flex-col items-center">
      {/* Label */}
      <div className="text-xs text-gray-400 mb-2 font-medium">PREVIEW</div>

      {/* Card Container - 160x160px */}
      <div
        className="w-[160px] h-[160px] rounded-lg overflow-hidden transition-all duration-500 bg-slate-800 relative"
        style={{
          border: hasContent ? `3px solid ${borderColor}` : '3px dashed #4B5563',
        }}
      >
        {/* Cover Image or Placeholder */}
        <div className="relative w-full h-full">
          {coverUrl ? (
            <SafeImage
              src={coverUrl}
              alt={data.title || 'Cover'}
              className="w-full h-full object-cover transition-opacity duration-500"
              fill
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
              {!hasContent ? (
                <div className="text-center p-4">
                  <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p className="text-xs text-gray-500">Your content<br/>will appear here</p>
                </div>
              ) : (
                <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              )}
            </div>
          )}

          {/* Overlay with details - always visible when we have data */}
          {hasContent && (
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/40 p-2 flex flex-col justify-between">
              {/* Top Section: Title, Artist */}
              <div className="space-y-0.5">
                {data.title ? (
                  <h3
                    className="font-medium text-[#81E4F2] text-sm leading-tight truncate transition-all duration-300"
                    style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                  >
                    {data.title}
                  </h3>
                ) : (
                  <div className="h-4 w-24 bg-gray-700/50 rounded animate-pulse" />
                )}
                {data.artist ? (
                  <p
                    className="text-[#81E4F2]/80 text-xs truncate transition-all duration-300"
                    style={{ animation: 'fadeSlideIn 0.3s ease-out 0.1s both' }}
                  >
                    {data.artist}
                  </p>
                ) : data.title ? (
                  <div className="h-3 w-16 bg-gray-700/50 rounded animate-pulse" />
                ) : null}
              </div>

              {/* Bottom Section: Type, Price/Badge, BPM */}
              <div className="flex items-center justify-between">
                {/* Price/Badge */}
                <div>
                  {data.allow_downloads !== false && data.download_price_stx !== undefined ? (
                    <span
                      className="bg-[#81E4F2] text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                      style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                    >
                      {data.download_price_stx === 0 ? 'Free' : data.download_price_stx}
                    </span>
                  ) : data.content_type === 'loop' || data.content_type === 'loop_pack' ? (
                    <span
                      className="bg-[#81E4F2] text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                      title="Mixer only"
                    >
                      M
                    </span>
                  ) : null}
                </div>

                {/* Content Type Badge */}
                {typeLabel && (
                  <span
                    className="text-xs font-mono font-medium text-white"
                    style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                  >
                    {typeLabel}
                  </span>
                )}

                {/* BPM */}
                <div>
                  {data.bpm && data.content_type !== 'video_clip' && data.content_type !== 'ep' ? (
                    <span
                      className="text-sm font-mono font-bold text-white"
                      style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                    >
                      {data.bpm}
                    </span>
                  ) : data.content_type && data.content_type !== 'video_clip' && data.content_type !== 'ep' && data.content_type !== 'full_song' ? (
                    <span className="text-sm font-mono text-gray-500">~</span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Location pins below card - show all locations */}
      {allLocations.length > 0 && (
        <div
          className="mt-2 flex flex-wrap gap-1 justify-center max-w-[160px]"
          style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
        >
          {allLocations.map((loc, i) => (
            <span
              key={i}
              className="flex items-center gap-0.5 text-xs text-gray-400"
              style={{ animation: `fadeSlideIn 0.3s ease-out ${i * 0.1}s both` }}
            >
              <span>📍</span>
              <span className="truncate max-w-[70px]">{loc}</span>
            </span>
          ))}
        </div>
      )}

      {/* Tags below card */}
      {data.tags && data.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 justify-center max-w-[160px]">
          {data.tags.slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-slate-700 text-gray-300 text-[10px] rounded"
              style={{ animation: `fadeSlideIn 0.3s ease-out ${i * 0.1}s both` }}
            >
              {tag}
            </span>
          ))}
          {data.tags.length > 3 && (
            <span className="text-[10px] text-gray-500">+{data.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Info button - show when we have some data */}
      {hasContent && data.title && (
        <button
          onClick={() => setShowDetails(true)}
          className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-[#81E4F2] transition-colors"
          style={{ animation: 'fadeSlideIn 0.3s ease-out 0.3s both' }}
        >
          <span>ℹ️</span>
          <span>View details</span>
        </button>
      )}

      {/* Track Details Modal */}
      <TrackDetailsModal
        track={buildPreviewTrack()}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
      />

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes fadeSlideIn {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
