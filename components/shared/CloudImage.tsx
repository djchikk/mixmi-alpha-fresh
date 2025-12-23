"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface CloudImageProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
}

export default function CloudImage({ src, alt, className, fill, sizes, priority }: CloudImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If it's already a base64 string or regular URL, use as-is
    if (src.startsWith('data:') || !src.includes('supabase.co/storage/')) {
      setResolvedSrc(src);
      return;
    }

    // If it's a cloud URL, resolve it to base64 for display
    const resolveCloudUrl = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🌤️ CloudImage: Resolving cloud URL for display:', src.substring(0, 50) + '...');
        
        const response = await fetch(src);
        if (response.ok) {
          const blob = await response.blob();
          const isGif = blob.type === 'image/gif';
          
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            console.log(`✅ CloudImage: Resolved ${isGif ? 'GIF' : 'image'} (${Math.round(result.length/1024)}KB)`);
            setResolvedSrc(result);
            setIsLoading(false);
          };
          reader.readAsDataURL(blob);
        } else {
          console.warn('⚠️ CloudImage: Failed to fetch cloud image, using URL directly');
          setResolvedSrc(src);
          setIsLoading(false);
        }
      } catch (error) {
        console.warn('⚠️ CloudImage: Error resolving cloud URL:', error);
        setError('Failed to load image');
        setResolvedSrc(src); // Fallback to original URL
        setIsLoading(false);
      }
    };

    resolveCloudUrl();
  }, [src]);

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-800 text-gray-400 text-sm`}>
        Failed to load image
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-slate-800`}>
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#81E4F2]"></div>
      </div>
    );
  }

  return (
    <Image
      src={resolvedSrc}
      alt={alt}
      className={className}
      fill={fill}
      sizes={sizes}
      priority={priority}
    />
  );
} 