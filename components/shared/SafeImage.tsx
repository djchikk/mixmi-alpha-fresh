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

  // Determine if this is a user-provided URL or our own image
  const isUserProvidedUrl = (url: string): boolean => {
    if (!url) return false;
    
    // Our own images (safe to use with Next.js Image)
    if (url.startsWith('/')) return false; // Local paths
    if (url.startsWith('data:')) return false; // Base64 images
    if (url.includes('supabase.co/storage/')) return false; // Our cloud storage
    
    // Everything else is user-provided
    return true;
  };

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(fallbackSrc);
      onError?.();
    }
  };

  // For user-provided URLs, use regular img tag to avoid Next.js domain issues
  if (isUserProvidedUrl(src) && !hasError) {
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