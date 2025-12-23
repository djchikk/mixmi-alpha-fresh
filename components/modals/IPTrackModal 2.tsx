"use client";

import React, { useEffect, useState, useRef } from "react";
import Modal from "../ui/Modal";
import ImageUploader from "../shared/ImageUploader";
import { IPTrack, SAMPLE_TYPES, CONTENT_TYPES, LOOP_CATEGORIES, ContentType, LoopCategory } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import SplitPresetManagerUI from "./SplitPresetManager";
import { parseLocationsAndGetCoordinates } from "@/lib/locationLookup";

// Import custom hooks
import { useIPTrackForm } from "@/hooks/useIPTrackForm";
import { useAudioUpload } from "@/hooks/useAudioUpload";
import { useIPTrackSubmit } from "@/hooks/useIPTrackSubmit";
import { useSplitPresets } from "@/hooks/useSplitPresets";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";
import ArtistAutosuggest from "../shared/ArtistAutosuggest";

interface IPTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  track?: IPTrack;
  onSave?: (track: IPTrack) => void;
}

export default function IPTrackModal({
  isOpen,
  onClose,
  track,
  onSave,
}: IPTrackModalProps) {
  const { walletAddress } = useAuth();
  
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
  } = useIPTrackForm({ track, walletAddress });
  
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
    walletAddress,
    contentType: formData.content_type,
    currentBPM: formData.bpm,
    onBPMDetected: (bpm) => {
      // Only update BPM if user hasn't manually entered one
      if (!formData.bpm || formData.bpm === 0) {
        console.log('🎵 Setting auto-detected BPM:', Math.round(bpm));
        handleInputChange('bpm', Math.round(bpm));
      } else {
        console.log('🎵 Ignoring auto-detected BPM, keeping user value:', formData.bpm);
      }
    },
    onAudioUploaded: (url) => handleInputChange('audio_url', url),
    onDurationDetected: (duration) => handleInputChange('duration', duration),
  });
  
  const {
    isSaving,
    saveStatus,
    submitTrack,
  } = useIPTrackSubmit({
    walletAddress,
    track,
    onSave,
    onSuccess: () => {
      resetForm();
      resetAudioUpload();
      onClose();
    },
  });
  
  const {
    presets,
    isLoadingPresets,
    handleSavePreset,
    handleDeletePreset,
    refreshPresets,
  } = useSplitPresets({ walletAddress });

  // Location input state
  const [locationInput, setLocationInput] = useState('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  
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
        clearSuggestions();
      } else {
        // Editing existing track - populate location if it exists
        if (track.primary_location) {
          // Parse existing locations from primary_location field
          const locations = track.primary_location.split(',').map(l => l.trim());
          setSelectedLocations(locations);
        }
      }
    } else {
      // Modal closing - cleanup
      cleanupLocationSearch();
      setShowLocationDropdown(false);
    }
    // Remove dependencies that might cause re-renders
  }, [isOpen, track?.id]); // Only depend on track.id, not the whole track object
  
  // Show dropdown when suggestions are available
  useEffect(() => {
    setShowLocationDropdown(suggestions.length > 0);
  }, [suggestions]);
  
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

  // Wrap audio file upload to handle errors
  const handleAudioFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      await handleAudioFileUploadBase(e);
    } catch (error) {
      setValidationErrors([error instanceof Error ? error.message : 'Failed to upload audio file']);
    }
  };

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
    
    // Process locations before submission
    // Join selected locations into a comma-separated string
    const locationsString = selectedLocations.join(', ');
    console.log('📍 Selected locations:', selectedLocations);
    console.log('📍 Locations string:', locationsString);
    const locationResult = parseLocationsAndGetCoordinates(locationsString);
    console.log('📍 Parsed locations:', locationResult);
    
    // Add detailed logging for location data
    console.log('🗺️ Location data being saved:', {
      selectedLocations: selectedLocations,
      locationsString: locationsString,
      rawText: locationResult.rawText,
      rawLocations: locationResult.rawLocations,
      primary: locationResult.primary,
      all: locationResult.all
    });
    
    // Add location tags with 🌍 prefix - use all location names
    const locationTags = locationResult.all.map(loc => `🌍 ${loc.name}`);
    const allTags = [...formData.tags, ...locationTags];
    
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
      locations: locationResult.all.length > 0 ? locationResult.all : null
    };
    
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
    
    // Validate required fields
    if (!updatedFormData.title || updatedFormData.title.trim() === '') {
      errors.push('Track title is required');
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
    
    // Validate that either audio URL or file is provided
    if (!updatedFormData.audio_url || updatedFormData.audio_url.trim() === '') {
      errors.push('Audio file is required');
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
    <div className="space-y-6">
      {/* Content Type Selection */}
      <div>
        <label className="block text-gray-300 mb-2">Content Type *</label>
        {/* Segmented Control for Content Type */}
        <div className="flex p-1 bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => handleInputChange('content_type', 'full_song')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
              formData.content_type === 'full_song'
                ? 'bg-accent text-slate-900'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Song
          </button>
          
          <button
            type="button"
            onClick={() => handleInputChange('content_type', 'loop')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
              formData.content_type === 'loop'
                ? 'bg-accent text-slate-900'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            8-Bar Loop
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {formData.content_type === 'full_song' 
            ? 'Complete track or remix' 
            : 'Remix-ready samples'}
        </p>
      </div>

      {/* Title and Version */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-gray-300 mb-2">Track Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
            placeholder="Track Name"
          />
        </div>
        <div>
          <label className="block text-gray-300 mb-2">Version</label>
          <input
            type="text"
            value={formData.version}
            onChange={(e) => handleInputChange('version', e.target.value)}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
            placeholder="optional"
          />
        </div>
      </div>

      {/* Artist */}
      <div>
        <label className="block text-gray-300 mb-2">Artist Name *</label>
        <ArtistAutosuggest
          value={formData.artist}
          onChange={(value) => handleInputChange('artist', value)}
          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
          placeholder="Artist or Project name"
          required={true}
        />
      </div>

      {/* Loop Category - Only show for loops */}
      {formData.content_type === 'loop' && (
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Loop Category</label>
            <select
              value={formData.loop_category}
              onChange={(e) => handleInputChange('loop_category', e.target.value)}
              className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white focus:outline-none focus:border-accent"
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
              <label className="block text-gray-300 mb-2">
                {formData.loop_category === 'stem' ? 'Stem Type' : 'Category Description'} *
              </label>
              <input
                type="text"
                value={formData.tell_us_more || ''}
                onChange={(e) => handleInputChange('tell_us_more', e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
                placeholder={
                  formData.loop_category === 'stem' 
                    ? "e.g., Vocals, Bass, Drums, Guitar, Synth..."
                    : "Describe your custom loop category..."
                }
              />
              <p className="text-gray-400 text-sm mt-1">
                {formData.loop_category === 'stem' 
                  ? "Specify which instrument or element this stem contains"
                  : "Help others understand what type of loop this is"
                }
              </p>
            </div>
          )}
        </div>
      )}

      {/* BPM and Key */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-gray-300 mb-2">
            BPM {formData.content_type === 'loop' && !isQuickUpload ? '*' : ''}
          </label>
          <input
            type="number"
            value={formData.bpm || ''}
            onChange={(e) => handleInputChange('bpm', parseFloat(e.target.value) || 0)}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
            placeholder={formData.content_type === 'loop' ? "Required for loops" : "Optional"}
            min="60"
            max="200"
            step="0.1"
          />
          {bpmDetection && bpmDetection.detected && (
            <p className="text-xs text-accent mt-1">
              Auto-detected: {bpmDetection.bpm} BPM ({bpmDetection.confidence} confidence)
            </p>
          )}
        </div>
        <div>
          <label className="block text-gray-300 mb-2">Key</label>
          <input
            type="text"
            value={formData.key}
            onChange={(e) => handleInputChange('key', e.target.value)}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
            placeholder="optional"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-gray-300 mb-2">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
          placeholder="Describe your track..."
          rows={3}
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-gray-300 mb-2">Tags</label>
        <input
          type="text"
          value={tagInputValue}
          onChange={(e) => handleTagsChange(e.target.value)}
          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
          placeholder="Enter tags separated by commas"
        />
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {formData.tags.map((tag, index) => (
              <span key={index} className="px-2 py-1 bg-slate-700 text-gray-300 rounded-md text-sm">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Location Input with Autocomplete and Tags */}
      <div className="space-y-2">
        <label className="block text-gray-300 mb-2">
          Location(s) 🌍
        </label>
        
        {/* Selected locations as tags */}
        {selectedLocations.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedLocations.map((location, index) => (
              <span 
                key={index}
                className="inline-flex items-center gap-1 px-3 py-1 bg-accent/20 border border-accent/40 rounded-full text-sm text-white"
              >
                <span>📍 {location}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLocations(prev => prev.filter((_, i) => i !== index));
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
            placeholder={selectedLocations.length > 0 ? "Add another location..." : "Start typing: village, city, region, country..."}
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
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
          />
          
          {/* Loading indicator */}
          {isLoadingLocations && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent"></div>
            </div>
          )}
          
          {/* Autocomplete dropdown */}
          {showLocationDropdown && suggestions.length > 0 && (
            <div 
              id="location-dropdown"
              className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto"
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
                      // Add to selected locations
                      const locationName = suggestion.text + 
                        (suggestion.place_type?.[0] === 'place' && suggestion.properties?.short_code 
                          ? ', ' + suggestion.properties.short_code.toUpperCase() 
                          : '');
                      
                      console.log('Adding location:', locationName);
                      console.log('Current selectedLocations before add:', selectedLocations);
                      
                      if (!selectedLocations.includes(locationName)) {
                        setSelectedLocations(prev => {
                          console.log('Setting selected locations from:', prev, 'to:', [...prev, locationName]);
                          return [...prev, locationName];
                        });
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
        <label className="block text-gray-300 mb-2">Notes (Optional)</label>
        <textarea
          value={(formData as any).notes || ''}
          onChange={(e) => handleInputChange('notes' as any, e.target.value)}
          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
          placeholder="Include credits, lyrics, story behind the track, collaborators, inspirations - the more you share, the easier it is for others to discover your music"
          rows={5}
        />
      </div>

    </div>
  );

  const renderFileUploads = () => (
    <div className="space-y-6">
      {/* Cover Image */}
      <div>
        <label className="block text-gray-300 mb-2">Cover Artwork</label>
        <ImageUploader
          onImageChange={(url) => handleInputChange('cover_image_url', url)}
          initialImage={formData.cover_image_url}
          className="w-full h-48"
        />
      </div>

      {/* Audio Upload */}
      <div>
        <label className="block text-gray-300 mb-2">Audio File *</label>
        
        {/* Audio Input Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setAudioInputType('upload')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              audioInputType === 'upload'
                ? 'bg-accent text-slate-900'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            Upload File
          </button>
          <button
            type="button"
            onClick={() => setAudioInputType('url')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              audioInputType === 'url'
                ? 'bg-accent text-slate-900'
                : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            Enter URL
          </button>
        </div>

        {audioInputType === 'upload' ? (
          <div>
            {!uploadedAudioFile && !formData.audio_url ? (
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="audio/*,.m4a,.mp3,.wav,.flac,.ogg,.aac"
                  onChange={handleAudioFileUpload}
                  className="hidden"
                  id="audio-upload"
                  disabled={isAudioUploading}
                />
                <label
                  htmlFor="audio-upload"
                  className={`cursor-pointer ${isAudioUploading ? 'opacity-50' : ''}`}
                >
                  <div className="text-4xl mb-4">🎵</div>
                  <div className="text-gray-300 font-medium mb-2">
                    {isAudioUploading ? 'Uploading...' : 'Click to upload audio file'}
                  </div>
                  <div className="text-gray-400 text-sm">
                    Supports MP3, WAV, FLAC, M4A, OGG (max 50MB)
                  </div>
                </label>
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
                        <div className="text-gray-400 text-sm">
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
          </div>
        ) : (
          <input
            type="url"
            value={formData.audio_url}
            onChange={(e) => handleInputChange('audio_url', e.target.value)}
            className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
            placeholder="https://example.com/audio.mp3"
          />
        )}

        {/* Upload Progress */}
        {isAudioUploading && audioUploadProgress.stage !== 'idle' && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-300">{audioUploadProgress.message}</span>
              <span className="text-sm text-accent">{audioUploadProgress.progress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all duration-300"
                style={{ width: `${audioUploadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* BPM Detection Status */}
        {isDetectingBPM && (
          <div className="mt-2 text-sm text-accent">
            🎵 Detecting BPM...
          </div>
        )}
      </div>
    </div>
  );


  const renderCompositionSplits = () => (
    <div className="space-y-6">
      <div className="mb-4">
        <h4 className="text-white font-medium mb-2 text-lg">💡 IDEA RIGHTS (Composition)</h4>
        <p className="text-gray-400 text-sm mb-2">Who created the melodies, lyrics, structure, vibes?</p>
        <p className="text-gray-300 font-medium">Split royalties between all contributors (Must total 100%)</p>
        <p className="text-gray-400 text-sm mt-2">Enter wallet addresses and percentage splits. You can look up creators by their profile names in the future.</p>
      </div>

      {/* Split inputs */}
      <div className="space-y-4">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={formData[`composition_split_${num}_wallet` as keyof typeof formData] as string}
                onChange={(e) => handleInputChange(`composition_split_${num}_wallet` as keyof typeof formData, e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
                placeholder={`Creator ${num} wallet address`}
              />
            </div>
            <div className="w-32">
              <input
                type="number"
                value={formData[`composition_split_${num}_percentage` as keyof typeof formData] as number}
                onChange={(e) => handleInputChange(`composition_split_${num}_percentage` as keyof typeof formData, parseFloat(e.target.value) || 0)}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
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
    <div className="space-y-6">
      <div className="mb-4">
        <h4 className="text-white font-medium mb-2 text-lg">🔧 IMPLEMENTATION RIGHTS (Sound Recording)</h4>
        <p className="text-gray-400 text-sm mb-2">Who produced, performed, engineered, made it real?</p>
        <p className="text-gray-300 font-medium">Split royalties between all contributors (Must total 100%)</p>
        <p className="text-gray-400 text-sm mt-2">Enter wallet addresses and percentage splits. You can look up creators by their profile names in the future.</p>
      </div>

      {/* Split inputs */}
      <div className="space-y-4">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                value={formData[`production_split_${num}_wallet` as keyof typeof formData] as string}
                onChange={(e) => handleInputChange(`production_split_${num}_wallet` as keyof typeof formData, e.target.value)}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
                placeholder={`Creator ${num} wallet address`}
              />
            </div>
            <div className="w-32">
              <input
                type="number"
                value={formData[`production_split_${num}_percentage` as keyof typeof formData] as number}
                onChange={(e) => handleInputChange(`production_split_${num}_percentage` as keyof typeof formData, parseFloat(e.target.value) || 0)}
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
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
    // Different licensing options for Songs vs Loops
    if (formData.content_type === 'full_song') {
      // Song licensing - simpler, no remix options
      return (
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-xl font-bold text-white mb-2">LICENSING & PRICING</h3>
            <p className="text-gray-400">Your track will be available for:</p>
          </div>

          {/* Song Download Option */}
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-1">📥</div>
              <div className="flex-1">
                <div className="text-gray-300 font-medium mb-2">DOWNLOAD ONLY</div>
                <p className="text-gray-500 text-sm mb-2">Listeners can purchase and download your full track for:</p>
                <ul className="text-gray-400 text-sm space-y-1 ml-4">
                  <li>• Personal listening</li>
                  <li>• DJ sets and live performance</li>
                  <li>• Playlist inclusion</li>
                </ul>
              </div>
            </div>
            
            {/* Download price for songs */}
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
                    className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
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
                className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-accent focus:ring-accent"
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
                      className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
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
                        className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
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
                className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-accent focus:ring-accent"
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
                      className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
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
                        className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
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
        {/* Header */}
        <div>
          <h3 className="text-xl font-bold text-white mb-2">LICENSING & PRICING</h3>
          <p className="text-gray-400">How can others use your creation?</p>
        </div>

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
              className="w-5 h-5 mt-0.5 text-accent bg-slate-800 border-slate-600 focus:ring-accent"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-medium">REMIX ONLY</span>
                <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded">Most Common</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">Others can remix within MIXMI platform only</p>
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
                    className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
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
              className="w-5 h-5 mt-0.5 text-accent bg-slate-800 border-slate-600 focus:ring-accent"
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
                    className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
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
              className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-accent focus:ring-accent"
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
                    className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
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
                      className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
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
              className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-accent focus:ring-accent"
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
                    className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
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
                      className="w-24 p-2 bg-slate-800 border border-slate-600 rounded-l text-white text-sm"
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
      <div className="mb-4">
        <h4 className="text-white font-medium mb-2">Connect to Existing Release</h4>
        <p className="text-gray-400 text-sm">Link this track to an existing commercial release</p>
      </div>

      {/* ISRC Code */}
      <div>
        <label className="block text-gray-300 mb-2">ISRC Code</label>
        <input
          type="text"
          value={formData.isrc}
          onChange={(e) => handleInputChange('isrc', e.target.value)}
          className="w-full p-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:border-accent"
          placeholder="e.g., USRC17607839"
        />
        <p className="text-gray-400 text-sm mt-1">
          International Standard Recording Code for tracking commercial releases
        </p>
      </div>

      {/* Additional release info (future expansion) */}
      <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
        <p className="text-gray-400 text-sm">
          <span className="text-accent">Coming soon:</span> Additional fields for release date, 
          label information, and distribution platforms will be added here.
        </p>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-6">
      <div className="bg-slate-800 p-6 rounded-lg">
        <h4 className="text-white font-medium mb-4">Review Your Track</h4>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Title:</span>
            <span className="text-white">{formData.title || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Artist:</span>
            <span className="text-white">{formData.artist || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Type:</span>
            <span className="text-white">{formData.content_type === 'full_song' ? 'Song' : '8-Bar Loop'}</span>
          </div>
          {formData.content_type === 'loop' && (
            <div className="flex justify-between">
              <span className="text-gray-400">Category:</span>
              <span className="text-white">{formData.loop_category}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-400">BPM:</span>
            <span className="text-white">{formData.bpm || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">License:</span>
            <span className="text-white">
              {formData.content_type === 'full_song' 
                ? 'Download Only'
                : (formData as any).license_selection === 'platform_download' 
                  ? 'Remix + Download' 
                  : 'Remix Only'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Price:</span>
            <span className="text-white">
              {formData.content_type === 'full_song'
                ? ((formData as any).download_price || (formData as any).price_stx || 2.5)
                : (formData as any).license_selection === 'platform_download' 
                  ? ((formData as any).combined_price || 2.5)
                  : ((formData as any).remix_price || 0.5)} STX
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Audio:</span>
            <span className="text-white">{formData.audio_url ? '✓ Uploaded' : '✗ Missing'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Cover:</span>
            <span className="text-white">{formData.cover_image_url ? '✓ Uploaded' : '✗ Missing'}</span>
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

      {/* Terms of Service */}
      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-accent focus:ring-accent"
          />
          <div className="flex-1">
            <span className="text-gray-300">
              I agree to the MIXMI Terms of Service and confirm I have rights to distribute this content
            </span>
            <a 
              href="/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-accent hover:text-accent/80 text-sm mt-1"
            >
              View Terms →
            </a>
          </div>
        </label>

        <p className="text-gray-400 text-sm text-center">
          Content registration is free.
        </p>
      </div>

      {/* Save Status */}
      {saveStatus === 'complete' && (
        <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-green-400">✓</span>
            <span className="text-green-300">Track saved successfully!</span>
          </div>
        </div>
      )}
    </div>
  );

  // Main render function for steps
  const renderStep = () => {
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
      title={track ? "Edit Track" : "Add New Track"}
      size="lg"
    >
      <div className="space-y-6">
        {/* Mode Toggle - Only show for new tracks */}
        {!track && (
          <div>
            <div className="flex justify-center mb-2">
              <div className="bg-slate-800 p-1 rounded-lg inline-flex">
                <button
                  type="button"
                  onClick={() => handleModeToggle(true)}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    isQuickUpload
                      ? 'bg-accent text-slate-900 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Quick Upload
                </button>
                <button
                  type="button"
                  onClick={() => handleModeToggle(false)}
                  className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    !isQuickUpload
                      ? 'bg-accent text-slate-900 shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
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

        {/* Mode Description - only show on first page */}
        {!track && currentStep === 0 && (
          <div className="text-center mb-4">
            {isQuickUpload ? (
              <div className="bg-gradient-to-r from-accent/10 to-accent/5 p-3 rounded-lg border border-accent/20">
                <p className="text-sm text-gray-300">
                  <span className="text-accent font-medium">⚡ Quick Upload:</span> Perfect for solo creators. 
                  Smart defaults for pricing, licensing, and attribution.
                </p>
              </div>
            ) : (
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                <p className="text-sm text-gray-300">
                  <span className="text-white font-medium">⚙️ Advanced Options:</span> Full control over pricing, 
                  attribution splits, licensing, and collaboration settings.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {getStepsArray.map((step, index) => (
            <div
              key={index}
              className={`flex items-center ${index < getStepsArray.length - 1 ? 'flex-1' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  index === currentStep
                    ? 'bg-accent text-slate-900'
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

        <div className="text-center">
          <h3 className="text-lg font-medium text-white">{getStepsArray[currentStep]}</h3>
          {currentStep === 0 && (
            <p className="text-gray-400 text-sm mt-1">
              {isQuickUpload 
                ? "Essential info with smart defaults applied automatically"
                : "Tell us about your music and who made it"
              }
            </p>
          )}
        </div>

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
        <div className="min-h-[400px]">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-slate-700">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="px-4 py-2 bg-slate-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600 transition-colors"
          >
            Previous
          </button>

          {currentStep === getStepsArray.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSaving || !termsAccepted}
              className="px-6 py-2 bg-accent text-slate-900 rounded-md font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={!termsAccepted ? 'Please accept the terms of service' : ''}
            >
              {isSaving ? 'Saving...' : (track ? 'Update Track' : 'Create Track')}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="px-4 py-2 bg-accent text-slate-900 rounded-md font-medium hover:bg-accent/90 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
