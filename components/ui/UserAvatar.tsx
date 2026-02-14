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
          colors: ['#A084F9', '#A8E66B', '#5BB5F9', '#FFC044', '#81E4F2', '#9772F4', '#FF6B9D', '#FFD57A'],
        }}
      />
    </Avatar>
  );
}
