"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Radio, Upload, MapPin, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/lib/supabase";
import TrackCoverUploader from "../shared/TrackCoverUploader";
import { parseLocationsAndGetCoordinates } from "@/lib/locationLookup";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";

interface StationInPack {
  name: string;
  streamUrl: string;
}

interface RadioStationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: () => void;
}

export default function RadioStationModal({
  isOpen,
  onClose,
  onUploadComplete
}: RadioStationModalProps) {
  const { walletAddress, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  // Form state
  const [contentType, setContentType] = useState<'radio_station' | 'station_pack'>('radio_station');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState('');
  const [metadataApiUrl, setMetadataApiUrl] = useState('');

  // Station pack state
  const [packStations, setPackStations] = useState<StationInPack[]>([{ name: '', streamUrl: '' }]);

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Refs
  const locationInputRef = useRef<HTMLInputElement>(null);

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

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setContentType('radio_station');
      setTitle('');
      setDescription('');
      setStreamUrl('');
      setCoverImageUrl('');
      setTags([]);
      setTagInput('');
      setLocation('');
      setLocationCoords(null);
      setMetadataApiUrl('');
      setPackStations([{ name: '', streamUrl: '' }]);
      setErrors({});
      setShowLocationDropdown(false);
      setTermsAccepted(false);
      clearSuggestions();
    }
  }, [isOpen, clearSuggestions]);

  // Station pack handlers
  const MAX_STATIONS_PER_PACK = 5;

  const addStation = () => {
    if (packStations.length < MAX_STATIONS_PER_PACK) {
      setPackStations([...packStations, { name: '', streamUrl: '' }]);
    }
  };

  const removeStation = (index: number) => {
    if (packStations.length > 1) {
      setPackStations(packStations.filter((_, i) => i !== index));
    }
  };

  const updateStation = (index: number, field: 'name' | 'streamUrl', value: string) => {
    const updated = [...packStations];
    updated[index][field] = value;
    setPackStations(updated);
  };

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = contentType === 'station_pack' ? 'Pack name is required' : 'Station name is required';
    }
    if (!description.trim()) newErrors.description = 'Description is required';

    // Stream URL only required for single stations
    if (contentType === 'radio_station') {
      if (!streamUrl.trim()) newErrors.streamUrl = 'Stream URL is required';

      // Validate stream URL format
      if (streamUrl && !streamUrl.match(/^https?:\/\/.+/)) {
        newErrors.streamUrl = 'Please enter a valid HTTP(S) URL';
      }
    }

    // For station packs, validate pack stations
    if (contentType === 'station_pack') {
      const validStations = packStations.filter(s => s.streamUrl.trim() !== '');
      if (validStations.length === 0) {
        newErrors.packStations = 'At least one station with a stream URL is required';
      }

      // Validate each station's stream URL format
      packStations.forEach((station, index) => {
        if (station.streamUrl.trim() && !station.streamUrl.match(/^https?:\/\/.+/)) {
          newErrors[`station_${index}_url`] = 'Please enter a valid HTTP(S) URL';
        }
      });
    }

    if (!coverImageUrl) newErrors.coverImage = 'Cover image is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle tag input
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated || !walletAddress) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    if (!validate()) {
      showToast('Please fix the errors before submitting', 'error');
      return;
    }

    setIsUploading(true);

    try {
      // Parse location if provided
      let locationData = null;
      if (location.trim()) {
        if (locationCoords) {
          // Use coordinates from autocomplete selection
          locationData = {
            location_lat: locationCoords.lat,
            location_lng: locationCoords.lng,
            primary_location: location.trim(),
            locations: [{
              lat: locationCoords.lat,
              lng: locationCoords.lng,
              name: location.trim()
            }]
          };
          console.log('📍 Using autocomplete coordinates:', locationCoords);
        } else {
          // Fallback to geocoding if user typed manually without selecting
          const parsedLocations = await parseLocationsAndGetCoordinates(location);
          if (parsedLocations && parsedLocations.length > 0) {
            locationData = {
              location_lat: parsedLocations[0].lat,
              location_lng: parsedLocations[0].lng,
              primary_location: location.trim(),
              locations: parsedLocations
            };
          }
        }
      }

      if (contentType === 'radio_station') {
        // Create single radio station
        const radioStation = {
          title: title.trim(),
          artist: title.trim(),
          description: description.trim(),
          stream_url: streamUrl.trim(),
          metadata_api_url: metadataApiUrl.trim() || null,
          cover_image_url: coverImageUrl,
          tags: tags,
          content_type: 'radio_station',
          sample_type: 'radio',
          primary_uploader_wallet: walletAddress,
          ...locationData,
          composition_split_1_wallet: walletAddress,
          composition_split_1_percentage: 100,
          production_split_1_wallet: walletAddress,
          production_split_1_percentage: 100,
          isrc: null, // Radio stations don't need ISRC codes
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('ip_tracks')
          .insert([radioStation])
          .select()
          .single();

        if (error) throw error;

        showToast('✅ Radio station added successfully!', 'success');
      } else {
        // Create station pack
        // First, create the parent pack record
        const packRecord = {
          title: title.trim(),
          artist: title.trim(),
          description: description.trim(),
          stream_url: '', // Empty for packs
          metadata_api_url: null,
          cover_image_url: coverImageUrl,
          tags: tags,
          content_type: 'station_pack',
          sample_type: 'radio',
          primary_uploader_wallet: walletAddress,
          ...locationData,
          composition_split_1_wallet: walletAddress,
          composition_split_1_percentage: 100,
          production_split_1_wallet: walletAddress,
          production_split_1_percentage: 100,
          pack_position: null,
          isrc: null, // Station packs don't need ISRC codes
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: packData, error: packError } = await supabase
          .from('ip_tracks')
          .insert([packRecord])
          .select()
          .single();

        if (packError) throw packError;

        // Create individual station records for each station in the pack
        const validStations = packStations.filter(s => s.streamUrl.trim() !== '');
        const stationRecords = validStations.map((station, index) => ({
          title: station.name.trim() || `Station ${index + 1}`,
          artist: title.trim(), // Use pack name as artist
          description: description.trim(),
          stream_url: station.streamUrl.trim(),
          metadata_api_url: null,
          cover_image_url: coverImageUrl,
          tags: tags,
          content_type: 'radio_station',
          sample_type: 'radio',
          primary_uploader_wallet: walletAddress,
          ...locationData,
          composition_split_1_wallet: walletAddress,
          composition_split_1_percentage: 100,
          production_split_1_wallet: walletAddress,
          production_split_1_percentage: 100,
          pack_id: packData.id, // Link to parent pack
          pack_position: index + 1,
          isrc: null, // Radio stations don't need ISRC codes
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        const { error: stationsError } = await supabase
          .from('ip_tracks')
          .insert(stationRecords);

        if (stationsError) throw stationsError;

        showToast(`✅ Station pack added successfully with ${validStations.length} stations!`, 'success');
      }

      onUploadComplete?.();
      onClose();
    } catch (error: any) {
      console.error('Error uploading radio station:', error);
      const errorMessage = error?.message || error?.error_description || 'Failed to upload radio station';
      showToast(`Upload failed: ${errorMessage}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-20 bg-opacity-60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#1a2332] to-[#0f1419] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[calc(90vh-90px)] overflow-y-auto border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-gradient-to-br from-[#1a2332] to-[#0f1419] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FB923C]/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-[#FB923C]" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {contentType === 'station_pack' ? 'Add Station Pack' : 'Add Radio Station'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={isUploading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 pb-24 space-y-6">
          {/* Content Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Content Type</label>
            <div className="grid grid-cols-2 gap-3">
              {/* Single Station */}
              <button
                type="button"
                onClick={() => setContentType('radio_station')}
                className="flex items-center justify-center border-2 rounded-lg transition-all"
                style={{
                  padding: '14px',
                  minHeight: '54px',
                  background: contentType === 'radio_station' ? 'rgba(251, 146, 60, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: contentType === 'radio_station' ? '#FB923C' : 'rgba(255, 255, 255, 0.08)',
                  color: contentType === 'radio_station' ? '#FB923C' : '#8b92a6',
                  borderRadius: '12px'
                }}
                disabled={isUploading}
              >
                Single Station
              </button>

              {/* Station Pack */}
              <button
                type="button"
                onClick={() => setContentType('station_pack')}
                className="flex items-center justify-center border-2 rounded-lg transition-all"
                style={{
                  padding: '14px',
                  minHeight: '54px',
                  background: contentType === 'station_pack' ? 'rgba(251, 146, 60, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  borderColor: contentType === 'station_pack' ? '#FB923C' : 'rgba(255, 255, 255, 0.08)',
                  color: contentType === 'station_pack' ? '#FB923C' : '#8b92a6',
                  borderRadius: '12px'
                }}
                disabled={isUploading}
              >
                Station Pack
              </button>
            </div>
          </div>

          {/* Station/Pack Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {contentType === 'station_pack' ? 'Pack Name' : 'Station Name'} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-3 bg-[#0f172a] border ${
                errors.title ? 'border-red-500' : 'border-white/10'
              } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C]`}
              placeholder={contentType === 'station_pack' ? 'e.g., NYC Electronic Collection' : 'e.g., Radio Paradise'}
              disabled={isUploading}
            />
            {errors.title && <p className="text-red-400 text-sm mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={`w-full px-4 py-3 bg-[#0f172a] border ${
                errors.description ? 'border-red-500' : 'border-white/10'
              } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C] resize-none`}
              placeholder={contentType === 'station_pack' ? 'Describe your curated collection...' : 'Tell listeners about your station...'}
              disabled={isUploading}
            />
            {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
          </div>

          {/* Stream URL - Only for single stations */}
          {contentType === 'radio_station' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stream URL <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              className={`w-full px-4 py-3 bg-[#0f172a] border ${
                errors.streamUrl ? 'border-red-500' : 'border-white/10'
              } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C]`}
              placeholder="https://stream.example.com/radio.mp3"
              disabled={isUploading}
            />
            {errors.streamUrl && <p className="text-red-400 text-sm mt-1">{errors.streamUrl}</p>}
            <p className="text-gray-500 text-xs mt-1">Direct link to the audio stream</p>
          </div>
          )}

          {/* Station Pack - Multiple Stations */}
          {contentType === 'station_pack' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Stations in Pack <span className="text-red-400">*</span>
            </label>
            <div className="space-y-3">
              {packStations.map((station, index) => (
                <div key={index} className="bg-[#0f172a] border border-white/10 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FB923C]/20 flex items-center justify-center text-[#FB923C] font-medium text-sm mt-2">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <input
                          type="text"
                          value={station.name}
                          onChange={(e) => updateStation(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 bg-[#1a2332] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C] text-sm"
                          placeholder="Station name (optional)"
                          disabled={isUploading}
                        />
                      </div>
                      <div>
                        <input
                          type="url"
                          value={station.streamUrl}
                          onChange={(e) => updateStation(index, 'streamUrl', e.target.value)}
                          className={`w-full px-3 py-2 bg-[#1a2332] border ${
                            errors[`station_${index}_url`] ? 'border-red-500' : 'border-white/10'
                          } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C] text-sm`}
                          placeholder="https://stream.example.com/station.mp3"
                          disabled={isUploading}
                        />
                        {errors[`station_${index}_url`] && (
                          <p className="text-red-400 text-xs mt-1">{errors[`station_${index}_url`]}</p>
                        )}
                      </div>
                    </div>
                    {packStations.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStation(index)}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-red-400 transition-colors mt-1"
                        disabled={isUploading}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {errors.packStations && <p className="text-red-400 text-sm mt-2">{errors.packStations}</p>}
            <button
              type="button"
              onClick={addStation}
              className="mt-3 w-full px-4 py-2 bg-[#FB923C]/10 hover:bg-[#FB923C]/20 border border-[#FB923C]/30 text-[#FB923C] rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isUploading || packStations.length >= MAX_STATIONS_PER_PACK}
            >
              <Plus size={18} />
              <span>Add Another Station</span>
            </button>
            <p className="text-gray-500 text-xs mt-2">
              {packStations.length >= MAX_STATIONS_PER_PACK
                ? `Maximum ${MAX_STATIONS_PER_PACK} stations per pack`
                : `Add up to ${MAX_STATIONS_PER_PACK} stations in this pack`}
            </p>
          </div>
          )}

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cover Image <span className="text-red-400">*</span>
            </label>
            <TrackCoverUploader
              walletAddress={walletAddress || ''}
              onImageChange={setCoverImageUrl}
              initialImage={coverImageUrl}
            />
            {errors.coverImage && <p className="text-red-400 text-sm mt-1">{errors.coverImage}</p>}
          </div>

          {/* Location (Optional) with Autocomplete */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <MapPin className="inline w-4 h-4 mr-1" />
              Location (Optional)
            </label>
            <input
              ref={locationInputRef}
              type="text"
              value={location}
              onChange={(e) => {
                const value = e.target.value;
                setLocation(value);
                handleLocationSearch(value);
                setShowLocationDropdown(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) {
                  setShowLocationDropdown(true);
                }
              }}
              onBlur={() => {
                // Delay to allow clicking on suggestions
                setTimeout(() => setShowLocationDropdown(false), 200);
              }}
              className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C]"
              placeholder="Start typing: San Francisco, London, Tokyo..."
              disabled={isUploading}
            />

            {/* Loading indicator */}
            {isLoadingLocations && (
              <div className="absolute right-3 top-11 transform">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FB923C]"></div>
              </div>
            )}

            {/* Autocomplete dropdown */}
            {showLocationDropdown && suggestions.length > 0 && (
              <div
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
                    className="w-full px-4 py-3 text-left hover:bg-[#FB923C]/20 transition-colors border-b border-slate-700 last:border-b-0 text-white"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      const locationName = suggestion.place_name || suggestion.text;
                      const [lng, lat] = suggestion.center;

                      console.log('📍 Selected location:', locationName, { lat, lng });

                      setLocation(locationName);
                      setLocationCoords({ lat, lng });
                      setShowLocationDropdown(false);
                      clearSuggestions();
                    }}
                  >
                    <div className="font-medium">{suggestion.place_name || suggestion.text}</div>
                  </button>
                ))}
              </div>
            )}

            <p className="text-gray-500 text-xs mt-1">
              {locationCoords
                ? `📍 Coordinates: ${locationCoords.lat.toFixed(4)}, ${locationCoords.lng.toFixed(4)}`
                : 'Location is optional, but required to appear on the globe'
              }
            </p>
          </div>

          {/* Tags (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags (Optional)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C]"
              placeholder="Type a tag and press Enter"
              disabled={isUploading}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="bg-[#FB923C]/20 text-[#FB923C] px-3 py-1 rounded-full text-sm flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-white transition-colors"
                      disabled={isUploading}
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Metadata API URL (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Metadata API URL (Optional)
            </label>
            <input
              type="url"
              value={metadataApiUrl}
              onChange={(e) => setMetadataApiUrl(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C]"
              placeholder="https://api.example.com/nowplaying"
              disabled={isUploading}
            />
            <p className="text-gray-500 text-xs mt-1">
              API endpoint for "Now Playing" information
            </p>
          </div>

          {/* Terms of Service */}
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-5 h-5 mt-0.5 bg-slate-800 border-slate-600 rounded text-[#FB923C] focus:ring-[#FB923C]"
              />
              <div className="flex-1">
                <span className="text-gray-300">
                  I agree to the mixmi Terms of Service and confirm I have rights to distribute this content
                </span>
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[#FB923C] hover:text-[#FB923C]/80 text-sm mt-1"
                >
                  View Terms →
                </a>
              </div>
            </label>

            <p className="text-gray-400 text-sm text-center">
              Radio station registration is free.
            </p>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#FB923C] hover:bg-[#FB923C]/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isUploading || !termsAccepted}
              title={!termsAccepted ? 'Please accept the terms of service' : ''}
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>{contentType === 'station_pack' ? 'Adding Pack...' : 'Adding Station...'}</span>
                </>
              ) : (
                <>
                  <Upload size={20} />
                  <span>{contentType === 'station_pack' ? 'Add Pack' : 'Add Station'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
