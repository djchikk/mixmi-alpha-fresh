"use client";

import React from 'react';
import { IPTrack } from '@/types';
import CompactTrackCardWithFlip from './CompactTrackCardWithFlip';

interface GlobeTrackCardProps {
  track: IPTrack;
  isPlaying: boolean;
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  onStopPreview?: () => void;
  showEditControls: boolean;
  onPurchase?: (track: IPTrack) => void;
  onEditTrack?: (track: IPTrack) => void;
  onDeleteTrack?: (trackId: string) => void;
}

export default function GlobeTrackCard(props: GlobeTrackCardProps) {
  // Simply use the awesome CompactTrackCardWithFlip component
  // It already has all the flip functionality and styling we need
  return <CompactTrackCardWithFlip {...props} />;
}