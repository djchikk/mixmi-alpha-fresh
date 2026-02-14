"use client";

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from 'facehash';

interface UserAvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
  rounded?: boolean;
}

/**
 * Avatar with FaceHash fallback. Shows uploaded image/video if available,
 * otherwise renders a deterministic cute face from the name string.
 */
export function UserAvatar({ src, name, size = 40, className, rounded = true }: UserAvatarProps) {
  const isVideo = src && (src.includes('.mp4') || src.includes('.webm') || src.includes('video/'));

  if (isVideo) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: rounded ? '50%' : '12px',
          overflow: 'hidden',
        }}
      >
        <video
          src={src}
          className="w-full h-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />
      </div>
    );
  }

  return (
    <Avatar
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? '50%' : '12px',
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
  );
}
