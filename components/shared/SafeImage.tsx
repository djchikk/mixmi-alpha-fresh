"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  width?: number;
  height?: number;
  fallbackSrc?: string;
  onError?: () => void;
}

/**
 * SafeImage component that handles both user-provided URLs and our own images
 * - Uses Next.js Image for our own images (placeholders, cloud URLs)
 * - Uses regular img tag for user-provided URLs to avoid domain configuration issues
 * - Provides graceful error handling and fallback placeholders
 */
export default function SafeImage({ 
  src, 
  alt, 
  className, 
  fill, 
  sizes, 
  priority, 
  width, 
  height, 
  fallbackSrc = '/placeholders/error-placeholder.svg',
  onError 
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
    setImgSrc(src);
  }, [src]);

  // Determine if this URL should use a plain img tag (skip Next.js Image optimization)
  const shouldUsePlainImg = (url: string): boolean => {
    if (!url) return false;

    // Pre-generated thumbnails - already optimized, skip Next.js Image
    if (url.includes('/thumbnails/')) return true;

    // User-provided external URLs - can't be optimized by Next.js
    if (url.startsWith('http') && !url.includes('supabase.co/storage/')) return true;

    // Local paths, data URLs, and Supabase originals go through Next.js Image
    return false;
  };

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackSrc);
      onError?.();
    }
  };

  // For thumbnails and user-provided URLs, use regular img tag (skip Next.js Image)
  if (shouldUsePlainImg(src) && !hasError) {
    return (
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        onError={handleError}
        style={fill ? { 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover' 
        } : {
          width: width || 'auto',
          height: height || 'auto'
        }}
      />
    );
  }

  // For our own images or after error fallback, use Next.js Image
  return (
    <Image
      src={imgSrc}
      alt={alt}
      className={className}
      fill={fill}
      sizes={sizes}
      priority={priority}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      onError={handleError}
      style={hasError ? { opacity: 0.7 } : undefined}
    />
  );
} 