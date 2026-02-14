"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from 'facehash';

interface UserAvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  rounded?: boolean;
  borderColor?: string;
  borderWidth?: number;
}

/**
 * Avatar with FaceHash fallback. Shows uploaded image/video if available,
 * otherwise renders a deterministic cute face from the name string.
 * Uses box-shadow for borders so the face fills the container edge-to-edge.
 */
export function UserAvatar({
  src,
  name,
  size = 40,
  className,
  rounded = true,
  borderColor,
  borderWidth = 2,
}: UserAvatarProps) {
  const radius = rounded ? '50%' : '12px';
  const isVideo = src && (src.includes('.mp4') || src.includes('.webm') || src.includes('video/'));

  const outerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    flexShrink: 0,
    // Use box-shadow instead of border — doesn't affect sizing,
    // so the face fills edge-to-edge with no corner gaps
    ...(borderColor ? {
      boxShadow: `0 0 0 ${borderWidth}px ${borderColor}`,
    } : {}),
  };

  if (isVideo) {
    return (
      <div className={className} style={outerStyle}>
        <video
          src={src}
          style={{ width: size, height: size, objectFit: 'cover' }}
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
    );
  }

  return (
    <div className={className} style={outerStyle}>
      <Avatar
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
        }}
      >
        <AvatarImage
          src={src || undefined}
          alt={name}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <AvatarFallback
          name={name}
          facehashProps={{
            size,
            variant: 'gradient',
            intensity3d: 'subtle',
            showInitial: false,
            colors: [
              '#E8368F', // Hot pink
              '#A855F7', // Vivid violet
              '#0EA5E9', // Ocean blue
              '#E040A0', // Fuchsia
              '#10B981', // Emerald
              '#EAB308', // Gold
              '#DB2777', // Deep rose
              '#3B82F6', // Royal blue
              '#8B5CF6', // Purple
              '#059669', // Jade
            ],
          }}
        />
      </Avatar>
    </div>
  );
}
