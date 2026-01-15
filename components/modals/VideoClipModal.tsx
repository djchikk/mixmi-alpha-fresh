"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, Video, Upload, MapPin, Plus, Trash2, Play, Pause } from "lucide-react";
import Cropper from "react-easy-crop";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/lib/supabase";
import { parseLocationsAndGetCoordinates } from "@/lib/locationLookup";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";

interface VideoClipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export default function VideoClipModal({
  isOpen,
  onClose,
  onUploadComplete
}: VideoClipModalProps) {
  const { walletAddress, suiAddress, isAuthenticated, activePersona } = useAuth();
  // Priority: active persona's wallet > persona's SUI > account SUI > account STX
  const effectiveAddress = activePersona?.wallet_address || activePersona?.sui_address || suiAddress || walletAddress;
  const { showToast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState('');
  const [bpm, setBpm] = useState<number | null>(null);

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Crop state
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Refs
  const locationInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  // Location autocomplete
  const {
    suggestions,
    isLoading: isLoadingLocations,
    error: locationError,
    handleInputChange: handleLocationSearch,
    clearSuggestions
  } = useLocationAutocomplete({
    minCharacters: 3,
    debounceMs: 300,
    limit: 5
  });

  // Crop callback
  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setArtist('');
      setDescription('');
      setNotes('');
      setCoverImageUrl('');
      setVideoFile(null);
      setVideoPreviewUrl(null);
      setTags([]);
      setTagInput('');
      setLocation('');
      setLocationCoords(null);
      setBpm(null);
      setErrors({});
      setShowLocationDropdown(false);
      setTermsAccepted(false);
      setVideoDuration(null);
      setIsPreviewPlaying(false);
      setUploadProgress(0);
      clearSuggestions();
      // Reset crop state
      setShowCropper(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [isOpen, clearSuggestions]);

  // Capture first frame of video as thumbnail
  const captureVideoThumbnail = async (videoElement: HTMLVideoElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // Seek to 0.1 seconds to avoid black frames
      videoElement.currentTime = 0.1;

      videoElement.onseeked = () => {
        try {
          // Create canvas to capture frame
          const canvas = document.createElement('canvas');
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Draw video frame to canvas
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

          // Convert to blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create thumbnail blob'));
            }
          }, 'image/jpeg', 0.9);
        } catch (error) {
          reject(error);
        }
      };
    });
  };

  // Handle video file selection
  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setErrors({ ...errors, video: 'Please upload a video file (MP4 recommended)' });
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setErrors({ ...errors, video: 'Video file must be under 10MB' });
      return;
    }

    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(previewUrl);
    setVideoFile(file);

    // Create a temporary video element to check duration and capture thumbnail
    const videoElement = document.createElement('video');
    videoElement.src = previewUrl;
    videoElement.onloadedmetadata = async () => {
      const duration = videoElement.duration;
      setVideoDuration(duration);

      // Validate duration (5 seconds max)
      if (duration > 5.5) { // Allow small buffer for encoding variations
        setErrors({ ...errors, video: `Video must be 5 seconds or less (yours is ${duration.toFixed(1)}s)` });
        setVideoFile(null);
        setVideoPreviewUrl(null);
        URL.revokeObjectURL(previewUrl);
      } else {
        setErrors({ ...errors, video: '' });
        setShowCropper(true); // Enable cropper for valid video

        // Capture first frame as thumbnail
        try {
          const thumbnailBlob = await captureVideoThumbnail(videoElement);

          // Upload thumbnail to cover-images bucket
          const thumbnailFileName = `${crypto.randomUUID()}.jpg`;
          const { data: thumbnailData, error: thumbnailError } = await supabase.storage
            .from('cover-images')
            .upload(thumbnailFileName, thumbnailBlob, {
              cacheControl: '3600',
              upsert: false
            });

          if (thumbnailError) {
            console.error('Failed to upload thumbnail:', thumbnailError);
            showToast('⚠️ Failed to generate cover image, please upload manually', 'warning');
          } else {
            // Get public URL for thumbnail
            const { data: { publicUrl: thumbnailUrl } } = supabase.storage
              .from('cover-images')
              .getPublicUrl(thumbnailFileName);

            setCoverImageUrl(thumbnailUrl);
            console.log('✅ Auto-generated cover image from first frame');
          }
        } catch (error) {
          console.error('Error capturing thumbnail:', error);
          showToast('⚠️ Failed to generate cover image, please upload manually', 'warning');
        }
      }
    };
  };

  // Handle video preview play/pause
  const togglePreview = () => {
    if (videoPreviewRef.current) {
      if (isPreviewPlaying) {
        videoPreviewRef.current.pause();
      } else {
        videoPreviewRef.current.play();
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  };

  // Handle tag addition
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  // Handle tag removal
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle location selection
  const handleSelectLocation = (suggestion: any) => {
    setLocation(suggestion.display_name);
    setLocationCoords({ lat: parseFloat(suggestion.lat), lng: parseFloat(suggestion.lon) });
    setShowLocationDropdown(false);
    clearSuggestions();
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    if (!artist.trim()) newErrors.artist = 'Artist name is required';
    if (!videoFile) newErrors.video = 'Video file is required';
    // Cover image is auto-generated from video, so no validation needed
    if (!termsAccepted) newErrors.terms = 'You must accept the terms';

    // Warn if cover image wasn't generated
    if (!coverImageUrl) {
      console.warn('⚠️ Cover image was not auto-generated, will be missing');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm() || !effectiveAddress || !videoFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Upload video file to Supabase Storage
      const videoFileName = `${crypto.randomUUID()}.mp4`;
      const { data: videoUploadData, error: videoUploadError } = await supabase.storage
        .from('video-clips')
        .upload(videoFileName, videoFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (videoUploadError) throw videoUploadError;

      // Get public URL for video
      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('video-clips')
        .getPublicUrl(videoFileName);

      setUploadProgress(50);

      // 2. Parse locations and get coordinates if needed
      let finalLocationCoords = locationCoords;
      if (location && !locationCoords) {
        const parsedLocations = await parseLocationsAndGetCoordinates(location);
        if (parsedLocations.length > 0) {
          finalLocationCoords = {
            lat: parsedLocations[0].lat,
            lng: parsedLocations[0].lng
          };
        }
      }

      setUploadProgress(75);

      // 3. Create database record
      const { data, error: dbError } = await supabase
        .from('ip_tracks')
        .insert({
          title: title.trim(),
          artist: artist.trim(),
          description: description.trim() || null,
          tell_us_more: notes.trim() || null,
          content_type: 'video_clip',
          tags: tags,
          cover_image_url: coverImageUrl,
          video_url: videoUrl,
          bpm: bpm || null,
          primary_uploader_wallet: effectiveAddress,
          composition_split_1_wallet: effectiveAddress,
          composition_split_1_percentage: 100,
          production_split_1_wallet: effectiveAddress,
          production_split_1_percentage: 100,
          location_lat: finalLocationCoords?.lat || null,
          location_lng: finalLocationCoords?.lng || null,
          primary_location: location || null,
          agreed_to_terms: termsAccepted,
          // Save crop coordinates
          video_crop_x: croppedAreaPixels?.x || null,
          video_crop_y: croppedAreaPixels?.y || null,
          video_crop_width: croppedAreaPixels?.width || null,
          video_crop_height: croppedAreaPixels?.height || null,
          video_crop_zoom: zoom || 1.0
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setUploadProgress(100);

      showToast('🎬 Video clip uploaded successfully!', 'success');

      // Cleanup preview URL
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }

      if (onUploadComplete) {
        onUploadComplete();
      }

      onClose();

    } catch (error: any) {
      console.error('Error uploading video clip:', error);
      showToast(`Failed to upload video: ${error.message}`, 'error');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-[#1a2332] to-[#0f1419] rounded-2xl shadow-2xl w-full max-w-3xl border border-[#5BB5F9]/30 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#5BB5F9]/20 flex items-center justify-center">
              <Video className="w-5 h-5 text-[#5BB5F9]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Upload Video Clip</h2>
              <p className="text-sm text-gray-400">5-second clips with optional audio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isUploading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Video Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Video File <span className="text-red-400">*</span>
              <span className="text-xs text-gray-500 ml-2">(Max 5 seconds, 10MB, MP4 recommended)</span>
            </label>

            {!videoPreviewUrl ? (
              <div
                onClick={() => videoInputRef.current?.click()}
                className="border-2 border-dashed border-[#5BB5F9]/30 hover:border-[#5BB5F9] rounded-lg p-8 text-center cursor-pointer transition-colors bg-[#5BB5F9]/5 hover:bg-[#5BB5F9]/10"
              >
                <Upload className="w-12 h-12 text-[#5BB5F9] mx-auto mb-3" />
                <p className="text-gray-300 mb-1">Click to upload video</p>
                <p className="text-xs text-gray-500">MP4, MOV, or WebM (max 5 seconds)</p>
              </div>
            ) : (
              <div>
                {/* Cropper Container */}
                <div className="relative rounded-lg overflow-hidden bg-black" style={{ height: '400px' }}>
                  <Cropper
                    video={videoPreviewUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    objectFit="contain"
                  />

                  {/* Remove video button */}
                  <button
                    onClick={() => {
                      setVideoFile(null);
                      setVideoPreviewUrl(null);
                      setVideoDuration(null);
                      setShowCropper(false);
                      setCrop({ x: 0, y: 0 });
                      setZoom(1);
                      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
                    }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/90 hover:bg-red-500 flex items-center justify-center transition-colors z-10"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>

                  {videoDuration && (
                    <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white z-10">
                      {videoDuration.toFixed(1)}s
                    </div>
                  )}
                </div>

                {/* Cropper instructions */}
                <div className="mt-2 text-sm text-gray-400 bg-[#5BB5F9]/10 border border-[#5BB5F9]/30 rounded-lg p-3">
                  📐 Drag to reposition • Scroll or pinch to zoom • Square crop will be applied
                </div>
              </div>
            )}

            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              onChange={handleVideoFileChange}
              className="hidden"
            />
            {errors.video && <p className="mt-1 text-sm text-red-400">{errors.video}</p>}
          </div>

          {/* Cover image auto-generated from first video frame */}
          {coverImageUrl && (
            <div className="text-sm text-gray-400 bg-[#5BB5F9]/10 border border-[#5BB5F9]/30 rounded-lg p-3">
              ✅ Cover image auto-generated from video
            </div>
          )}

          {/* Title & Artist (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5BB5F9]"
                placeholder="Sunset Beach Walk"
                disabled={isUploading}
              />
              {errors.title && <p className="mt-1 text-sm text-red-400">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Artist <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5BB5F9]"
                placeholder="Your name"
                disabled={isUploading}
              />
              {errors.artist && <p className="mt-1 text-sm text-red-400">{errors.artist}</p>}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5BB5F9] resize-none"
              placeholder="Describe your video clip..."
              disabled={isUploading}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5BB5F9]"
                placeholder="Add a tag..."
                disabled={isUploading}
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-[#5BB5F9]/20 hover:bg-[#5BB5F9]/30 text-[#5BB5F9] rounded-lg transition-colors"
                disabled={isUploading}
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-[#5BB5F9]/20 text-[#5BB5F9] rounded-full text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-400 transition-colors"
                    disabled={isUploading}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* BPM (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              BPM (optional)
              <span className="text-xs text-gray-500 ml-2">For tempo-matched clips</span>
            </label>
            <input
              type="number"
              value={bpm || ''}
              onChange={(e) => setBpm(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5BB5F9]"
              placeholder="120"
              min="30"
              max="300"
              disabled={isUploading}
            />
          </div>

          {/* Location */}
          <div className="relative" ref={locationInputRef}>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Location
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
              <input
                type="text"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  handleLocationSearch(e.target.value);
                  setShowLocationDropdown(true);
                }}
                onFocus={() => suggestions.length > 0 && setShowLocationDropdown(true)}
                className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#5BB5F9]"
                placeholder="Where was this filmed?"
                disabled={isUploading}
              />
            </div>

            {/* Location dropdown */}
            {showLocationDropdown && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectLocation(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-slate-700 text-white text-sm transition-colors"
                  >
                    {suggestion.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Terms & Conditions */}
          <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-600 text-[#5BB5F9] focus:ring-[#5BB5F9]"
                disabled={isUploading}
              />
              <span className="text-sm text-gray-300">
                I confirm that I own or have the rights to this video content and agree to Mixmi's terms of service.
              </span>
            </label>
            {errors.terms && <p className="mt-2 text-sm text-red-400">{errors.terms}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            disabled={isUploading}
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={isUploading || !termsAccepted || !videoFile}
            className="px-8 py-2 bg-gradient-to-r from-[#5BB5F9] to-[#0EA5E9] hover:from-[#0EA5E9] hover:to-[#0284C7] text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading... {uploadProgress}%
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload Video Clip
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
