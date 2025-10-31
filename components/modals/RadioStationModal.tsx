"use client";

import React, { useState, useEffect } from "react";
import { X, Radio, Upload, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/lib/supabase";
import TrackCoverUploader from "../shared/TrackCoverUploader";
import { parseLocationsAndGetCoordinates } from "@/lib/locationLookup";

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [location, setLocation] = useState('');
  const [metadataApiUrl, setMetadataApiUrl] = useState('');

  // UI state
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setDescription('');
      setStreamUrl('');
      setCoverImageUrl('');
      setTags([]);
      setTagInput('');
      setLocation('');
      setMetadataApiUrl('');
      setErrors({});
    }
  }, [isOpen]);

  // Validation
  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Station name is required';
    if (!description.trim()) newErrors.description = 'Description is required';
    if (!streamUrl.trim()) newErrors.streamUrl = 'Stream URL is required';
    if (!coverImageUrl) newErrors.coverImage = 'Cover image is required';

    // Validate stream URL format
    if (streamUrl && !streamUrl.match(/^https?:\/\/.+/)) {
      newErrors.streamUrl = 'Please enter a valid HTTP(S) URL';
    }

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

      // Create radio station record
      const radioStation = {
        title: title.trim(),
        artist: title.trim(), // Use station name as artist for consistency
        description: description.trim(),
        stream_url: streamUrl.trim(),
        metadata_api_url: metadataApiUrl.trim() || null,
        cover_image_url: coverImageUrl,
        tags: tags,
        content_type: 'radio_station',
        primary_uploader_wallet: walletAddress,

        // Location data
        ...locationData,

        // Default splits to uploader
        composition_split_1_wallet: walletAddress,
        composition_split_1_percentage: 100,
        production_split_1_wallet: walletAddress,
        production_split_1_percentage: 100,

        // No pricing for radio stations
        price_stx: null,
        download_price_stx: null,
        remix_price_stx: null,
        allow_downloads: false,
        allow_remixing: false,

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
      onUploadComplete?.();
      onClose();
    } catch (error) {
      console.error('Error uploading radio station:', error);
      showToast('Failed to upload radio station', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-[#1a2332] to-[#0f1419] rounded-xl shadow-2xl w-full max-w-3xl border border-white/10 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-gradient-to-br from-[#1a2332] to-[#0f1419] z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FB923C]/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-[#FB923C]" />
            </div>
            <h2 className="text-2xl font-bold text-white">Add Radio Station</h2>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Station Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Station Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-4 py-3 bg-[#0f172a] border ${
                errors.title ? 'border-red-500' : 'border-white/10'
              } rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C]`}
              placeholder="e.g., Radio Paradise"
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
              placeholder="Tell listeners about your station..."
              disabled={isUploading}
            />
            {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
          </div>

          {/* Stream URL */}
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

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cover Image <span className="text-red-400">*</span>
            </label>
            <TrackCoverUploader
              walletAddress={walletAddress || ''}
              onImageUploaded={setCoverImageUrl}
              currentImageUrl={coverImageUrl}
            />
            {errors.coverImage && <p className="text-red-400 text-sm mt-1">{errors.coverImage}</p>}
          </div>

          {/* Location (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <MapPin className="inline w-4 h-4 mr-1" />
              Location (Optional)
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-3 bg-[#0f172a] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FB923C]"
              placeholder="e.g., San Francisco, CA"
              disabled={isUploading}
            />
            <p className="text-gray-500 text-xs mt-1">
              Location is optional, but required to appear on the globe
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
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Adding Station...</span>
                </>
              ) : (
                <>
                  <Upload size={20} />
                  <span>Add Station</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
