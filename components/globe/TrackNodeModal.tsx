"use client";

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IPTrack } from '@/types';
import { TrackNode } from '@/components/globe/types';
import { supabase } from '@/lib/supabase';
import OptimizedTrackCard from '@/components/cards/OptimizedTrackCard';
import { X } from 'lucide-react';

interface TrackNodeModalProps {
  node: TrackNode | null;
  onClose: () => void;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview: () => void;
  isPlaying: boolean;
  playingTrackId: string | null;
}

export default function TrackNodeModal({ 
  node, 
  onClose, 
  onPlayPreview,
  onStopPreview,
  isPlaying,
  playingTrackId 
}: TrackNodeModalProps) {
  const [ipTrack, setIpTrack] = useState<IPTrack | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch full IP track data when node is selected
  useEffect(() => {
    const fetchTrackData = async () => {
      if (!node) {
        setIpTrack(null);
        return;
      }

      setIsLoading(true);
      try {
        // Extract the original track ID (remove the -loc-N suffix if present)
        const trackId = node.id.includes('-loc-') 
          ? node.id.split('-loc-')[0] 
          : node.id;
          
        const { data, error } = await supabase
          .from('ip_tracks')
          .select('*')
          .eq('id', trackId)
          .single();

        if (data && !error) {
          setIpTrack(data);
        } else {
          console.error('Error fetching track:', error);
        }
      } catch (error) {
        console.error('Failed to fetch track data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrackData();
  }, [node]);

  if (!node) return null;

  return typeof document !== 'undefined' ? createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div 
          className="relative bg-[#101726] rounded-xl border border-[#1E293B] shadow-2xl max-w-md w-full animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button - moved to top-left to avoid clipping issues */}
          <button
            onClick={onClose}
            className="absolute top-3 left-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-full p-1.5 transition-all duration-200 z-20 border border-gray-600 shadow-lg hover:scale-105"
          >
            <X className="w-4 h-4" />
          </button>

            {/* Content */}
            <div className="p-6 pl-12">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mb-4"></div>
                <p className="text-gray-400">Loading track...</p>
              </div>
            ) : ipTrack ? (
              <div className="flex justify-center">
                <OptimizedTrackCard
                  track={ipTrack}
                  isPlaying={playingTrackId === ipTrack.id}
                  onPlayPreview={onPlayPreview}
                  onStopPreview={onStopPreview}
                  showEditControls={false}
                  onPurchase={() => {
                    console.log('Purchase track:', ipTrack.title);
                  }}
                />
              </div>
            ) : (
              // Fallback display if track data can't be fetched
              <div className="text-center py-8">
                <h3 className="text-2xl font-bold text-[#81E4F2] mb-2">{node.title}</h3>
                <p className="text-gray-400 mb-1">by {node.artist}</p>
                {node.location && <p className="text-sm text-[#ffd700] mb-1">📍 {node.location}</p>}
                {node.genre && <p className="text-sm text-gray-500 mb-6">{node.genre}</p>}
                <p className="text-gray-400">Track details unavailable</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  ) : null;
}