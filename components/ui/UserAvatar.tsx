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
 * Handles border internally so the face is always perfectly centered.
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

  // Inner content size accounts for border
  const innerSize = borderColor ? size - borderWidth * 2 : size;
  const outerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    overflow: 'hidden',
    flexShrink: 0,
    ...(borderColor ? {
      border: `${borderWidth}px solid ${borderColor}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    } : {}),
  };

  if (isVideo) {
    return (
      <div className={className} style={outerStyle}>
        <video
          src={src}
          style={{ width: innerSize, height: innerSize, objectFit: 'cover', borderRadius: radius }}
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
          width: innerSize,
          height: innerSize,
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
            size: innerSize,
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
