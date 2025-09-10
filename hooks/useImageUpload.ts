import { useState, useCallback, useEffect } from 'react';
import { PowerUserStorage } from '@/lib/powerUserStorage';
import { SectionType } from '@/lib/sectionLimits';
import { SupabaseStorageService } from '@/lib/supabase-storage';

interface UploadProgress {
  stage: 'idle' | 'analyzing' | 'compressing' | 'uploading' | 'finalizing' | 'complete';
  message: string;
  progress: number;
  fileSize?: string;
}

interface CompressionOptions {
  enableCompression: boolean;
  quality: number;
  preserveAnimation?: boolean;
}

interface UseImageUploadProps {
  walletAddress?: string;
  section: SectionType;
  onImageChange: (imageData: string) => void;
  compressionLevel: 'optimized' | 'balanced' | 'maximum-quality';
}

interface UseImageUploadReturn {
  isProcessing: boolean;
  uploadProgress: UploadProgress;
  currentFile: File | null;
  processFile: (file: File) => Promise<void>;
  cancelUpload: () => void;
  resetUpload: () => void;
}

export function useImageUpload({
  walletAddress,
  section,
  onImageChange,
  compressionLevel
}: UseImageUploadProps): UseImageUploadReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'idle',
    message: '',
    progress: 0
  });

  // Prevent navigation during upload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isProcessing && uploadProgress.stage !== 'idle' && uploadProgress.stage !== 'complete') {
        event.preventDefault();
        event.returnValue = 'Upload in progress. Are you sure you want to leave?';
        return 'Upload in progress. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProcessing, uploadProgress.stage]);

  const getCompressionOptions = useCallback((): CompressionOptions => {
    switch (compressionLevel) {
      case 'optimized':
        return { enableCompression: true, quality: 0.7, preserveAnimation: true };
      case 'balanced':
        return { enableCompression: true, quality: 0.85, preserveAnimation: true };
      case 'maximum-quality':
        return { enableCompression: false, quality: 1.0, preserveAnimation: true };
      default:
        return { enableCompression: true, quality: 0.7, preserveAnimation: true };
    }
  }, [compressionLevel]);

  const processFile = useCallback(async (file: File) => {
    try {
      setIsProcessing(true);
      setCurrentFile(file);
      
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const isGif = file.type === 'image/gif';
      
      // Stage 1: Analyzing
      setUploadProgress({
        stage: 'analyzing',
        message: `Analyzing your ${isGif ? 'GIF' : 'image'}...`,
        progress: 10,
        fileSize: `${fileSizeMB}MB`
      });
      
      console.log(`📂 Processing file: ${file.name} (${fileSizeMB}MB)`);
      console.log(`🎯 Type: ${file.type} | Section: ${section}`);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Stage 2: Uploading to Supabase Storage (no more base64!)
      setUploadProgress({
        stage: 'uploading',
        message: `Uploading to cloud storage...`,
        progress: 30,
        fileSize: `${fileSizeMB}MB`
      });
      
      // Use wallet address or fallback ID for upload
      const userId = walletAddress || 'anonymous';
      
      // Upload to Supabase Storage - this returns a clean URL
      const uploadResult = await SupabaseStorageService.uploadImage(
        userId,
        file,
        'gallery', // Use 'gallery' as default image type for IP tracks
        `cover-${Date.now()}` // Unique item ID for covers
      );
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }
      
      // Stage 3: Complete
      setUploadProgress({
        stage: 'complete',
        message: `${isGif ? 'GIF' : 'Image'} uploaded successfully! ✨`,
        progress: 100,
        fileSize: `${fileSizeMB}MB`
      });
      
      console.log('✅ Image uploaded to Supabase Storage:', uploadResult.data?.publicUrl);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Return the clean Supabase Storage URL (NOT base64!)
      if (uploadResult.data?.publicUrl) {
        onImageChange(uploadResult.data.publicUrl);
        resetUpload();
        return;
      }
      
      throw new Error('Failed to get public URL from upload');
      
    } catch (error) {
      console.error('🚨 Image upload failed:', error);
      setIsProcessing(false);
      setCurrentFile(null);
      setUploadProgress({ 
        stage: 'idle', 
        message: '', 
        progress: 0 
      });
      throw error;
    }
  }, [walletAddress, section, onImageChange]);

  const cancelUpload = useCallback(() => {
    setIsProcessing(false);
    setCurrentFile(null);
    setUploadProgress({ stage: 'idle', message: '', progress: 0 });
  }, []);

  const resetUpload = useCallback(() => {
    setIsProcessing(false);
    setCurrentFile(null);
    setUploadProgress({ stage: 'idle', message: '', progress: 0 });
  }, []);

  return {
    isProcessing,
    uploadProgress,
    currentFile,
    processFile,
    cancelUpload,
    resetUpload
  };
}