"use client";

import React from 'react';
import { IPTrack } from '@/types';
import CompactTrackCardWithFlip from './CompactTrackCardWithFlip';
import PortalCard from './PortalCard';

interface GlobeTrackCardProps {
  track: IPTrack & { portal_username?: string };
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
}

export default function GlobeTrackCard(props: GlobeTrackCardProps) {
  const { track } = props;

  // Render PortalCard for portal content type
  if (track.content_type === 'portal') {
    return (
      <PortalCard
        portal={{
          id: track.id,
          name: track.title,
          description: track.description || '',
          imageUrl: track.cover_image_url || (track as any).imageUrl || '',
          profileUrl: `/profile/${track.portal_username || track.primary_uploader_wallet}`,
          content_type: 'portal',
        }}
      />
    );
  }

  // For all other content types, use CompactTrackCardWithFlip
  return <CompactTrackCardWithFlip {...props} />;
}