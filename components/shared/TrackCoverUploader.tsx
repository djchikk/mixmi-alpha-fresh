"use client";

import React, { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Trash2, Upload, Music } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface TrackCoverUploaderProps {
  walletAddress: string;
  initialImage?: string;
  onImageChange: (imageUrl: string) => void;
}

interface UploadProgress {
  stage: 'idle' | 'analyzing' | 'uploading' | 'complete';
  message: string;
  progress: number;
}

export default function TrackCoverUploader({
  walletAddress,
  initialImage,
  onImageChange
}: TrackCoverUploaderProps) {
  const [preview, setPreview] = useState<string | null>(initialImage || null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'idle',
    message: '',
    progress: 0
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload to dedicated track-covers bucket
  const uploadToStorage = async (file: File): Promise<string> => {
    const fileName = `${walletAddress}/cover-${Date.now()}.${file.name.split('.').pop()}`;
    
    console.log(`🎵 Uploading track cover: ${fileName}, Size: ${(file.size / 1024).toFixed(0)}KB`);
    
    // Upload to dedicated track-covers bucket (public access, no RLS issues!)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('track-covers')  // ✨ Your new public bucket! with /images/ path
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('Track cover upload error:', uploadError);
      throw new Error(uploadError.message);
    }

    // Get public URL from track-covers bucket
    const { data: urlData } = supabase.storage
      .from('track-covers')  // ✨ Your new public bucket!
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log('✅ Track cover uploaded successfully:', urlData.publicUrl);
    return urlData.publicUrl;
  };

  // Process and upload file
  const processFile = useCallback(async (file: File) => {
    try {
      setIsUploading(true);
      setError(null);
      
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      
      // Stage 1: Analyzing
      setUploadProgress({
        stage: 'analyzing',
        message: 'Analyzing cover image...',
        progress: 20
      });
      
      console.log(`🎨 Processing track cover: ${file.name} (${fileSizeMB}MB)`);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Stage 2: Uploading
      setUploadProgress({
        stage: 'uploading', 
        message: 'Uploading to cloud storage...',
        progress: 50
      });
      
      const imageUrl = await uploadToStorage(file);
      
      // Stage 3: Complete
      setUploadProgress({
        stage: 'complete',
        message: 'Cover image uploaded! ✨',
        progress: 100
      });
      
      // Show preview and update form
      setPreview(imageUrl);
      onImageChange(imageUrl);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('🚨 Track cover upload failed:', error);
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress({ stage: 'idle', message: '', progress: 0 });
    }
  }, [walletAddress, onImageChange]);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    if (acceptedFiles.length === 0) {
      setError('No valid image files found');
      return;
    }
    
    const file = acceptedFiles[0];
    
    // Validate file size (5MB limit for track covers)
    if (file.size > 5 * 1024 * 1024) {
      setError("Track cover must be less than 5MB");
      return;
    }
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Please upload a valid image file");
      return;
    }
    
    processFile(file);
  }, [processFile]);

  // Configure dropzone for track covers
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif']
    },
    maxFiles: 1,
    disabled: isUploading
  });

  // Handle clear image
  const handleClearImage = () => {
    setPreview(null);
    setError(null);
    onImageChange("");
  };

  return (
    <div className="space-y-4">
      {/* Upload Progress */}
      {isUploading && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-gray-300">
                {uploadProgress.message}
              </span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="h-2 bg-[#81E4F2] rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Image preview */}
      {preview && !isUploading && (
        <div className="relative aspect-square overflow-hidden bg-slate-800 rounded-lg">
          <img
            src={preview}
            alt="Track cover preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-2 px-3 flex justify-center">
            <button 
              onClick={handleClearImage}
              className="text-white text-sm flex items-center hover:text-[#81E4F2] transition-colors"
            >
              <Trash2 size={16} className="mr-1" />
              Replace Cover
            </button>
          </div>
        </div>
      )}

      {/* Upload area */}
      {!preview && !isUploading && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-[#81E4F2] bg-[#81E4F2]/10' 
              : 'border-gray-700 hover:border-[#81E4F2]'
          }`}
        >
          <input {...getInputProps()} ref={fileInputRef} />
          <Music size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-400 mb-1">Drop track cover image here</p>
          <p className="text-gray-500 text-sm">
            PNG, JPG, WebP or GIF • Max 5MB • Optimized for 160px cards
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 px-4 py-2 bg-gray-200 text-[#0a0e1a] rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            Choose File
          </button>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}