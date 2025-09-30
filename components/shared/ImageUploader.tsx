"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Trash2, Upload, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MVP_SECTION_LIMITS, SectionType } from "@/lib/sectionLimits";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useImageUrlValidation } from "@/hooks/useImageUrlValidation";
import { useImageCompression } from "@/hooks/useImageCompression";

interface ImageUploaderProps {
  initialImage?: string;
  onImageChange: (imageData: string) => void;
  walletAddress?: string; // Pass wallet address directly for RLS permissions
  aspectRatio?: "square" | "video" | "free";
  section?: SectionType; // Section context for GIF validation
  showCompressionOptions?: boolean; // Show compression level selector
  hideToggle?: boolean; // Hide the internal upload/URL toggle
}

export default function ImageUploader({
  initialImage,
  onImageChange,
  walletAddress: propWalletAddress, // Wallet passed as prop
  aspectRatio = "square",
  section = "gallery", // Default to gallery for backward compatibility
  showCompressionOptions = false,
  hideToggle = false
}: ImageUploaderProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [preview, setPreview] = useState<string | null>(initialImage || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use wallet address from props (for alpha system) or context (for main app)
  const { walletAddress: contextWalletAddress } = useAuth();
  const walletAddress = propWalletAddress || contextWalletAddress;
  
  // Compression hook first (since other hooks depend on compressionLevel)
  const {
    compressionLevel,
    showSettings,
    setCompressionLevel,
    setShowSettings,
    getCompressionOptions,
    toggleSettings,
    getHelpText: getCompressionHelpText
  } = useImageCompression();
  
  // Custom hooks that depend on compressionLevel
  const {
    isProcessing,
    uploadProgress,
    currentFile,
    processFile,
    cancelUpload,
    resetUpload
  } = useImageUpload({
    walletAddress,
    section,
    onImageChange,
    compressionLevel: showCompressionOptions ? compressionLevel : 'optimized'
  });
  
  const {
    imageUrl,
    urlValidationState,
    urlFeedback,
    setImageUrl,
    setUrlValidationState,
    setUrlFeedback,
    handleUrlChange,
    resetUrlState
  } = useImageUrlValidation({
    onImageChange,
    onPreviewChange: setPreview
  });
  
  // Check if GIFs are allowed in this section
  const sectionLimits = MVP_SECTION_LIMITS[section];
  const areGifsAllowed = sectionLimits.maxGifs > 0;
  
  // Reset preview when initialImage changes
  useEffect(() => {
    if (initialImage) {
      setPreview(initialImage);
      setImageUrl(initialImage);
      setUrlValidationState('valid');
      setUrlFeedback('');
    } else {
      setPreview(null);
      setImageUrl("");
      setUrlValidationState('idle');
      setUrlFeedback('');
    }
  }, [initialImage, setImageUrl, setUrlValidationState, setUrlFeedback]);
  
  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError(null);
    
    console.log("🔍 File drop detected:", acceptedFiles.length ? acceptedFiles[0].name : "No files");
    
    if (acceptedFiles.length === 0) {
      return;
    }
    
    const file = acceptedFiles[0];
    
    // Check if GIF is allowed in this section
    if (file.type === 'image/gif' && !areGifsAllowed) {
      const sectionName = section === 'profile' ? 'Profile' : 
                         section === 'gallery' ? 'Gallery' : 
                         section === 'spotlight' ? 'Spotlight' : 
                         section === 'shop' ? 'Shop' : section;
      setError(`GIFs are not allowed in the ${sectionName} section. Please use a static image (PNG, JPG, WebP).`);
      return;
    }
    
    // Check file size (10MB limit for testing large GIFs)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be less than 10MB");
      return;
    }
    
    // Process file using the hook
    processFile(file).catch(err => {
      setError('Failed to process file. Please try again.');
      console.error('File processing error:', err);
    });
  }, [areGifsAllowed, section, processFile]);
  
  // Configure dropzone
  const allowedFormats = areGifsAllowed 
    ? { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg'] }
    : { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.svg'] }; // No GIF for non-GIF sections
  
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: allowedFormats,
    maxFiles: 1,
    noClick: false,
    noKeyboard: false
  });
  
  // Manual file input ref as backup for dropzone
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  // Handle manual click to open file dialog
  const handleClickToUpload = (e: React.MouseEvent) => {
    console.log('🖼️ Image upload click detected!', { target: e.target });
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      console.log('🖼️ Click on button - preventing propagation');
      e.stopPropagation();
      return;
    }
    console.log('🖼️ Calling file dialog...');
    
    // Try dropzone open first, fallback to manual input
    try {
      open();
    } catch (error) {
      console.log('🖼️ Dropzone open failed, using manual input');
      manualFileInputRef.current?.click();
    }
  };
  
  // Handle URL change - use the enhanced validation from hook
  const handleEnhancedUrlChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    await handleUrlChange(e);
  }, [handleUrlChange]);
  
  // Handle clearing the image
  const handleClearImage = () => {
    setPreview(null);
    setError(null);
    onImageChange("");
    
    // Reset URL state
    resetUrlState();
    
    // Reset upload state
    resetUpload();
    
    if (activeTab !== "upload") {
      setActiveTab("upload");
    }
  };
  
  // Calculate aspect ratio class
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case "square":
        return "aspect-square";
      case "video":
        return "aspect-video";
      case "free":
      default:
        return "";
    }
  };
  
  // File processing is now handled by the useImageUpload hook
  
  // Generate help text based on section and compression level
  const getHelpText = () => {
    const baseText = areGifsAllowed
      ? "PNG, JPG or GIF (max 10MB)"
      : `PNG, JPG or WebP (max 10MB) - GIFs not allowed in Shop`;

    if (showCompressionOptions) {
      return getCompressionHelpText(baseText);
    }
    
    return baseText;
  };
  
  return (
    <div className="space-y-4">
      {/* Tab navigation - only show if not hidden */}
      {!hideToggle && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex gap-2">
            <button
              type="button"
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === "upload"
                  ? "bg-white text-slate-900"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
              onClick={() => {
                setActiveTab("upload");
                setUrlValidationState('idle');
                setUrlFeedback('');
                // Clear preview if switching tabs
                if (preview) {
                  setPreview(null);
                  onImageChange("");
                }
              }}
            >
              Upload Image
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === "url"
                  ? "bg-white text-slate-900"
                  : "bg-slate-700 text-gray-300 hover:bg-slate-600"
              }`}
              onClick={() => {
                setActiveTab("url");
                // Reset validation state when switching to URL tab
                setUrlValidationState('idle');
                setUrlFeedback('');
                // Clear preview if switching tabs
                if (preview) {
                  setPreview(null);
                  onImageChange("");
                }
              }}
            >
              Image URL
            </button>
          </div>
          
          {/* Compression settings toggle */}
          {showCompressionOptions && (
            <button
              type="button"
              onClick={toggleSettings}
              className="p-2 text-gray-400 hover:text-[#81E4F2] transition-colors"
              title="Compression settings"
            >
              <Settings size={18} />
            </button>
          )}
        </div>
      )}

      {/* Compression settings panel */}
      {showCompressionOptions && showSettings && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Compression Level</h4>
          <div className="space-y-2">
            {[
              { 
                value: 'optimized' as const, 
                label: 'Optimized (Recommended)', 
                desc: '40-50% smaller files, barely noticeable quality difference' 
              },
              { 
                value: 'balanced' as const, 
                label: 'Balanced', 
                desc: 'Good compression with excellent quality' 
              },
              { 
                value: 'maximum-quality' as const, 
                label: 'Maximum Quality', 
                desc: 'Larger files, best possible quality' 
              }
            ].map((option) => (
              <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="compression"
                  value={option.value}
                  checked={compressionLevel === option.value}
                  onChange={(e) => setCompressionLevel(e.target.value as any)}
                  className="mt-1 text-[#81E4F2] focus:ring-[#81E4F2]"
                />
                <div>
                  <div className="text-sm text-gray-300 font-medium">{option.label}</div>
                  <div className="text-xs text-gray-500">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            💡 GIF animations are always preserved completely
          </div>
        </div>
      )}

      {/* Upload Progress Indicator */}
      {isProcessing && uploadProgress.stage !== 'idle' && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              {uploadProgress.stage === 'complete' ? (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin"></div>
              )}
              <span className="text-sm font-medium text-gray-300">
                {uploadProgress.message}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {uploadProgress.fileSize}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                uploadProgress.stage === 'complete' 
                  ? 'bg-green-500' 
                  : 'bg-[#81E4F2]'
              }`}
              style={{ width: `${uploadProgress.progress}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{uploadProgress.progress}%</span>
            <span className="capitalize">{uploadProgress.stage}</span>
          </div>
          
          {/* File info */}
          {currentFile && (
            <div className="mt-2 text-xs text-gray-400">
              {currentFile.name} • {currentFile.type}
            </div>
          )}
        </div>
      )}

      {/* Image preview */}
      {preview && !isProcessing && (
        <div className={`relative overflow-hidden bg-slate-800 ${getAspectRatioClass()}`}>
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
            onError={() => {
              // If preview fails to load, show better error state
              if (activeTab === "url") {
                setUrlValidationState('invalid');
                setUrlFeedback('Image failed to load. Please check the URL or try a different image.');
                setPreview(null);
                onImageChange("");
              }
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 py-2 px-3 flex justify-center">
            <button 
              onClick={handleClearImage}
              className="text-white text-sm flex items-center hover:text-[#81E4F2] transition-colors"
            >
              <Trash2 size={16} className="mr-1" />
              Replace Image
            </button>
          </div>
        </div>
      )}

      {/* Upload tab content */}
      {activeTab === "upload" && !preview && !isProcessing && (
        <div
          {...getRootProps()}
          className="upload-area border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-[#81E4F2] transition-colors"
        >
          <input {...getInputProps()} ref={fileInputRef} />
          {/* Manual file input backup */}
          <input
            ref={manualFileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                console.log('🖼️ Manual file input triggered!', file.name);
                onDrop([file]);
              }
            }}
            className="hidden"
          />
          <div onClick={() => {
            console.log('🖼️ Manual click - opening file dialog...');
            manualFileInputRef.current?.click();
          }}>
            <Upload size={24} className="mx-auto mb-2 text-gray-400" />
            <p className="text-gray-400">Click to upload or drag and drop</p>
            <p className="text-gray-500 text-sm mt-1">
              {getHelpText()}
            </p>
          </div>
        </div>
      )}

      {/* URL tab content */}
      {activeTab === "url" && !preview && !isProcessing && (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={imageUrl}
              onChange={handleEnhancedUrlChange}
              placeholder="https://example.com/image.jpg"
              className={`w-full px-3 py-2 pr-10 bg-slate-800 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                urlValidationState === 'valid' ? 'border-green-500 focus:ring-green-500' :
                urlValidationState === 'invalid' ? 'border-red-500 focus:ring-red-500' :
                urlValidationState === 'warning' ? 'border-yellow-500 focus:ring-yellow-500' :
                'border-slate-700 focus:ring-[#81E4F2]'
              }`}
            />
            
            {/* Validation Icon */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {urlValidationState === 'validating' && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#81E4F2]"></div>
              )}
              {urlValidationState === 'valid' && (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              )}
              {urlValidationState === 'invalid' && (
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              )}
              {urlValidationState === 'warning' && (
                <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                </svg>
              )}
            </div>
          </div>
          
          {/* Validation Feedback */}
          {urlFeedback && (
            <div className={`text-xs px-3 py-2 rounded-md ${
              urlValidationState === 'valid' ? 'bg-green-900/30 text-green-300 border border-green-700' :
              urlValidationState === 'invalid' ? 'bg-red-900/30 text-red-300 border border-red-700' :
              urlValidationState === 'warning' ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-700' :
              'bg-slate-800 text-gray-300'
            }`}>
              {urlFeedback}
            </div>
          )}
          
                     {/* Help Text */}
           <div className="text-xs text-gray-500 space-y-1">
             <p>Enter a direct link to an image file</p>
             <div className="text-xs text-gray-600">
               <p className="font-medium text-gray-400 mb-1">✅ Good examples:</p>
               <p>• https://i.imgur.com/abc123.jpg</p>
               <p>• https://images.unsplash.com/photo-abc</p>
               <p>• https://example.com/photo.png</p>
               <p>• Public CDN/hosting service URLs</p>
               
               <p className="font-medium text-gray-400 mt-2 mb-1">❌ Won't work:</p>
               <p>• Private Google Photos (with authuser=)</p>
               <p>• Social media posts (Instagram, Facebook)</p>
               <p>• Music sites (Discogs, Spotify)</p>
               <p>• URLs requiring login/authentication</p>
             </div>
           </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  );
} 