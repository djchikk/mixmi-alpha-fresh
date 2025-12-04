"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Music, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import Cropper from "react-easy-crop";
import Modal from "../ui/Modal";
import TrackCoverUploader from "../shared/TrackCoverUploader";
import { IPTrack, SAMPLE_TYPES, CONTENT_TYPES, LOOP_CATEGORIES, ContentType, LoopCategory } from "@/types";
// Removed useAuth dependency - modal handles authentication independently
import { useToast } from "@/contexts/ToastContext";
import SplitPresetManagerUI from "./SplitPresetManager";
import { parseLocationsAndGetCoordinates } from "@/lib/locationLookup";
import { supabase } from "@/lib/supabase";

// Import custom hooks
import { useIPTrackForm } from "@/hooks/useIPTrackForm";
import { useAudioUpload } from "@/hooks/useAudioUpload";
import { useIPTrackSubmit } from "@/hooks/useIPTrackSubmit";
import { useSplitPresets } from "@/hooks/useSplitPresets";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";
import ArtistAutosuggest from "../shared/ArtistAutosuggest";
import SimplifiedLicensingStep from "./steps/SimplifiedLicensingStep";
import { useAuth } from "@/contexts/AuthContext";
import { isValidStacksAddress, isAlphaCode, getWalletFromAuthIdentity } from "@/lib/auth/wallet-mapping";

interface IPTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  track?: IPTrack;
  onSave?: (track: IPTrack) => void;
  contentCategory?: 'music' | 'visual'; // Filter content types: music = loop/song/ep, visual = video_clip (and future: still_image)
}

export default function IPTrackModal({
  isOpen,
  onClose,
  track,
  onSave,
  contentCategory,
}: IPTrackModalProps) {
  // Global wallet auth state from header
  const { isAuthenticated: globalWalletConnected, walletAddress: globalWalletAddress } = useAuth();
  
  // 🎯 UPDATED AUTH: Global wallet OR alpha verification
  const [alphaWallet, setAlphaWallet] = useState<string>(''); // For alpha verification fallback
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [inputWallet, setInputWallet] = useState(''); // For auth input
  const [useVerificationWallet, setUseVerificationWallet] = useState(true); // For wallet checkbox
  const { showToast } = useToast();
  
  // Combined authentication state
  const isAuthenticated = globalWalletConnected || !!alphaWallet;
  const walletToUse = globalWalletAddress || alphaWallet;
  
  // Use custom hooks
  const {
    formData,
    validationErrors,
    currentStep,
    isQuickUpload,
    tagInputValue,
    setFormData,
    setValidationErrors,
    setCurrentStep,
    setIsQuickUpload,
    setTagInputValue,
    handleInputChange,
    handleTagsChange,
    handleModeToggle,
    validateSplits,
    nextStep,
    prevStep,
    goToStep,
    getSteps,
    resetForm,
    handleLoadPreset,
  } = useIPTrackForm({ track, walletAddress: walletToUse }); // Use combined auth wallet
  
  const {
    uploadedAudioFile,
    isAudioUploading,
    audioUploadProgress,
    bpmDetection,
    isDetectingBPM,
    audioInputType,
    setAudioInputType,
    handleAudioFileUpload: handleAudioFileUploadBase,
    processAudioFile,
    resetAudioUpload,
  } = useAudioUpload({
    walletAddress: walletToUse, // Use combined auth wallet for audio processing
    contentType: formData.content_type,
    currentBPM: formData.bpm,
    onBPMDetected: (bpm) => {
      // Only update BPM if user hasn't manually entered one
      if (!formData.bpm || formData.bpm === 0) {
        // Auto-detected BPM applied
        handleInputChange('bpm', Math.round(bpm));
      } else {
        // Keeping user-specified BPM
      }
    },
    onAudioUploaded: (url) => handleInputChange('audio_url', url),
    onDurationDetected: (duration) => handleInputChange('duration', duration),
  });
  
  const {
    isSaving,
    saveStatus,
    submitTrack,
    setSaveStatus,
  } = useIPTrackSubmit({
    walletAddress: formData.wallet_address || '',
    alphaWallet: walletToUse, // Pass combined auth wallet
    track,
    onSave,
    onSuccess: () => {
      // Show immediate toast feedback
      const successMessage = formData.content_type === 'loop_pack' 
        ? `✅ Loop Pack saved! Refresh to see it on the globe!`
        : formData.content_type === 'ep'
        ? `✅ EP saved! Refresh to see it on the globe!`
        : '✅ Track saved! Refresh to see it on the globe!';
      showToast(successMessage, 'success');
      
      // Reset form and audio
      resetForm();
      resetAudioUpload();
    },
  });
  
  const {
    presets,
    isLoadingPresets,
    handleSavePreset,
    handleDeletePreset,
    refreshPresets,
  } = useSplitPresets({ walletAddress: formData?.wallet_address || '' });

  // Auto-select video_clip when in visual category mode
  useEffect(() => {
    if (isOpen && contentCategory === 'visual' && formData.content_type !== 'video_clip') {
      handleInputChange('content_type', 'video_clip');
    }
  }, [isOpen, contentCategory, formData.content_type, handleInputChange]);

  // Location input state
  const [locationInput, setLocationInput] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedLocationCoords, setSelectedLocationCoords] = useState<Array<{lat: number; lng: number; name: string}>>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [imageInputType, setImageInputType] = useState<'upload' | 'url'>('upload');
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Video upload state
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [isVideoUploading, setIsVideoUploading] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Video crop state
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [videoNaturalWidth, setVideoNaturalWidth] = useState<number | null>(null);
  const [videoNaturalHeight, setVideoNaturalHeight] = useState<number | null>(null);

  // Track metadata for EPs/Loop Packs (title, bpm per track)
  interface TrackMetadata {
    file: File | null; // null for existing tracks (edit mode)
    title: string;
    bpm?: number;
    id?: string; // Track ID for existing tracks (edit mode)
    position?: number; // Pack position for existing tracks
  }
  const [trackMetadata, setTrackMetadata] = useState<TrackMetadata[]>([]);

  // Crop callback
  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Use location autocomplete hook
  const {
    suggestions,
    isLoading: isLoadingLocations,
    error: locationError,
    handleInputChange: handleLocationSearch,
    clearSuggestions,
    cleanup: cleanupLocationSearch
  } = useLocationAutocomplete({
    minCharacters: 3,
    debounceMs: 300,
    limit: 5
  });

  // Reset form when modal opens or load existing track data
  useEffect(() => {
    if (isOpen) {
      if (!track) {
        // New track - reset everything
        resetForm();
        resetAudioUpload();
        setLocationInput('');
        setSelectedLocations([]);
        setSelectedLocationCoords([]); // Also clear the coordinates
        clearSuggestions();
      } else {
        // Editing existing track - populate location if it exists
        // First try primary_location field
        if (track.primary_location) {
          // Parse existing locations from primary_location field
          const locations = track.primary_location.split(',').map(l => l.trim());
          setSelectedLocations(locations);
        }
        // Also check for location tags in the tags array (prefixed with 🌍)
        if (track.tags && Array.isArray(track.tags)) {
          const locationTags = track.tags
            .filter(tag => tag.startsWith('🌍'))
            .map(tag => tag.replace('🌍 ', '').replace('🌍', '').trim());
          if (locationTags.length > 0) {
            setSelectedLocations(prev => {
              // Merge without duplicates
              const merged = [...prev];
              locationTags.forEach(loc => {
                if (!merged.includes(loc)) {
                  merged.push(loc);
                }
              });
              return merged;
            });
          }
        }

        // Load existing video crop data if editing a video clip
        if (track.content_type === 'video_clip') {
          if (track.video_crop_x !== undefined && track.video_crop_x !== null) {
            setCroppedAreaPixels({
              x: track.video_crop_x,
              y: track.video_crop_y,
              width: track.video_crop_width,
              height: track.video_crop_height
            });
          }
          if (track.video_crop_zoom) {
            setZoom(track.video_crop_zoom);
          }
          if (track.video_natural_width) {
            setVideoNaturalWidth(track.video_natural_width);
          }
          if (track.video_natural_height) {
            setVideoNaturalHeight(track.video_natural_height);
          }
        }

        // Load EP/Loop Pack child tracks when editing
        if ((track.content_type === 'ep' || track.content_type === 'loop_pack') && track.id) {
          // Fetch child tracks with title, bpm, and position for editing
          const fetchChildTracks = async () => {
            try {
              const { data: children, error } = await supabase
                .from('ip_tracks')
                .select('id, title, bpm, pack_position')
                .eq('pack_id', track.id)
                .neq('id', track.id) // Exclude the container itself
                .order('pack_position', { ascending: true });

              if (!error && children && children.length > 0) {
                console.log(`📀 ${track.content_type === 'ep' ? 'EP' : 'Loop Pack'} has ${children.length} tracks`);
                handleInputChange('ep_song_count', children.length);

                // Initialize trackMetadata from existing database records
                setTrackMetadata(children.map(child => ({
                  file: null as any, // No file for existing tracks
                  title: child.title || `Track ${child.pack_position}`,
                  bpm: child.bpm || undefined,
                  id: child.id, // Store ID for updating existing records
                  position: child.pack_position
                })));
              }
            } catch (err) {
              console.error('Error fetching child tracks:', err);
            }
          };
          fetchChildTracks();
        }
      }
    } else {
      // Modal closing - cleanup
      cleanupLocationSearch();
      setShowLocationDropdown(false);
      // Reset authentication state
      setInputWallet('');
      setAlphaWallet('');
    }
    // Remove dependencies that might cause re-renders
  }, [isOpen, track?.id]); // Only depend on track.id, not the whole track object
  
  // Smart default behavior for wallet checkbox - convert alpha codes to wallet addresses
  useEffect(() => {
    const authWallet = globalWalletAddress || alphaWallet;
    if (authWallet && useVerificationWallet && (!formData.wallet_address || formData.wallet_address.trim() === '')) {
      // Convert alpha code to actual wallet address for blockchain operations
      const convertAndFill = async () => {
        try {
          const response = await fetch('/api/auth/resolve-wallet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ authIdentity: authWallet })
          });
          
          const result = await response.json();
          
          if (result.success && result.walletAddress) {
            console.log(`🔄 Converting auth identity: ${authWallet} → ${result.walletAddress}`);
            handleInputChange('wallet_address', result.walletAddress);
          } else {
            console.error('Could not resolve wallet address for auth identity:', authWallet);
            showToast('❌ Could not resolve wallet address for your account', 'error');
          }
        } catch (error) {
          console.error('Error converting auth identity to wallet:', error);
          showToast('❌ Authentication service temporarily unavailable', 'error');
        }
      };
      
      convertAndFill();
    }
  }, [globalWalletAddress, alphaWallet, useVerificationWallet, formData.wallet_address, handleInputChange]);
  
  // Show dropdown when suggestions are available
  useEffect(() => {
    setShowLocationDropdown(suggestions.length > 0);
  }, [suggestions]);

  // 🎯 Auto-check wallet approval when modal opens with connected wallet
  useEffect(() => {
    const checkWalletApproval = async () => {
      if (isOpen && globalWalletConnected && globalWalletAddress && !alphaWallet) {
        console.log('🔍 Auto-checking wallet approval for:', globalWalletAddress);
        setIsAuthenticating(true);

        try {
          const response = await fetch('/api/auth/alpha-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress: globalWalletAddress })
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              // Wallet is approved! Skip auth screen
              console.log('✅ Wallet approved:', result.user?.artist_name);
              setAlphaWallet(globalWalletAddress);
              showToast(`✅ Welcome ${result.user?.artist_name || 'Alpha User'}!`, 'success');
            } else {
              // Wallet not approved - user will see alpha code input
              console.log('⚠️ Wallet not approved, showing invite code input');
            }
          }
        } catch (error) {
          console.error('Error checking wallet approval:', error);
        } finally {
          setIsAuthenticating(false);
        }
      }
    };

    checkWalletApproval();
  }, [isOpen, globalWalletConnected, globalWalletAddress, alphaWallet, showToast]);

  // 🎯 Alpha Authentication Handler - runs when user manually enters invite code/wallet
  const handleAlphaAuthentication = async (inputWallet: string) => {
    setIsAuthenticating(true);
    try {
      // Call server-side alpha authentication
      const response = await fetch('/api/auth/alpha-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: inputWallet.trim() })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setAlphaWallet(inputWallet.trim()); // Store alpha verification wallet
          showToast(`✅ Welcome ${result.user?.artist_name || 'Alpha User'}!`, 'success');
          return true;
        } else {
          showToast(result.error || 'Authentication failed', 'error');
          return false;
        }
      } else {
        showToast('Authentication service unavailable', 'error');
        return false;
      }
    } catch (error) {
      console.error('Auth error:', error);
      showToast('Authentication failed', 'error');
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the input AND not on the dropdown itself
      const dropdown = document.getElementById('location-dropdown');
      if (locationInputRef.current && 
          !locationInputRef.current.contains(target) &&
          dropdown && 
          !dropdown.contains(target)) {
        setShowLocationDropdown(false);
      }
    };
    
    if (showLocationDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLocationDropdown]);

  // Prevent navigation away during audio upload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isAudioUploading && audioUploadProgress.stage !== 'idle' && audioUploadProgress.stage !== 'complete') {
        event.preventDefault();
        event.returnValue = 'Audio upload in progress. Are you sure you want to leave?';
        return 'Audio upload in progress. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isAudioUploading, audioUploadProgress.stage]);

  // Handle audio file upload - supports both single and multi-file
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const files = Array.from(e.target.files || []);
      
      if (formData.content_type === 'loop_pack') {
        // Multi-file handling for loop packs
        // Loop pack files processing
        
        if (files.length < 2) {
          setValidationErrors(['Please select at least 2 audio files for a loop pack']);
          return;
        }
        
        if (files.length > 5) {
          setValidationErrors(['Maximum 5 audio files allowed per loop pack']);
          return;
        }
        
        // Validate file types and sizes
        const invalidFiles = files.filter(file => {
          const isValidType = file.type.startsWith('audio/') || ['.mp3', '.wav', '.flac', '.m4a', '.ogg'].some(ext => file.name.toLowerCase().endsWith(ext));
          const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit per file
          return !isValidType || !isValidSize;
        });
        
        if (invalidFiles.length > 0) {
          setValidationErrors([`Invalid files: ${invalidFiles.map(f => f.name).join(', ')}. Check file type and size (max 10MB each).`]);
          return;
        }
        
        // Store files in form data
        handleInputChange('loop_files', files);
        // Initialize track metadata with filenames (strip extension for cleaner titles)
        setTrackMetadata(files.map(file => ({
          file,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '), // Remove extension, replace underscores
          bpm: formData.bpm || undefined // Loops inherit pack BPM
        })));
        setValidationErrors([]);
        console.log('✅ Loop pack files validated and stored');
        
      } else if (formData.content_type === 'ep') {
        // Multi-file handling for EPs
        // EP files processing
        
        if (files.length < 2) {
          setValidationErrors(['Please select at least 2 song files for an EP']);
          return;
        }
        
        if (files.length > 5) {
          setValidationErrors(['Maximum 5 song files allowed per EP']);
          return;
        }
        
        // Validate file types and sizes (larger limit for songs)
        const invalidFiles = files.filter(file => {
          const isValidType = file.type.startsWith('audio/') || ['.mp3', '.wav', '.flac', '.m4a', '.ogg'].some(ext => file.name.toLowerCase().endsWith(ext));
          const isValidSize = file.size <= 50 * 1024 * 1024; // 50MB limit per song file
          return !isValidType || !isValidSize;
        });
        
        if (invalidFiles.length > 0) {
          setValidationErrors([`Invalid files: ${invalidFiles.map(f => f.name).join(', ')}. Check file type and size (max 50MB each).`]);
          return;
        }
        
        // Store files in form data
        handleInputChange('ep_files', files);
        // Initialize track metadata with filenames (strip extension for cleaner titles)
        setTrackMetadata(files.map(file => ({
          file,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '), // Remove extension, replace underscores
          bpm: undefined // Songs have individual BPMs - user can set in review step
        })));

        // Calculate and set total EP price
        const pricePerSong = (formData as any).price_per_song || 2.5;
        const totalPrice = pricePerSong * files.length;
        handleInputChange('price_stx', totalPrice);

        setValidationErrors([]);
        console.log('✅ EP files validated and stored, total price:', totalPrice);
        
      } else {
        // Single file handling for regular tracks
        await handleAudioFileUploadBase(e);
      }
    } catch (error) {
      setValidationErrors([error instanceof Error ? error.message : 'Failed to upload audio file']);
    }
  };

  // Audio drag-and-drop handler
  const handleAudioDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    // Create a synthetic event to reuse existing handleAudioFileUpload logic
    const syntheticEvent = {
      target: { files: acceptedFiles }
    } as React.ChangeEvent<HTMLInputElement>;
    
    handleAudioFileUpload(syntheticEvent);
  }, [handleAudioFileUpload]);

  // Configure dropzone for audio files
  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps, isDragActive: isAudioDragActive } = useDropzone({
    onDrop: handleAudioDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac']
    },
    multiple: formData.content_type === 'loop_pack' || formData.content_type === 'ep',
    disabled: isAudioUploading
  });

  // Capture first frame of video as thumbnail
  const captureVideoThumbnail = async (videoElement: HTMLVideoElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // Seek to 0.1 seconds to avoid black frames
      videoElement.currentTime = 0.1;

      videoElement.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

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

  // Handle video file upload
  const handleVideoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setValidationErrors(['Please upload a video file (MP4 recommended)']);
      return;
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setValidationErrors(['Video file must be under 10MB']);
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

      // Capture video natural dimensions for crop calculations
      setVideoNaturalWidth(videoElement.videoWidth);
      setVideoNaturalHeight(videoElement.videoHeight);
      console.log(`📹 Video natural dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}`);

      // Validate duration (5 seconds max)
      if (duration > 5.5) { // Allow small buffer for encoding variations
        setValidationErrors([`Video must be 5 seconds or less (yours is ${duration.toFixed(1)}s)`]);
        setVideoFile(null);
        setVideoPreviewUrl(null);
        URL.revokeObjectURL(previewUrl);
      } else {
        setValidationErrors([]);

        // Capture first frame as thumbnail
        try {
          setIsVideoUploading(true);
          const thumbnailBlob = await captureVideoThumbnail(videoElement);

          // Upload thumbnail to cover-images bucket
          const { supabase } = await import('@/lib/supabase');
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

            handleInputChange('cover_image_url', thumbnailUrl);
            console.log('✅ Auto-generated cover image from first frame');
          }
        } catch (error) {
          console.error('Error capturing thumbnail:', error);
          showToast('⚠️ Failed to generate cover image, please upload manually', 'warning');
        } finally {
          setIsVideoUploading(false);
        }

        // Upload video file to storage
        try {
          setIsVideoUploading(true);
          const { supabase } = await import('@/lib/supabase');
          const videoFileName = `${crypto.randomUUID()}.mp4`;
          const { data: videoUploadData, error: videoUploadError } = await supabase.storage
            .from('video-clips')
            .upload(videoFileName, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (videoUploadError) throw videoUploadError;

          // Get public URL for video
          const { data: { publicUrl: videoUrl } } = supabase.storage
            .from('video-clips')
            .getPublicUrl(videoFileName);

          handleInputChange('video_url', videoUrl);
          handleInputChange('duration', duration);
          console.log('✅ Video uploaded successfully');
          showToast('✅ Video uploaded successfully!', 'success');
        } catch (error) {
          console.error('Error uploading video:', error);
          showToast('❌ Failed to upload video', 'error');
          setValidationErrors(['Failed to upload video file']);
        } finally {
          setIsVideoUploading(false);
        }
      }
    };
  };

  // Video drag-and-drop handler
  const handleVideoDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Create a synthetic event to reuse existing handleVideoFileUpload logic
    const syntheticEvent = {
      target: { files: [acceptedFiles[0]] }
    } as React.ChangeEvent<HTMLInputElement>;

    handleVideoFileUpload(syntheticEvent);
  }, [handleVideoFileUpload]);

  // Configure dropzone for video files
  const { getRootProps: getVideoRootProps, getInputProps: getVideoInputProps, isDragActive: isVideoDragActive } = useDropzone({
    onDrop: handleVideoDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.webm']
    },
    multiple: false,
    disabled: isVideoUploading
  });

  // Auto-close modal after successful upload
  useEffect(() => {
    if (saveStatus === 'complete') {
      // Show success for 2 seconds, then close
      const timer = setTimeout(() => {
        onClose();
        // Reset form for next upload
        resetForm();
        setSaveStatus('idle');
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [saveStatus, onClose, resetForm]);

  // Handle final submission
  const handleSubmit = async () => {
    // Force a visible alert to confirm this function is called
    console.warn('🚨🚨🚨 HANDLESUBMIT CALLED');
    
    // Clear any previous validation errors
    setValidationErrors([]);
    
    console.log('🎯 SUBMIT STARTED - Form Data:', formData);
    console.log('📋 Current validation errors:', validationErrors);
    console.log('🌍 LOCATION INPUT STATE:', locationInput);
    console.log('🌍 LOCATION INPUT TYPE:', typeof locationInput);
    console.log('🌍 LOCATION INPUT LENGTH:', locationInput ? locationInput.length : 'null/undefined');
    
    // Use the exact coordinates saved from autocomplete (no re-geocoding!)
    let locationResult;
    if (selectedLocationCoords.length > 0) {
      console.log('✅ Using exact coordinates from autocomplete selections:', selectedLocationCoords);
      locationResult = {
        primary: selectedLocationCoords[0],
        all: selectedLocationCoords,
        rawText: selectedLocations.join(', '),
        rawLocations: selectedLocations
      };
    } else {
      // Fallback to old method if no coordinates stored (backward compatibility)
      console.log('⚠️ No stored coordinates, falling back to re-geocoding...');
      const locationsString = selectedLocations.join(', ');
      locationResult = await parseLocationsAndGetCoordinates(locationsString);
    }
    console.log('📍 Final location result:', locationResult);
    
    // Add detailed logging for location data
    console.log('🗺️ Location data being saved:', {
      selectedLocations: selectedLocations,
      rawText: locationResult.rawText,
      rawLocations: locationResult.rawLocations,
      primary: locationResult.primary,
      all: locationResult.all
    });
    
    // Add location tags with 🌍 prefix - use all location names
    // First, remove any existing location tags to avoid duplicates
    const nonLocationTags = formData.tags.filter(tag => !tag.startsWith('🌍'));
    const locationTags = locationResult.all.map(loc => `🌍 ${loc.name}`);
    const allTags = [...nonLocationTags, ...locationTags];
    
    // Update form data with location info
    // IMPORTANT: Always save the raw text, coordinates may be 0 (which becomes NULL in DB)
    const updatedFormData = {
      ...formData,
      tags: allTags,
      // Use coordinates if found (0 will be saved as NULL in database)
      location_lat: locationResult.primary?.lat === 0 ? null : locationResult.primary?.lat,
      location_lng: locationResult.primary?.lng === 0 ? null : locationResult.primary?.lng,
      // ALWAYS save the location text, even if coordinates weren't found
      // Use null instead of undefined for proper database insertion
      primary_location: locationResult.rawText || null,
      locations: locationResult.all.length > 0 ? locationResult.all : null,
      // Add video crop data if it's a video clip
      // Use current crop state (which may have been loaded from existing track or set by user)
      // Fall back to existing track data if no crop state exists
      ...(formData.content_type === 'video_clip' ? {
        video_crop_x: croppedAreaPixels?.x ?? track?.video_crop_x ?? null,
        video_crop_y: croppedAreaPixels?.y ?? track?.video_crop_y ?? null,
        video_crop_width: croppedAreaPixels?.width ?? track?.video_crop_width ?? null,
        video_crop_height: croppedAreaPixels?.height ?? track?.video_crop_height ?? null,
        video_crop_zoom: zoom ?? track?.video_crop_zoom ?? 1,
        video_natural_width: videoNaturalWidth ?? track?.video_natural_width ?? null,
        video_natural_height: videoNaturalHeight ?? track?.video_natural_height ?? null
      } : {}),
      // Add track metadata for EPs and Loop Packs (per-track titles and BPM)
      ...((formData.content_type === 'ep' || formData.content_type === 'loop_pack') && trackMetadata.length > 0 ? {
        track_metadata: trackMetadata.map((tm, idx) => ({
          id: tm.id || null, // Include track ID for existing tracks (edit mode)
          title: tm.title,
          bpm: tm.bpm || null,
          position: idx + 1 // 1-indexed position based on current order
        }))
      } : {})
    };

    // Log crop data being saved
    if (formData.content_type === 'video_clip') {
      console.log('📹 Saving video crop data:', {
        croppedAreaPixels,
        zoom,
        videoNaturalWidth,
        videoNaturalHeight,
        hasCropData: !!croppedAreaPixels
      });
    }

    // Log the final data being sent
    console.log('📤 Updated form data with location:', {
      primary_location: updatedFormData.primary_location,
      location_lat: updatedFormData.location_lat,
      location_lng: updatedFormData.location_lng,
      locations: updatedFormData.locations
    });
    
    // Validate all splits
    const compositionValidation = validateSplits('composition');
    const productionValidation = validateSplits('production');
    
    console.log('🎵 Composition validation:', compositionValidation);
    console.log('🎤 Production validation:', productionValidation);
    
    const errors = [...compositionValidation.errors, ...productionValidation.errors];
    console.log('📝 Initial errors from splits:', errors);
    
    // Validate required fields - conditional for multi-content types
    if (updatedFormData.content_type === 'loop_pack') {
      // Loop packs need pack title, not track title
      if (!(updatedFormData as any).pack_title || (updatedFormData as any).pack_title.trim() === '') {
        errors.push('Pack title is required');
      }
    } else if (updatedFormData.content_type === 'ep') {
      // EPs need EP title, not track title
      if (!(updatedFormData as any).ep_title || (updatedFormData as any).ep_title.trim() === '') {
        errors.push('EP title is required');
      }
    } else {
      // Regular tracks need track title
      if (!updatedFormData.title || updatedFormData.title.trim() === '') {
        errors.push('Track title is required');
      }
    }
    
    if (!updatedFormData.artist || updatedFormData.artist.trim() === '') {
      errors.push('Artist name is required');
    }
    
    // Validate BPM for loops - always required for loops in advanced mode
    if (!isQuickUpload && updatedFormData.content_type === 'loop' && (!updatedFormData.bpm || updatedFormData.bpm <= 0 || isNaN(updatedFormData.bpm))) {
      errors.push('BPM is required for loops and must be a valid number greater than 0');
    }
    
    // Validate stem/other category details
    if (updatedFormData.content_type === 'loop' && (updatedFormData.loop_category === 'stem' || updatedFormData.loop_category === 'other')) {
      if (!updatedFormData.tell_us_more || updatedFormData.tell_us_more.trim() === '') {
        errors.push(updatedFormData.loop_category === 'stem' ? 'Stem type is required' : 'Category description is required for "Other" loops');
      }
    }
    
    // Validate audio - different for multi-content vs regular tracks
    if (updatedFormData.content_type === 'loop_pack') {
      // Loop packs need multiple audio files
      if (!(updatedFormData as any).loop_files || (updatedFormData as any).loop_files.length === 0) {
        errors.push('At least 2 audio files are required for loop packs');
      }
    } else if (updatedFormData.content_type === 'ep') {
      // EPs need multiple song files
      if (!(updatedFormData as any).ep_files || (updatedFormData as any).ep_files.length === 0) {
        errors.push('At least 2 song files are required for EPs');
      }
    } else if (updatedFormData.content_type === 'video_clip') {
      // Video clips need video URL
      if (!(updatedFormData as any).video_url || (updatedFormData as any).video_url.trim() === '') {
        errors.push('Video file is required');
      }
    } else {
      // Regular tracks need audio URL
      if (!updatedFormData.audio_url || updatedFormData.audio_url.trim() === '') {
        errors.push('Audio file is required');
      }
    }

    // Validate coordinates are valid if present
    if (updatedFormData.location_lat !== null && updatedFormData.location_lat !== undefined) {
      if (isNaN(updatedFormData.location_lat) || 
          updatedFormData.location_lat < -90 || 
          updatedFormData.location_lat > 90) {
        errors.push('Invalid latitude. Must be between -90 and 90 degrees.');
      }
    }
    
    if (updatedFormData.location_lng !== null && updatedFormData.location_lng !== undefined) {
      if (isNaN(updatedFormData.location_lng) || 
          updatedFormData.location_lng < -180 || 
          updatedFormData.location_lng > 180) {
        errors.push('Invalid longitude. Must be between -180 and 180 degrees.');
      }
    }

    console.log('📊 Final validation errors:', errors);
    console.log('📊 Errors length:', errors.length);

    if (errors.length > 0) {
      console.error('❌ VALIDATION FAILED with errors:', errors);
      setValidationErrors(errors);
      return;
    }

    // Log what's being submitted for video clips
    if (updatedFormData.content_type === 'video_clip') {
      console.log('🎬 SUBMITTING VIDEO CLIP DATA:', {
        has_crop_x: 'video_crop_x' in updatedFormData,
        has_crop_y: 'video_crop_y' in updatedFormData,
        has_natural_width: 'video_natural_width' in updatedFormData,
        video_crop_x: (updatedFormData as any).video_crop_x,
        video_crop_y: (updatedFormData as any).video_crop_y,
        video_crop_width: (updatedFormData as any).video_crop_width,
        video_crop_height: (updatedFormData as any).video_crop_height,
        video_crop_zoom: (updatedFormData as any).video_crop_zoom,
        video_natural_width: (updatedFormData as any).video_natural_width,
        video_natural_height: (updatedFormData as any).video_natural_height
      });
    }

    try {
      await submitTrack(updatedFormData, errors);
    } catch (error) {
      console.error('💥 Save failed:', error);
      setValidationErrors([error instanceof Error ? error.message : 'Failed to save track']);
    }
  };

  // Helper function to get steps
  const getStepsArray = getSteps();

  // Render functions for each step
  const renderBasicInfo = () => (
    <div className="space-y-6" style={{ gap: '24px' }}>
      {/* Content Attribution Wallet */}
      <div 
        className="border rounded-lg p-4 space-y-3"
        style={{
          background: 'rgba(0, 0, 0, 0.25)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '12px'
        }}
      >
        <input
          type="text"
          value={formData.wallet_address || ''}
          onChange={(e) => handleInputChange('wallet_address', e.target.value)}
          readOnly={useVerificationWallet && (globalWalletAddress || alphaWallet)}
          title="Upload for different wallets: Useful for managers, labels, or multiple creative identities"
          className={`w-full px-3 py-3 rounded-md text-white placeholder-gray-500 border focus:outline-none transition-all duration-200 ${
            useVerificationWallet && (globalWalletAddress || alphaWallet)
              ? 'bg-gray-700/50 cursor-not-allowed text-gray-300' 
              : 'bg-black/25 cursor-text text-white'
          }`}
          style={{
            borderColor: useVerificationWallet && (globalWalletAddress || alphaWallet)
              ? 'rgba(129, 228, 242, 0.3)' 
              : 'rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            placeholderColor: useVerificationWallet && (globalWalletAddress || alphaWallet) ? '#9ca3af' : '#4a5264'
          }}
          placeholder={
            useVerificationWallet && (globalWalletAddress || alphaWallet)
              ? "Using authenticated wallet (read-only)" 
              : "SP1234... (Wallet for this content)"
          }
        />
        
        {/* Attribution Checkbox - Essential for business use cases */}
        {(globalWalletAddress || alphaWallet) && (
          <label className="flex items-center gap-3 cursor-pointer mt-3">
            <input
              type="checkbox"
              checked={useVerificationWallet}
              onChange={(e) => {
                setUseVerificationWallet(e.target.checked);
                const authWallet = globalWalletAddress || alphaWallet;
                if (e.target.checked) {
                  handleInputChange('wallet_address', authWallet);
                } else {
                  handleInputChange('wallet_address', '');
                }
              }}
              className="w-5 h-5 rounded text-[#81E4F2] focus:ring-[#81E4F2]"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: '#81E4F2',
              }}
            />
            <span className="text-white text-sm">
              Use authenticated account for creative ownership ({(globalWalletAddress || alphaWallet).substring(0, 8)}...)
            </span>
          </label>
        )}
      </div>

      {/* Content Type Selection - New Grid Layout */}
      <div>
        <label className="block text-sm font-normal text-gray-300 mb-3">Content Type</label>
        <div className="grid grid-cols-2 gap-3">
          {/* Music content types - show when category is 'music' or undefined (default/legacy) */}
          {(!contentCategory || contentCategory === 'music') && (
            <>
              {/* Top left: 8-Bar Loop */}
              <button
                type="button"
                onClick={() => handleInputChange('content_type', 'loop')}
                className="flex items-center justify-center border-2 rounded-lg transition-all"
                style={{
                  padding: '14px',
                  minHeight: '54px',
                  background: formData.content_type === 'loop' ? 'rgba(229, 231, 235, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: formData.content_type === 'loop' ? '#e5e7eb' : 'rgba(255, 255, 255, 0.08)',
                  color: formData.content_type === 'loop' ? '#e5e7eb' : '#8b92a6',
                  borderRadius: '12px'
                }}
              >
                8-Bar Loop
              </button>

              {/* Top right: Loop Pack */}
              <button
                type="button"
                onClick={() => handleInputChange('content_type', 'loop_pack')}
                className="flex items-center justify-center border-2 rounded-lg transition-all"
                style={{
                  padding: '14px',
                  minHeight: '54px',
                  background: formData.content_type === 'loop_pack' ? 'rgba(229, 231, 235, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: formData.content_type === 'loop_pack' ? '#e5e7eb' : 'rgba(255, 255, 255, 0.08)',
                  color: formData.content_type === 'loop_pack' ? '#e5e7eb' : '#8b92a6',
                  borderRadius: '12px'
                }}
              >
                Loop Pack
              </button>

              {/* Bottom left: Song */}
              <button
                type="button"
                onClick={() => handleInputChange('content_type', 'full_song')}
                className="flex items-center justify-center border-2 rounded-lg transition-all"
                style={{
                  padding: '14px',
                  minHeight: '54px',
                  background: formData.content_type === 'full_song' ? 'rgba(229, 231, 235, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: formData.content_type === 'full_song' ? '#e5e7eb' : 'rgba(255, 255, 255, 0.08)',
                  color: formData.content_type === 'full_song' ? '#e5e7eb' : '#8b92a6',
                  borderRadius: '12px'
                }}
              >
                Song
              </button>

              {/* Bottom right: EP */}
              <button
                type="button"
                onClick={() => handleInputChange('content_type', 'ep')}
                className="flex items-center justify-center border-2 rounded-lg transition-all"
                style={{
                  padding: '14px',
                  minHeight: '54px',
                  background: formData.content_type === 'ep' ? 'rgba(229, 231, 235, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: formData.content_type === 'ep' ? '#e5e7eb' : 'rgba(255, 255, 255, 0.08)',
                  color: formData.content_type === 'ep' ? '#e5e7eb' : '#8b92a6',
                  borderRadius: '12px'
                }}
              >
                EP (2-5 songs)
              </button>
            </>
          )}

          {/* Visual content types - show ONLY when category is 'visual' */}
          {(contentCategory === 'visual') && (
            <>
              {/* Video Clip - Permanently ON until still images are added */}
              <button
                type="button"
                onClick={() => handleInputChange('content_type', 'video_clip')}
                className="flex items-center justify-center border-2 rounded-lg transition-all"
                style={{
                  padding: '14px',
                  minHeight: '54px',
                  background: 'rgba(56, 189, 248, 0.15)', // Always active
                  borderColor: '#2792F5', // Always active
                  color: '#2792F5', // Always active
                  borderRadius: '12px'
                }}
              >
                Video Clip
              </button>
            </>
          )}
        </div>
      </div>

      {/* Title and Version - Conditional based on content type */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-normal text-gray-300 mb-2">
            {formData.content_type === 'loop_pack' ? 'Pack Title' :
             formData.content_type === 'ep' ? 'EP Title' :
             formData.content_type === 'loop' ? 'Loop Title' :
             formData.content_type === 'full_song' ? 'Song Title' :
             formData.content_type === 'video_clip' ? 'Clip Title' : 'Track Title'}
          </label>
          <input
            type="text"
            value={formData.content_type === 'loop_pack' ? (formData as any).pack_title || '' : 
                   formData.content_type === 'ep' ? (formData as any).ep_title || '' : formData.title}
            onChange={(e) => {
              if (formData.content_type === 'loop_pack') {
                handleInputChange('pack_title' as any, e.target.value);
              } else if (formData.content_type === 'ep') {
                handleInputChange('ep_title' as any, e.target.value);
                handleInputChange('title', e.target.value); // Also set regular title for card display
              } else {
                handleInputChange('title', e.target.value);
              }
            }}
            className="input-field"
            placeholder={formData.content_type === 'loop_pack' ? 'Pack Name (e.g., Underground House Pack)' :
                        formData.content_type === 'ep' ? 'EP Name (e.g., Midnight Sessions EP)' :
                        formData.content_type === 'loop' ? 'Loop Name (e.g., Dark Bass Loop)' :
                        formData.content_type === 'full_song' ? 'Song Name (e.g., Midnight Drive)' :
                        formData.content_type === 'video_clip' ? 'Clip Name' : 'Track Name'}
          />
        </div>
        <div>
          <label className="block text-sm font-normal text-gray-300 mb-2">Version <span className="text-gray-500">(optional)</span></label>
          <input
            type="text"
            value={formData.version}
            onChange={(e) => handleInputChange('version', e.target.value)}
            className="input-field"
            placeholder="optional"
          />
        </div>
      </div>

      {/* Artist */}
      <div>
        <label className="block text-sm font-normal text-gray-300 mb-2">Artist Name</label>
        <ArtistAutosuggest
          value={formData.artist}
          onChange={(value) => handleInputChange('artist', value)}
          className="input-field"
          placeholder="Artist or Project name"
          required={true}
        />
      </div>

      {/* Loop Pack Description - Only show for loop packs */}
      {formData.content_type === 'loop_pack' && (
        <div>
          <label className="block text-sm font-normal text-gray-300 mb-2">Pack Description <span className="text-gray-500">(optional)</span></label>
          <textarea
            value={(formData as any).pack_description || ''}
            onChange={(e) => handleInputChange('pack_description' as any, e.target.value)}
            className="input-field"
            placeholder="Describe the style and vibe of this loop pack..."
            rows={3}
          />
        </div>
      )}

      {/* Loop Category - Only show for loops */}
      {formData.content_type === 'loop' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-normal text-gray-300 mb-2">Loop Category <span className="text-gray-500">(optional)</span></label>
            <select
              value={formData.loop_category}
              onChange={(e) => handleInputChange('loop_category', e.target.value)}
              className="select-field"
            >
              {LOOP_CATEGORIES.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Additional details for Stem and Other categories */}
          {(formData.loop_category === 'stem' || formData.loop_category === 'other') && (
            <div>
              <label className="block text-sm font-normal text-gray-300 mb-2">
                {formData.loop_category === 'stem' ? 'Stem Type' : 'Category Description'}
              </label>
              <input
                type="text"
                value={formData.tell_us_more || ''}
                onChange={(e) => handleInputChange('tell_us_more', e.target.value)}
                className="input-field"
                placeholder={
                  formData.loop_category === 'stem' 
                    ? "e.g., Vocals, Bass, Drums, Guitar, Synth..."
                    : "Describe your custom loop category..."
                }
              />
              <p className="text-xs font-normal text-gray-400 mt-1">
                {formData.loop_category === 'stem' 
                  ? "Specify which instrument or element this stem contains"
                  : "Help others understand what type of loop this is"
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* BPM and Key - Hide for EPs and Video Clips */}
      {formData.content_type !== 'ep' && formData.content_type !== 'video_clip' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-normal text-gray-300 mb-2">
              BPM {(formData.content_type === 'loop' || formData.content_type === 'loop_pack') ? '' : <span className="text-gray-500">(optional)</span>}
            </label>
            <input
              type="number"
              value={formData.bpm || ''}
              onChange={(e) => handleInputChange('bpm', parseFloat(e.target.value) || 0)}
              className="input-field"
              placeholder={
                formData.content_type === 'loop_pack' ? "Same BPM for all loops" :
                formData.content_type === 'loop' ? "Required for loops" : "Optional"
              }
              min="60"
              max="200"
              step="0.1"
            />
            {bpmDetection && bpmDetection.detected && (
              <p className="text-xs text-[#81E4F2] mt-1">
                Auto-detected: {bpmDetection.bpm} BPM ({bpmDetection.confidence} confidence)
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-normal text-gray-300 mb-2">Key <span className="text-gray-500">(optional)</span></label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => handleInputChange('key', e.target.value)}
              className="input-field"
              placeholder="optional"
            />
          </div>
        </div>
      )}

      {/* Description - Only show for songs and loops, not loop packs */}
      {formData.content_type !== 'loop_pack' && (
        <div>
          <label className="block text-sm font-normal text-gray-300 mb-2">Description <span className="text-gray-500">(optional)</span></label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="textarea-field"
            placeholder={
              formData.content_type === 'loop_pack' ? 'Describe your pack...' :
              formData.content_type === 'ep' ? 'Describe your EP...' :
              formData.content_type === 'loop' ? 'Describe your loop...' :
              formData.content_type === 'full_song' ? 'Describe your song...' :
              formData.content_type === 'video_clip' ? 'Describe your clip...' : 'Describe your track...'
            }
            rows={3}
          />
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="block text-sm font-normal text-gray-300 mb-2">Tags <span className="text-gray-500">(optional, but helps others find you)</span></label>
        <input
          type="text"
          value={tagInputValue}
          onChange={(e) => handleTagsChange(e.target.value)}
          className="input-field"
          placeholder="Enter tags separated by commas"
        />
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.filter(tag => !tag.startsWith('🌍')).map((tag, index) => (
              <span key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700 text-gray-300 rounded-md text-sm">
                {tag}
                <button
                  type="button"
                  onClick={() => {
                    const newTags = formData.tags.filter(t => t !== tag);
                    handleInputChange('tags', newTags);
                    // Also update the tag input value
                    setTagInputValue(newTags.filter(t => !t.startsWith('🌍')).join(', '));
                  }}
                  className="ml-1 hover:text-red-400 transition-colors text-gray-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Location Input with Autocomplete and Tags */}
      <div className="space-y-2">
        <label className="block text-sm font-normal text-gray-300 mb-2">
          Location(s) 🌍 <span 
            className="text-gray-500 truncate inline-block max-w-[200px]" 
            title="(optional, but needed for globe placement - your creative home)"
          >
            (optional, but needed for globe placement - your creative home)
          </span>
        </label>
        
        {/* Selected locations as tags */}
        {selectedLocations.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedLocations.map((location, index) => (
              <span 
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 border border-[#81E4F2] rounded-full text-sm text-white"
              >
                <span>📍 {location}</span>
                <button
                  type="button"
                  onClick={() => {
                    const locationToRemove = selectedLocations[index];
                    setSelectedLocations(prev => prev.filter((_, i) => i !== index));
                    setSelectedLocationCoords(prev => prev.filter((_, i) => i !== index)); // Also remove coordinates
                    // Also remove from formData.tags if it exists as a location tag
                    const newTags = formData.tags.filter(tag => !tag.includes(locationToRemove));
                    handleInputChange('tags', newTags);
                  }}
                  className="ml-1 hover:text-red-400 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        
        {/* Input field */}
        <div className="relative">
          <input
            ref={locationInputRef}
            type="text"
            placeholder={selectedLocations.length > 0 ? "Add another location..." : "Start typing any location..."}
            value={locationInput}
            onChange={(e) => {
              const value = e.target.value;
              setLocationInput(value);
              handleLocationSearch(value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && locationInput.trim()) {
                e.preventDefault();
                // Add current input as a location
                if (!selectedLocations.includes(locationInput.trim())) {
                  setSelectedLocations(prev => [...prev, locationInput.trim()]);
                  setLocationInput('');
                  clearSuggestions();
                }
              }
            }}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowLocationDropdown(true);
              }
            }}
            className="input-field"
          />
          
          {/* Loading indicator */}
          {isLoadingLocations && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#81E4F2]"></div>
            </div>
          )}
          
          {/* Autocomplete dropdown */}
          {showLocationDropdown && suggestions.length > 0 && (
            <div 
              id="location-dropdown"
              className="absolute z-50 w-full mt-1 border rounded-md shadow-lg max-h-60 overflow-auto"
              style={{
                background: 'rgba(0, 0, 0, 0.9)',
                backdropFilter: 'blur(8px)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '10px'
              }}
            >
              {suggestions.map((suggestion: any) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-b-0"
                  onClick={(e) => {
                    e.preventDefault(); // Prevent default button behavior
                    e.stopPropagation(); // Stop event bubbling
                    
                    try {
                      // Add to selected locations with EXACT coordinates from autocomplete
                      const locationName = suggestion.place_name || suggestion.text; // Use full place_name for context
                      const [lng, lat] = suggestion.center; // Extract exact coordinates from selection
                      
                      console.log('Adding location with coordinates:', locationName, lat, lng);
                      console.log('Current selectedLocations before add:', selectedLocations);
                      
                      if (!selectedLocations.includes(locationName)) {
                        setSelectedLocations(prev => [...prev, locationName]);
                        // Also store the exact coordinates to avoid re-geocoding
                        setSelectedLocationCoords(prev => [...prev, {
                          lat: lat,
                          lng: lng, 
                          name: locationName
                        }]);
                        console.log('✅ Saved EXACT coordinates from autocomplete:', { lat, lng, name: locationName });
                      }
                      
                      setLocationInput('');
                      setShowLocationDropdown(false);
                      clearSuggestions();
                      
                      // Keep focus on input for adding more
                      requestAnimationFrame(() => {
                        locationInputRef.current?.focus();
                      });
                    } catch (error) {
                      console.error('Error adding location:', error);
                      // Keep modal open on error
                      e.stopPropagation();
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-white font-medium">{suggestion.text}</div>
                      <div className="text-gray-400 text-sm text-xs">{suggestion.place_name}</div>
                    </div>
                    {/* Show place type icon */}
                    <div className="text-2xl">
                      {suggestion.place_type[0] === 'country' && '🌍'}
                      {suggestion.place_type[0] === 'place' && '🏙️'}
                      {suggestion.place_type[0] === 'locality' && '📍'}
                      {suggestion.place_type[0] === 'neighborhood' && '🏘️'}
                      {suggestion.place_type[0] === 'address' && '🏠'}
                      {suggestion.place_type[0] === 'territory' && '🏔️'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {locationError && (
          <p className="text-xs text-red-400 mt-2">
            {locationError}
          </p>
        )}
      </div>

      {/* Notes field */}
      <div>
        <label className="block text-sm font-normal text-gray-300 mb-2">
          Notes <span className="text-gray-500">(optional)</span>
        </label>
        <textarea
          value={(formData as any).notes || ''}
          onChange={(e) => handleInputChange('notes' as any, e.target.value)}
          className="textarea-field"
          placeholder={formData.content_type === 'video_clip'
            ? "Credits, story behind the clip, collaborators, inspiration..."
            : "Credits, lyrics, story behind the track, collaborators..."}
          rows={5}
        />
      </div>

      {/* AI Assistance - Different UI for music vs video clips */}
      <div>
        <label className="block text-sm font-normal text-gray-300 mb-3">Creation Method</label>

        {/* For music content types - 100% Human only */}
        {(formData.content_type === 'loop' || formData.content_type === 'loop_pack' ||
          formData.content_type === 'full_song' || formData.content_type === 'ep') && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-white font-medium">🙌 100% Human</span>
              <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded">Required</span>
            </div>
            <p className="text-xs text-gray-400">
              We only accept 100% human-created music at this time. Cover images can be AI-assisted or AI-generated.
            </p>
          </div>
        )}

        {/* For video clips - Show all three options */}
        {formData.content_type === 'video_clip' && (
          <div className="flex gap-4">
            {/* 100% Human */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="ai_assistance"
                checked={!formData.ai_assisted_idea && !formData.ai_assisted_implementation}
                onChange={() => {
                  handleInputChange('ai_assisted_idea', false);
                  handleInputChange('ai_assisted_implementation', false);
                }}
                className="w-4 h-4 text-[#2792F5] focus:ring-[#2792F5] focus:ring-offset-slate-900"
              />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                🙌 100% Human
              </span>
            </label>

            {/* AI-Assisted */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="ai_assistance"
                checked={(formData.ai_assisted_idea || formData.ai_assisted_implementation) &&
                         !(formData.ai_assisted_idea && formData.ai_assisted_implementation)}
                onChange={() => {
                  handleInputChange('ai_assisted_idea', true);
                  handleInputChange('ai_assisted_implementation', false);
                }}
                className="w-4 h-4 text-[#2792F5] focus:ring-[#2792F5] focus:ring-offset-slate-900"
              />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                🙌🤖 AI-Assisted
              </span>
            </label>

            {/* AI-Generated */}
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="ai_assistance"
                checked={formData.ai_assisted_idea && formData.ai_assisted_implementation}
                onChange={() => {
                  handleInputChange('ai_assisted_idea', true);
                  handleInputChange('ai_assisted_implementation', true);
                }}
                className="w-4 h-4 text-[#2792F5] focus:ring-[#2792F5] focus:ring-offset-slate-900"
              />
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                🤖 AI-Generated
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Audio IP Policy for Video Clips */}
      {formData.content_type === 'video_clip' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mt-4">
          <p className="text-sm text-gray-300 leading-relaxed">
            <span className="font-semibold text-white">Audio IP Policy:</span> Audio included in video clips inherits the video's IP attribution.
            Audio must be 100% human-created (original recording, licensed sample, or public domain).
            No AI-generated music allowed.
          </p>
        </div>
      )}

    </div>
  );

  const renderFileUploads = () => (
    <div className="space-y-6">
      {/* Cover Image - Simplified direct upload - Hide for video clips since we auto-generate thumbnails */}
      {formData.content_type !== 'video_clip' && (
        <div>
          <label className="block text-lg font-semibold text-gray-200 mb-3">
            {formData.content_type === 'loop_pack' ? 'Pack Cover Artwork' : 'Cover Artwork'}
            <span className="text-gray-500 text-sm font-normal"> (optional)</span>
          </label>

          <TrackCoverUploader
            walletAddress={formData.wallet_address || ''} // Alpha wallet address for RLS
            onImageChange={(url) => handleInputChange('cover_image_url', url)}
            initialImage={formData.cover_image_url}
          />
        </div>
      )}

      {/* Video/Audio Upload - Conditional based on content type */}
      <div>
        <label className="block text-lg font-semibold text-gray-200 mb-3">
          {formData.content_type === 'video_clip' ? 'Video File' :
           formData.content_type === 'loop_pack' ? 'Upload Your Loops' :
           formData.content_type === 'ep' ? 'Upload Your Songs' : 'Audio File'}
        </label>
          <div>
            {/* Video Upload UI for video_clip content type */}
            {formData.content_type === 'video_clip' ? (
              <>
                {!videoFile && !(formData as any).video_url ? (
                  <div
                    {...getVideoRootProps()}
                    className={`
                      relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
                      ${isVideoDragActive
                        ? 'border-[#2792F5] bg-[#2792F5]/10'
                        : 'border-slate-600 hover:border-slate-500 bg-slate-800/20'
                      }
                      ${isVideoUploading ? 'opacity-50' : ''}
                    `}
                  >
                    <input {...getVideoInputProps()} />

                    {isVideoDragActive ? (
                      <div className="text-[#2792F5]">
                        <div className="text-2xl mb-2">🎥</div>
                        <div className="text-sm font-normal">Drop video file here!</div>
                      </div>
                    ) : (
                      <>
                        <div className="text-2xl mb-4">🎥</div>
                        <div className="text-sm font-normal text-gray-300 mb-2">
                          {isVideoUploading ? 'Uploading video...' : 'Click or drag to upload video file'}
                        </div>
                        <div className="text-xs font-normal text-gray-400">
                          Supports MP4, MOV, WebM (max 10MB, 5 seconds max)
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">🎥</div>
                        <div>
                          <div className="text-white font-medium">
                            {videoFile?.name || 'Video file uploaded'}
                          </div>
                          {videoFile && (
                            <div className="text-xs font-normal text-gray-400">
                              {(videoFile.size / (1024 * 1024)).toFixed(1)}MB
                              {videoDuration && ` • ${videoDuration.toFixed(1)}s`}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleInputChange('video_url', '');
                          setVideoFile(null);
                          setVideoPreviewUrl(null);
                          setVideoDuration(null);
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )}

                {/* Video preview with cropper */}
                {videoPreviewUrl && (
                  <div>
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
                      {videoDuration && (
                        <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white z-10">
                          {videoDuration.toFixed(1)}s
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-400 bg-[#2792F5]/10 border border-[#2792F5]/30 rounded-lg p-3">
                      📐 Drag to reposition • Scroll or pinch to zoom • Square crop will be applied
                    </div>
                  </div>
                )}

                {/* Upload Progress */}
                {isVideoUploading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Uploading video and generating thumbnail...</span>
                      <span className="text-sm text-[#2792F5]">⏳</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-[#2792F5] h-2 rounded-full animate-pulse w-full" />
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Audio Upload UI for other content types */
              <>
                {!uploadedAudioFile && !formData.audio_url ? (
                  <div
                    {...getAudioRootProps()}
                className={`
                  relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
                  ${isAudioDragActive 
                    ? 'border-[#81E4F2] bg-[#81E4F2]/10' 
                    : 'border-slate-600 hover:border-slate-500 bg-slate-800/20'
                  }
                  ${isAudioUploading ? 'opacity-50' : ''}
                `}
              >
                <input {...getAudioInputProps()} />
                
                {/* Show drag state or normal upload UI */}
                {isAudioDragActive ? (
                  <div className="text-[#81E4F2]">
                    <Music size={32} className="mx-auto mb-2" />
                    <div className="text-sm font-normal">Drop audio files here!</div>
                  </div>
                ) : (
                  <>
                    {formData.content_type === 'loop_pack' ? (
                      <>
                        <div className="text-2xl mb-4">🎵</div>
                        <div className="text-sm font-normal text-gray-300 mb-2">
                          {isAudioUploading ? 'Uploading loops...' : 'Click or drag your loop files here'}
                        </div>
                        <div className="text-xs font-normal text-gray-400">
                          Select 2-5 audio files (MP3, WAV, FLAC, M4A, OGG) - max 10MB each
                        </div>
                      </>
                    ) : formData.content_type === 'ep' ? (
                      <>
                        <div className="text-2xl mb-4">🎤</div>
                        <div className="text-sm font-normal text-gray-300 mb-2">
                          {isAudioUploading ? 'Uploading songs...' : 'Click or drag your EP songs here'}
                        </div>
                        <div className="text-xs font-normal text-gray-400">
                          Select 2-5 complete songs (MP3, WAV, FLAC, M4A, OGG) - max 50MB each
                        </div>
                      </>
                    ) : (
                      <>
                        <Music size={24} className="mx-auto mb-4 text-gray-400" />
                        <div className="text-sm font-normal text-gray-300 mb-2">
                          {isAudioUploading ? 'Uploading...' : 'Click or drag to upload audio file'}
                        </div>
                        <div className="text-xs font-normal text-gray-400">
                          Supports MP3, WAV, FLAC, M4A, OGG (max 50MB)
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="bg-slate-800 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">🎵</div>
                    <div>
                      <div className="text-white font-medium">
                        {uploadedAudioFile?.name || 'Audio file uploaded'}
                      </div>
                      {uploadedAudioFile && (
                        <div className="text-xs font-normal text-gray-400">
                          {(uploadedAudioFile.size / (1024 * 1024)).toFixed(1)}MB
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleInputChange('audio_url', '');
                      resetAudioUpload();
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

        {/* Upload Progress */}
        {isAudioUploading && audioUploadProgress.stage !== 'idle' && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">{audioUploadProgress.message}</span>
              <span className="text-sm text-[#81E4F2]">{audioUploadProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-[#81E4F2] h-2 rounded-full transition-all duration-300"
                style={{ width: `${audioUploadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Loop Pack Files Success - Show when files are selected */}
        {formData.content_type === 'loop_pack' && (formData as any).loop_files && (formData as any).loop_files.length > 0 && (
          <div className="mt-4 bg-green-900/20 border border-green-500 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">🎵</div>
              <div>
                <div className="text-green-300 font-medium">✅ {(formData as any).loop_files.length} loops selected!</div>
                <div className="text-green-200 text-sm">Ready to proceed with loop pack upload</div>
              </div>
            </div>
            
            {/* Show selected loop files */}
            <div className="bg-slate-800/50 rounded p-3">
              <div className="text-xs text-gray-400 mb-2">Selected Audio Files:</div>
              <div className="grid grid-cols-1 gap-1">
                {(formData as any).loop_files.map((file: File, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 bg-[#9772F4] rounded-full flex items-center justify-center text-white text-xs">
                      {index + 1}
                    </div>
                    <span className="text-gray-300">{file.name}</span>
                    <span className="text-gray-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* EP Files Success - Show when EP files are selected */}
        {formData.content_type === 'ep' && (formData as any).ep_files && (formData as any).ep_files.length > 0 && (
          <div className="mt-4 bg-green-900/20 border border-green-500 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">🎤</div>
              <div>
                <div className="text-green-300 font-medium">✅ {(formData as any).ep_files.length} songs selected!</div>
                <div className="text-green-200 text-sm">Ready to proceed with EP upload</div>
              </div>
            </div>
            
            {/* Show selected EP files */}
            <div className="bg-slate-800/50 rounded p-3">
              <div className="text-xs text-gray-400 mb-2">Selected Song Files:</div>
              <div className="grid grid-cols-1 gap-1">
                {(formData as any).ep_files.map((file: File, index: number) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 bg-[#FFE4B5] text-slate-900 rounded-full flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                    <span className="text-gray-300">{file.name}</span>
                    <span className="text-gray-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BPM Detection Status */}
        {isDetectingBPM && (
          <div className="mt-2 text-sm text-[#81E4F2]">
            🎵 Detecting BPM...
          </div>
        )}
      </>
    )}
        </div>
      </div>
    </div>
  );


  const renderCompositionSplits = () => (
    <div className="space-y-4">
      <div className="mb-4">
        <h4 className="text-base font-medium text-white mb-2">
          💡 IDEA RIGHTS{formData.content_type !== 'video_clip' && ' (Composition)'}
        </h4>
        <p className="text-sm font-normal text-gray-300 mb-2">
          {formData.content_type === 'video_clip'
            ? 'Who created the concept, direction, and ideas for this video?'
            : 'Who created the melodies, lyrics, structure, vibes?'}
        </p>
      </div>

      {/* Split inputs */}
      <div className="space-y-4">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={formData[`composition_split_${num}_wallet` as keyof typeof formData] as string}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange(`composition_split_${num}_wallet` as keyof typeof formData, value);
                  
                  // Validate wallet address format (reject alpha codes)
                  if (value.trim() && !isValidStacksAddress(value) && isAlphaCode(value)) {
                    showToast('❌ Please enter a valid Stacks address (SP... or SM...), not an alpha code', 'error');
                  }
                }}
                className="input-field"
                placeholder={`Creator ${num} Stacks address (SP...)`}
              />
            </div>
            <div className="w-32">
              <input
                type="number"
                value={formData[`composition_split_${num}_percentage` as keyof typeof formData] as number}
                onChange={(e) => handleInputChange(`composition_split_${num}_percentage` as keyof typeof formData, parseFloat(e.target.value) || 0)}
                className="input-field"
                placeholder="0"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Total percentage */}
      <div className="text-right">
        <span className="text-gray-400">Total: </span>
        <span className={`font-medium ${
          Math.abs((formData.composition_split_1_percentage + formData.composition_split_2_percentage + formData.composition_split_3_percentage) - 100) < 0.01
            ? 'text-green-400'
            : 'text-red-400'
        }`}>
          {(formData.composition_split_1_percentage + formData.composition_split_2_percentage + formData.composition_split_3_percentage).toFixed(2)}%
        </span>
      </div>
    </div>
  );

  const renderProductionSplits = () => (
    <div className="space-y-4">
      <div className="mb-4">
        <h4 className="text-base font-medium text-white mb-2">
          🔧 IMPLEMENTATION RIGHTS{formData.content_type !== 'video_clip' && ' (Sound Recording)'}
        </h4>
        <p className="text-sm font-normal text-gray-300 mb-2">
          {formData.content_type === 'video_clip'
            ? 'Who filmed, edited, produced, and brought it to life?'
            : 'Who produced, performed, engineered, made it real?'}
        </p>
      </div>

      {/* Split inputs */}
      <div className="space-y-4">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={formData[`production_split_${num}_wallet` as keyof typeof formData] as string}
                onChange={(e) => {
                  const value = e.target.value;
                  handleInputChange(`production_split_${num}_wallet` as keyof typeof formData, value);
                  
                  // Validate wallet address format (reject alpha codes)
                  if (value.trim() && !isValidStacksAddress(value) && isAlphaCode(value)) {
                    showToast('❌ Please enter a valid Stacks address (SP... or SM...), not an alpha code', 'error');
                  }
                }}
                className="input-field"
                placeholder={`Creator ${num} Stacks address (SP...)`}
              />
            </div>
            <div className="w-32">
              <input
                type="number"
                value={formData[`production_split_${num}_percentage` as keyof typeof formData] as number}
                onChange={(e) => handleInputChange(`production_split_${num}_percentage` as keyof typeof formData, parseFloat(e.target.value) || 0)}
                className="input-field"
                placeholder="0"
                min="0"
                max="100"
                step="0.01"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Total percentage */}
      <div className="text-right">
        <span className="text-gray-400">Total: </span>
        <span className={`font-medium ${
          Math.abs((formData.production_split_1_percentage + formData.production_split_2_percentage + formData.production_split_3_percentage) - 100) < 0.01
            ? 'text-green-400'
            : 'text-red-400'
        }`}>
          {(formData.production_split_1_percentage + formData.production_split_2_percentage + formData.production_split_3_percentage).toFixed(2)}%
        </span>
      </div>
    </div>
  );

  const renderLicensing = () => {
    return (
      <SimplifiedLicensingStep 
        formData={formData}
        handleInputChange={handleInputChange}
      />
    );
  };

  const renderLicensingOriginal = () => {
    // Different licensing options for Songs vs Loops
    if (formData.content_type === 'full_song') {
      // Song licensing - simpler, no remix options
      return (
        <div className="space-y-6">
          {/* Song Download Option */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-1">📥</div>
              <div className="flex-1">
                <div className="text-gray-300 font-medium mb-2">DOWNLOAD ONLY</div>
                <ul className="text-gray-400 text-sm space-y-1 ml-4">
                  <li>• Personal listening</li>
                  <li>• DJ sets and live performance</li>
                  <li>• Playlist inclusion</li>
                </ul>
              </div>
            </div>
            
            {/* Download price for full songs */}
            <div className="mt-4 p-3 bg-slate-900/50 rounded">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">Download price:</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={(formData as any).download_price || 2.5}
                    onChange={(e) => {
                      handleInputChange('download_price' as any, parseFloat(e.target.value) || 0);
                      handleInputChange('price_stx', parseFloat(e.target.value) || 0);
                    }}
                    className="w-24 p-2 text-white text-sm border rounded-l"
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderColor: 'rgba(255, 255, 255, 0.08)'
                    }}
                    placeholder="2.5"
                    min="0"
                    step="0.1"
                  />
                  <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Licensing Options header */}
          <div className="mt-8">
            <h4 className="text-gray-300 font-medium mb-4">ADDITIONAL LICENSING OPTIONS</h4>
          </div>

          {/* Commercial/Sync Option for Songs */}
          <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(formData as any).open_to_commercial || false}
                onChange={(e) => handleInputChange('open_to_commercial' as any, e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded text-[#81E4F2] focus:ring-[#81E4F2]"
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-medium">Open to commercial/sync requests</span>
                  <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-300 rounded">Pro License</span>
                </div>
                <p className="text-gray-500 text-sm mt-1">Accept inquiries for ads, films, TV, games, etc.</p>
              </div>
            </label>

            {/* Commercial Contact Info */}
            {(formData as any).open_to_commercial && (
              <div className="ml-8 p-3 bg-slate-900/50 rounded">
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-300 mb-1 text-sm font-medium">Professional contact:</label>
                    <input
                      type="text"
                      value={(formData as any).commercial_contact || ''}
                      onChange={(e) => handleInputChange('commercial_contact' as any, e.target.value)}
                      className="w-full p-3 text-white text-sm border rounded"
                      style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#81E4F2'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                      placeholder="your@email.com or WhatsApp/Telegram"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">Contact fee:</span>
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={(formData as any).commercial_contact_fee || 10}
                        onChange={(e) => handleInputChange('commercial_contact_fee' as any, parseFloat(e.target.value) || 10)}
                        className="w-24 p-2 text-white text-sm border rounded-l"
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderColor: 'rgba(255, 255, 255, 0.08)'
                    }}
                        min="5"
                        step="5"
                      />
                      <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                    </div>
                  </div>
                  <p className="text-yellow-600 text-xs bg-yellow-900/20 p-2 rounded">
                    ⚡ Prevents spam: Buyers pay this fee to unlock your contact info
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Collaboration Option for Songs */}
          <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.open_to_collaboration}
                onChange={(e) => handleInputChange('open_to_collaboration', e.target.checked)}
                className="w-5 h-5 mt-0.5 rounded text-[#81E4F2] focus:ring-[#81E4F2]"
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderColor: 'rgba(255, 255, 255, 0.08)'
                }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 font-medium">Open to direct collaboration requests</span>
                  <span className="text-xs px-2 py-0.5 bg-cyan-900/50 text-cyan-300 rounded">Community</span>
                </div>
                <p className="text-gray-500 text-sm mt-1">Accept collaboration proposals from other creators</p>
              </div>
            </label>

            {/* Collaboration Contact Info */}
            {formData.open_to_collaboration && (
              <div className="ml-8 p-3 bg-slate-900/50 rounded">
                <div className="space-y-3">
                  <div>
                    <label className="block text-gray-300 mb-1 text-sm font-medium">Collaboration contact:</label>
                    <input
                      type="text"
                      value={(formData as any).collab_contact || ''}
                      onChange={(e) => handleInputChange('collab_contact' as any, e.target.value)}
                      className="w-full p-3 text-white text-sm border rounded"
                      style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#81E4F2'}
                      onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                      placeholder="your@email.com or Discord/Telegram"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm">Contact fee:</span>
                    <div className="flex items-center">
                      <input
                        type="number"
                        value={(formData as any).collab_contact_fee || 1}
                        onChange={(e) => handleInputChange('collab_contact_fee' as any, parseFloat(e.target.value) || 1)}
                        className="w-24 p-2 text-white text-sm border rounded-l"
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderColor: 'rgba(255, 255, 255, 0.08)'
                    }}
                        min="0"
                        step="0.5"
                      />
                      <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                    </div>
                  </div>
                  <p className="text-cyan-600 text-xs bg-cyan-900/20 p-2 rounded">
                    💡 Keep it low to encourage collaborations (1 STX recommended)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Loop licensing - existing radio button choice
    return (
      <div className="space-y-6">
        {/* License Type Selection - Radio Buttons */}
        <div className="space-y-4">
        
        {/* Remix Only */}
        <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="license_type"
              value="platform_remix"
              checked={(formData as any).license_selection === 'platform_remix'}
              onChange={() => {
                handleInputChange('license_selection' as any, 'platform_remix');
                handleInputChange('allow_remixing', true);
                handleInputChange('allow_downloads', false);
                if (!(formData as any).remix_price) {
                  handleInputChange('remix_price' as any, 0.5);
                }
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] focus:ring-[#81E4F2]"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.08)'
              }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-medium">REMIX ONLY</span>
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Most Common</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">Others can remix within mixmi platform only</p>
              <p className="text-gray-600 text-xs mt-1">Perfect for: Building on-platform community</p>
            </div>
          </label>
          
          {/* Price input appears when selected */}
          {(formData as any).license_selection === 'platform_remix' && (
            <div className="ml-8 p-3 bg-slate-900/50 rounded">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">Remix price:</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={(formData as any).remix_price || 0.5}
                    onChange={(e) => handleInputChange('remix_price' as any, parseFloat(e.target.value) || 0)}
                    className="w-24 p-2 text-white text-sm border rounded-l"
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderColor: 'rgba(255, 255, 255, 0.08)'
                    }}
                    placeholder="0.5"
                    min="0"
                    step="0.1"
                  />
                  <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                </div>
                <span className="text-gray-500 text-xs">(Set to 0 for free)</span>
              </div>
            </div>
          )}
        </div>

        {/* Remix + Download */}
        <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="license_type"
              value="platform_download"
              checked={(formData as any).license_selection === 'platform_download'}
              onChange={() => {
                handleInputChange('license_selection' as any, 'platform_download');
                handleInputChange('allow_remixing', true);
                handleInputChange('allow_downloads', true);
                if (!(formData as any).combined_price) {
                  handleInputChange('combined_price' as any, 2.5);
                }
              }}
              className="w-5 h-5 mt-0.5 text-[#81E4F2] focus:ring-[#81E4F2]"
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderColor: 'rgba(255, 255, 255, 0.08)'
              }}
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-medium">REMIX + DOWNLOAD</span>
                <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded">Creator Choice</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">Includes remix rights AND download for external use</p>
              <p className="text-gray-600 text-xs mt-1">Perfect for: Sample packs, loops, stems</p>
            </div>
          </label>
          
          {/* Combined price input appears when selected */}
          {(formData as any).license_selection === 'platform_download' && (
            <div className="ml-8 p-3 bg-slate-900/50 rounded">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">Combined price:</span>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={(formData as any).combined_price || 2.5}
                    onChange={(e) => handleInputChange('combined_price' as any, parseFloat(e.target.value) || 0)}
                    className="w-24 p-2 text-white text-sm border rounded-l"
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderColor: 'rgba(255, 255, 255, 0.08)'
                    }}
                    placeholder="2.5"
                    min="0"
                    step="0.1"
                  />
                  <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                </div>
                <span className="text-gray-500 text-xs">(Typically 5x remix-only price)</span>
              </div>
              <div className="mt-2 p-2 bg-blue-900/20 rounded">
                <p className="text-blue-300 text-xs">
                  ✨ Buyers get: Platform remix rights + Download for DAW use + All certificates
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Separate Contact Options */}
      <div className="space-y-4 mt-8">
        <h4 className="text-gray-300 font-medium">Additional Options</h4>
        
        {/* Commercial/Sync */}
        <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={(formData as any).open_to_commercial || false}
              onChange={(e) => handleInputChange('open_to_commercial' as any, e.target.checked)}
              className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-[#81E4F2] focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-medium">Open to commercial/sync requests</span>
                <span className="text-xs px-2 py-0.5 bg-green-900/50 text-green-300 rounded">Pro License</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">Accept inquiries for ads, films, TV, games</p>
            </div>
          </label>

          {/* Commercial Contact Info */}
          {(formData as any).open_to_commercial && (
            <div className="ml-8 p-3 bg-slate-900/50 rounded">
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-medium">Professional contact:</label>
                  <input
                    type="text"
                    value={(formData as any).commercial_contact || ''}
                    onChange={(e) => handleInputChange('commercial_contact' as any, e.target.value)}
                    className="input-field text-sm"
                    placeholder="your@email.com or WhatsApp/Telegram"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">Contact fee:</span>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={(formData as any).commercial_contact_fee || 10}
                      onChange={(e) => handleInputChange('commercial_contact_fee' as any, parseFloat(e.target.value) || 10)}
                      className="w-24 p-2 text-white text-sm border rounded-l"
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderColor: 'rgba(255, 255, 255, 0.08)'
                    }}
                      min="5"
                      step="5"
                    />
                    <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                  </div>
                </div>
                <p className="text-yellow-600 text-xs bg-yellow-900/20 p-2 rounded">
                  ⚡ Prevents spam: Buyers pay this fee to unlock your contact info
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Collaboration */}
        <div className="space-y-3 p-4 bg-slate-800/30 rounded-lg border border-slate-700">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.open_to_collaboration}
              onChange={(e) => handleInputChange('open_to_collaboration', e.target.checked)}
              className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-[#81E4F2] focus:ring-[#81E4F2]"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-medium">Open to direct collaboration requests</span>
                <span className="text-xs px-2 py-0.5 bg-cyan-900/50 text-cyan-300 rounded">Community</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">Accept collaboration proposals from other creators</p>
            </div>
          </label>

          {/* Collaboration Contact Info */}
          {formData.open_to_collaboration && (
            <div className="ml-8 p-3 bg-slate-900/50 rounded">
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-300 mb-1 text-sm font-medium">Collaboration contact:</label>
                  <input
                    type="text"
                    value={(formData as any).collab_contact || ''}
                    onChange={(e) => handleInputChange('collab_contact' as any, e.target.value)}
                    className="input-field text-sm"
                    placeholder="your@email.com or Discord/Telegram"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">Contact fee:</span>
                  <div className="flex items-center">
                    <input
                      type="number"
                      value={(formData as any).collab_contact_fee || 1}
                      onChange={(e) => handleInputChange('collab_contact_fee' as any, parseFloat(e.target.value) || 1)}
                      className="w-24 p-2 text-white text-sm border rounded-l"
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      borderColor: 'rgba(255, 255, 255, 0.08)'
                    }}
                      min="0"
                      step="0.5"
                    />
                    <span className="p-2 bg-slate-700 border border-slate-600 border-l-0 rounded-r text-gray-400 text-sm">STX</span>
                  </div>
                </div>
                <p className="text-cyan-600 text-xs bg-cyan-900/20 p-2 rounded">
                  💡 Keep it low to encourage collaborations (1 STX recommended)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Privacy Notice */}
      <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-800/50">
        <p className="text-blue-300 text-sm">
          <strong>Privacy Protection:</strong> Your contact info is private until someone pays the request fee. This prevents spam and ensures only serious inquiries reach you.
        </p>
      </div>
    </div>
  );
  };

  const renderConnectRelease = () => (
    <div className="space-y-6">
      {/* ISRC Code */}
      <div>
        <label className="block text-sm font-normal text-gray-300 mb-2">ISRC Code <span className="text-gray-500">(optional)</span></label>
        <input
          type="text"
          value={formData.isrc}
          onChange={(e) => handleInputChange('isrc', e.target.value)}
          className="input-field"
          placeholder="e.g., USRC17607839"
        />
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <div className="bg-slate-800 p-6 rounded-lg">
        <h4 className="text-white font-medium mb-4">
          Review Your {formData.content_type === 'full_song' ? 'Song' :
                      formData.content_type === 'loop' ? '8-Bar Loop' :
                      formData.content_type === 'ep' ? 'EP' :
                      formData.content_type === 'video_clip' ? 'Video Clip' : 'Loop Pack'}
        </h4>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">
              {formData.content_type === 'loop_pack' ? 'Pack Title:' : 
               formData.content_type === 'ep' ? 'EP Title:' : 'Title:'}
            </span>
            <span className="text-white">
              {formData.content_type === 'loop_pack'
                ? ((formData as any).pack_title || '-')
                : formData.content_type === 'ep'
                ? ((formData as any).ep_title || formData.title || '-')
                : (formData.title || '-')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Artist:</span>
            <span className="text-white">{formData.artist || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="text-white">
              {formData.content_type === 'full_song' ? 'Song' :
               formData.content_type === 'loop' ? '8-Bar Loop' :
               formData.content_type === 'ep' ? 'EP' :
               formData.content_type === 'video_clip' ? 'Video Clip' : 'Loop Pack'}
            </span>
          </div>
          {formData.content_type === 'loop' && (
            <div className="flex justify-between">
              <span className="text-gray-400">Category:</span>
              <span className="text-white">{formData.loop_category}</span>
            </div>
          )}
          {formData.content_type === 'loop_pack' && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-400">Loops in Pack:</span>
                <span className="text-white">{(formData as any).loop_files?.length || 0} detected</span>
              </div>
              {formData.allow_downloads && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Price per Loop:</span>
                  <span className="text-white">{(formData as any).price_per_loop || 0.5} STX</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">BPM:</span>
            <span className="text-white">{formData.bpm || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">License:</span>
            <span className="text-white">
              {formData.content_type === 'full_song' || formData.content_type === 'ep'
                ? (formData.remix_protected
                    ? (formData.allow_downloads ? 'Download Only' : 'Preview Only')
                    : (formData.allow_downloads ? 'Mixer + Download' : 'Mixer Only'))
                : (formData.remix_protected
                    ? (formData.allow_downloads ? 'Download Only' : 'Preview Only')
                    : 'Platform Remix' + (formData.allow_downloads ? ' + Download' : ' Only'))}
            </span>
          </div>
          {/* Only show pricing if there's something to price */}
          {!(formData.remix_protected && !formData.allow_downloads) && (
            <div className="flex justify-between">
              <span className="text-gray-400">
                {formData.content_type === 'full_song' || formData.content_type === 'ep'
                  ? (formData.allow_downloads ? 'Download Price:' : 'Recording Fee:')
                  : formData.allow_downloads
                    ? 'Download Price:'
                    : 'Remix Fee:'}
              </span>
              <span className="text-white">
                {formData.content_type === 'full_song'
                  ? (formData.allow_downloads
                      ? `${(formData as any).download_price_stx || (formData as any).download_price || 2} STX`
                      : '1 STX per recorded remix')
                  : formData.content_type === 'ep'
                    ? `${(((formData as any).price_per_song || 2.5) * ((formData as any).ep_files?.length || (formData as any).ep_song_count || 0)).toFixed(1)} STX`
                  : formData.content_type === 'loop_pack'
                    ? `${(((formData as any).price_per_loop || 0.5) * ((formData as any).loop_files?.length || 0)).toFixed(1)} STX (pack)`
                    : formData.allow_downloads
                      ? `${(formData as any).download_price_stx || 2.5} STX`
                      : '1 STX per mix'}
              </span>
            </div>
          )}
          {/* Show remix fee separately if download is also available */}
          {(formData.content_type === 'loop' || formData.content_type === 'loop_pack') && formData.allow_downloads && (
            <div className="flex justify-between">
              <span className="text-gray-400">Remix Fee:</span>
              <span className="text-white">1 STX per mix</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">{formData.content_type === 'video_clip' ? 'Video:' : 'Audio:'}</span>
            <span className="text-white">
              {formData.content_type === 'video_clip'
                ? ((formData as any).video_url ? '✓ Uploaded' : '✗ Missing')
                : formData.content_type === 'loop_pack'
                ? ((formData as any).loop_files && (formData as any).loop_files.length > 0 ? `✓ ${(formData as any).loop_files.length} Files` : '✗ Upload Your Loops')
                : formData.content_type === 'ep'
                ? (((formData as any).ep_files && (formData as any).ep_files.length > 0) || (formData as any).ep_song_count > 0 ? `✓ ${(formData as any).ep_files?.length || (formData as any).ep_song_count} Songs` : '✗ Upload Your Songs')
                : (formData.audio_url ? '✓ Uploaded' : '✗ Missing')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Cover:</span>
            <span className="text-white">{formData.cover_image_url ? '✓ Uploaded' : '✗ Missing'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Creation:</span>
            <span className="text-white">
              {!(formData as any).ai_assisted_idea && !(formData as any).ai_assisted_implementation
                ? '🙌 100% Human'
                : (formData as any).ai_assisted_idea && (formData as any).ai_assisted_implementation
                ? '🤖 AI-Generated'
                : '🙌🤖 AI-Assisted'}
            </span>
          </div>
          {(formData as any).notes && (
            <div className="flex justify-between">
              <span className="text-gray-400">Notes:</span>
              <span className="text-white text-right" style={{ maxWidth: '60%' }}>
                {((formData as any).notes || '').substring(0, 50)}
                {((formData as any).notes || '').length > 50 ? '...' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Track List Editor for EPs and Loop Packs */}
      {(formData.content_type === 'ep' || formData.content_type === 'loop_pack') && trackMetadata.length > 0 && (
        <div className="bg-slate-800 p-6 rounded-lg">
          <h4 className="text-white font-medium mb-4">
            {formData.content_type === 'ep' ? '🎵 Songs in EP' : '🔁 Loops in Pack'} ({trackMetadata.length})
          </h4>
          <p className="text-gray-400 text-xs mb-4">
            Edit titles and {formData.content_type === 'ep' ? 'BPM ' : ''}reorder tracks before uploading.
          </p>

          <div className="space-y-2">
            {trackMetadata.map((track, index) => (
              <div key={index} className="flex items-center gap-2 bg-slate-700/50 p-2 rounded">
                {/* Position number */}
                <span className="text-gray-500 text-xs w-5 text-center">{index + 1}</span>

                {/* Reorder buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (index > 0) {
                        const newMetadata = [...trackMetadata];
                        [newMetadata[index - 1], newMetadata[index]] = [newMetadata[index], newMetadata[index - 1]];
                        setTrackMetadata(newMetadata);
                      }
                    }}
                    disabled={index === 0}
                    className={`p-0.5 rounded ${index === 0 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-slate-600'}`}
                    title="Move up"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (index < trackMetadata.length - 1) {
                        const newMetadata = [...trackMetadata];
                        [newMetadata[index], newMetadata[index + 1]] = [newMetadata[index + 1], newMetadata[index]];
                        setTrackMetadata(newMetadata);
                      }
                    }}
                    disabled={index === trackMetadata.length - 1}
                    className={`p-0.5 rounded ${index === trackMetadata.length - 1 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-white hover:bg-slate-600'}`}
                    title="Move down"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Title input */}
                <input
                  type="text"
                  value={track.title}
                  onChange={(e) => {
                    const newMetadata = [...trackMetadata];
                    newMetadata[index].title = e.target.value;
                    setTrackMetadata(newMetadata);
                  }}
                  className="flex-1 bg-slate-600 text-white text-sm px-2 py-1 rounded border border-slate-500 focus:border-[#81E4F2] focus:outline-none"
                  placeholder="Track title"
                />

                {/* BPM input for EPs only */}
                {formData.content_type === 'ep' && (
                  <input
                    type="number"
                    value={track.bpm || ''}
                    onChange={(e) => {
                      const newMetadata = [...trackMetadata];
                      newMetadata[index].bpm = e.target.value ? parseInt(e.target.value) : undefined;
                      setTrackMetadata(newMetadata);
                    }}
                    className="w-16 bg-slate-600 text-white text-sm px-2 py-1 rounded border border-slate-500 focus:border-[#81E4F2] focus:outline-none text-center"
                    placeholder="BPM"
                    min="60"
                    max="200"
                  />
                )}
              </div>
            ))}
          </div>

          {formData.content_type === 'ep' && (
            <p className="text-gray-500 text-xs mt-3">
              💡 Tip: Adding BPM to songs enables 8-bar section navigation in the mixer.
            </p>
          )}
        </div>
      )}

      {/* Terms of Service */}
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-[#81E4F2] focus:ring-[#81E4F2]"
          />
          <div className="flex-1">
            <span className="text-gray-300">
              I agree to the mixmi Terms of Service and confirm I have rights to distribute this content
            </span>
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[#81E4F2] hover:text-[#81E4F2]/80 text-sm mt-1"
            >
              View Terms →
            </a>
          </div>
        </label>

        <p className="text-gray-400 text-sm text-center">
          Content registration is free.
        </p>
      </div>

      {/* Simple Success Message */}
      {saveStatus === 'complete' && (
        <div className="bg-green-600 text-white p-4 rounded-lg text-center">
          <div className="text-lg font-bold mb-2">
            ✅ {formData.content_type === 'loop_pack' ? 'Loop Pack' : 
                 formData.content_type === 'ep' ? 'EP' : 'Track'} Saved & Uploaded!
          </div>
          <div className="text-sm">
            {formData.content_type === 'loop_pack'
              ? `Your loop pack with ${(formData as any).loop_files?.length || 'multiple'} loops has been saved. Refresh the page to see it on the globe!`
              : formData.content_type === 'ep'
              ? `Your EP with ${(formData as any).ep_files?.length || (formData as any).ep_song_count || 'multiple'} songs has been saved. Refresh the page to see it on the globe!`
              : 'Your track has been saved. Refresh the page to see it on the globe!'
            }
          </div>
        </div>
      )}
    </div>
  );

  // Main render function for steps
  // 🎯 Render Authentication Step (step -1)
  const renderAuthentication = () => {
    
    const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputWallet.trim()) return;
      
      const success = await handleAlphaAuthentication(inputWallet);
      if (success) {
        setCurrentStep(0); // Move to first real step
      }
    };

    return (
      <div className="space-y-6" style={{ gap: '24px' }}>
        {/* Compact Header */}
        <div className="text-center mb-5">
          {/* Lock Emoji Icon */}
          <div 
            className="inline-flex items-center justify-center mb-4"
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, rgba(129, 228, 242, 0.15) 0%, rgba(129, 228, 242, 0.05) 100%)',
              borderRadius: '14px',
              fontSize: '24px'
            }}
          >
            🔐
          </div>
          
          {/* Upload Your Music Title */}
          <h2 
            className="auth-title"
            style={{
              fontSize: '26px',
              fontWeight: '600',
              letterSpacing: '-0.5px',
              marginBottom: '8px',
              background: 'linear-gradient(135deg, #e1e5f0 0%, #a8b2c3 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Upload Your Music
          </h2>
          
          <p
            style={{
              fontSize: '15px',
              color: '#a0a0a0',
              lineHeight: '1.4'
            }}
          >
            {globalWalletConnected
              ? '🎫 Wallet not approved. Enter alpha invite code'
              : '🎫 Enter your alpha invite code or connect wallet'}
          </p>
        </div>
        
        {/* Divider Line */}
        <div 
          style={{
            width: '100%',
            height: '1px',
            background: 'rgba(255, 255, 255, 0.08)',
            margin: '24px 0'
          }}
        ></div>
        
        {/* Streamlined Body */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div>
            
            {/* Dark Container Box */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '18px',
                marginBottom: '24px'
              }}
            >
              <label 
                className="block mb-2" 
                style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: '#8b92a6',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                ALPHA ACCESS CODE
              </label>
              <input
                type="text"
                value={inputWallet}
                onChange={(e) => setInputWallet(e.target.value)}
                placeholder="Example: mixmi-ABC123 or SP1N0105..."
                disabled={isAuthenticating}
                required
                style={{
                  width: '100%',
                  padding: '13px 14px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontFamily: 'Monaco, Menlo, monospace',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.target.style.background = 'rgba(0, 0, 0, 0.25)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.target.style.background = 'rgba(0, 0, 0, 0.4)';
                }}
              />
              <style jsx>{`
                input::placeholder {
                  color: #4a5264 !important;
                  opacity: 1;
                }
              `}</style>
            </div>
          </div>
          
          <div className="pt-2">
            <button
              type="submit"
              disabled={isAuthenticating || !inputWallet.trim()}
              className="w-full px-5 py-3.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gray-200 text-[#0a0e1a] hover:bg-gray-300"
              onMouseEnter={(e) => {
                if (!isAuthenticating && inputWallet.trim()) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 20px rgba(129, 228, 242, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              {isAuthenticating ? 'Verifying...' : 'Verify Alpha Access'}
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderStep = () => {
    // Check if user is authenticated (via wallet or invite code)
    if (!isAuthenticated) {
      return (
        <div className="text-center py-12">
          <div className="mb-6">
            <div
              className="inline-flex items-center justify-center mb-4"
              style={{
                width: '56px',
                height: '56px',
                background: 'linear-gradient(135deg, rgba(129, 228, 242, 0.15) 0%, rgba(129, 228, 242, 0.05) 100%)',
                borderRadius: '14px',
                fontSize: '24px'
              }}
            >
              🔐
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Hey! You'll need to sign in first</h3>
            <p className="text-gray-400 max-w-md mx-auto mb-4">
              To upload your music, just click the <span className="text-white font-medium">Sign In</span> button at the top of the page.
            </p>
            <p className="text-gray-400 max-w-md mx-auto text-sm">
              You can sign in with your Stacks wallet or alpha invite code.
            </p>
            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-gray-500 text-sm mb-2">Need an invite code?</p>
              <a
                href="mailto:mixmialpha@gmail.com?subject=mixmi%20Alpha%20Access%20Request&body=Hi%2C%0A%0AI'd%20like%20to%20request%20early%20alpha%20access%20to%20mixmi.%0A%0AThank%20you!"
                className="text-[#81E4F2] hover:text-[#6BC4D4] font-medium text-sm transition-colors"
              >
                Email us for alpha access →
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-3 text-gray-300 font-medium rounded-lg border border-white/40 hover:border-[#81E4F2] hover:shadow-[0_0_12px_rgba(129,228,242,0.3)] transition-all hover:bg-white/5"
            style={{ backgroundColor: '#061F3C' }}
          >
            Close
          </button>
        </div>
      );
    }

    if (isQuickUpload) {
      // Quick upload steps
      switch (currentStep) {
        case 0:
          return renderBasicInfo();
        case 1:
          return renderFileUploads();
        case 2:
          return renderLicensing();
        case 3:
          return renderReview();
        default:
          return null;
      }
    } else {
      // Advanced steps
      switch (currentStep) {
        case 0:
          return renderBasicInfo();
        case 1:
          return renderCompositionSplits();
        case 2:
          return renderProductionSplits();
        case 3:
          return renderConnectRelease();
        case 4:
          return renderFileUploads();
        case 5:
          return renderLicensing();
        case 6:
          return renderReview();
        default:
          return null;
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="lg"
    >
      <div className="space-y-6">
        {/* Mode Toggle - Show for both new and existing tracks after authentication */}
        {isAuthenticated && (
          <div>
            <div className="flex justify-center mb-2">
              <div className="inline-flex p-1 rounded-xl" style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                maxWidth: '400px'
              }}>
                <button
                  type="button"
                  onClick={() => handleModeToggle(true)}
                  className="flex items-center px-3 py-1 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: isQuickUpload ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: isQuickUpload ? 'white' : '#8b92a6'
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quick Upload
                </button>
                <button
                  type="button"
                  onClick={() => handleModeToggle(false)}
                  className="flex items-center px-3 py-1 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: !isQuickUpload ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                    color: !isQuickUpload ? 'white' : '#8b92a6'
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Advanced Options
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Banner - show for both Quick Upload and Advanced Options */}
        {!track && currentStep === 0 && isAuthenticated && (
          <div className="text-center mb-4">
            <div 
              className="p-3 rounded-lg border"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(255, 255, 255, 0.02) 100%)',
                borderColor: 'rgba(255, 255, 255, 0.08)',
                color: '#8b92a6'
              }}
            >
              <p className="text-sm">
                {isQuickUpload ? "⚡ Smart defaults for solo creators" : "⚙️ Manage splits for multiple creators"}
              </p>
            </div>
          </div>
        )}

        {/* Step Indicator - Hide during authentication */}
        {isAuthenticated && (
          <div className="flex items-center justify-between">
            {getStepsArray.map((step, index) => (
            <div
              key={index}
              className={`flex items-center ${index < getStepsArray.length - 1 ? 'flex-1' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index === currentStep
                    ? 'bg-[#81E4F2] text-slate-900'
                    : index < currentStep
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-700 text-gray-400'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < getStepsArray.length - 1 && (
                <div className={`flex-1 h-px mx-2 ${index < currentStep ? 'bg-green-600' : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
          </div>
        )}

        {/* Only show step title when authenticated */}
        {isAuthenticated && (
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-white">
              {getStepsArray[currentStep]}
            </h3>
            {currentStep === 0 && (
              <p className="text-xs font-normal text-gray-400 mt-1">
                {isQuickUpload 
                  ? "Essential info with smart defaults applied automatically"
                  : "Tell us about your music and who made it"
                }
              </p>
            )}
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors && validationErrors.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 mb-4">
            <div className="flex items-center mb-2">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.348 15.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <h4 className="text-red-400 font-medium">Please fix these issues:</h4>
            </div>
            <ul className="text-red-300 text-sm space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-red-400 mr-2">•</span>
                  {error || 'Unknown validation error'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Step Content */}
        <div>
          {renderStep()}
        </div>

        {/* Navigation - Hide during authentication */}
        {isAuthenticated && (
          <div className="flex justify-center pt-8 border-t border-slate-700">
          <div className="flex gap-6">
            <button
              onClick={currentStep === 0 ? onClose : prevStep}
              disabled={false}
              className="px-4 py-1.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#8b92a6'
              }}
              onMouseEnter={(e) => {
                if (!e.target.disabled) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.target.style.color = 'white';
                }
              }}
              onMouseLeave={(e) => {
                if (!e.target.disabled) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.target.style.color = '#8b92a6';
                }
              }}
            >
              {currentStep === 0 ? 'Cancel' : 'Previous'}
            </button>

            {currentStep === getStepsArray.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={isSaving || !termsAccepted}
                className="px-4 py-1.5 rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 bg-gray-200 text-[#0a0e1a] hover:bg-gray-300"
                title={!termsAccepted ? 'Please accept the terms of service' : ''}
              >
                {isSaving ? 'Saving...' : (track ? 'Update Track' : 
                  formData.content_type === 'loop_pack' ? 'Create Pack' : 'Create Track')}
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="px-4 py-1.5 rounded-lg font-semibold transition-all bg-gray-200 text-[#0a0e1a] hover:bg-gray-300"
              >
                Next
              </button>
            )}
          </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
