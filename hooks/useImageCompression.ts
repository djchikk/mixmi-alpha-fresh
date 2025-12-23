import { useState, useCallback } from 'react';

export type CompressionLevel = 'optimized' | 'balanced' | 'maximum-quality';

export interface CompressionOptions {
  enableCompression: boolean;
  quality: number;
  preserveAnimation?: boolean;
  aggressive?: boolean;
}

interface UseImageCompressionReturn {
  compressionLevel: CompressionLevel;
  showSettings: boolean;
  setCompressionLevel: React.Dispatch<React.SetStateAction<CompressionLevel>>;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  getCompressionOptions: () => CompressionOptions;
  toggleSettings: () => void;
  getHelpText: (baseText: string) => string;
}

export function useImageCompression(): UseImageCompressionReturn {
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('optimized');
  const [showSettings, setShowSettings] = useState(false);

  const getCompressionOptions = useCallback((): CompressionOptions => {
    switch (compressionLevel) {
      case 'optimized':
        return { 
          enableCompression: true, 
          quality: 0.7, 
          preserveAnimation: true,
          aggressive: true 
        };
      case 'balanced':
        return { 
          enableCompression: true, 
          quality: 0.85, 
          preserveAnimation: true,
          aggressive: false 
        };
      case 'maximum-quality':
        return { 
          enableCompression: false, 
          quality: 1.0, 
          preserveAnimation: true,
          aggressive: false 
        };
      default:
        return { 
          enableCompression: true, 
          quality: 0.7, 
          preserveAnimation: true,
          aggressive: false 
        };
    }
  }, [compressionLevel]);

  const toggleSettings = useCallback(() => {
    setShowSettings(prev => !prev);
  }, []);

  const getHelpText = useCallback((baseText: string): string => {
    const compressionText = {
      'optimized': ' • Smart compression (40-50% smaller, barely noticeable)',
      'balanced': ' • Balanced quality (good compression, excellent quality)', 
      'maximum-quality': ' • Maximum quality (larger files, best quality)'
    }[compressionLevel];
    
    return baseText + compressionText;
  }, [compressionLevel]);

  return {
    compressionLevel,
    showSettings,
    setCompressionLevel,
    setShowSettings,
    getCompressionOptions,
    toggleSettings,
    getHelpText
  };
}