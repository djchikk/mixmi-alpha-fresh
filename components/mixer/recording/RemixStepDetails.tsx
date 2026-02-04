"use client";

import React, { useRef, useState, useEffect } from 'react';
import { X, Plus, MapPin, Loader2 } from 'lucide-react';
import { RemixDetails, RemixLocation } from './RemixCompletionModal';
import { IPTrack } from '@/types';
import { useLocationAutocomplete } from '@/hooks/useLocationAutocomplete';

interface RemixStepDetailsProps {
  remixDetails: RemixDetails;
  onDetailsChange: (details: RemixDetails) => void;
  loadedTracks: IPTrack[];
}

export default function RemixStepDetails({
  remixDetails,
  onDetailsChange,
  loadedTracks,
}: RemixStepDetailsProps) {
  const [newTag, setNewTag] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Location autocomplete hook
  const {
    suggestions,
    isLoading: locationLoading,
    error: locationError,
    handleInputChange: handleLocationSearch,
    clearSuggestions,
    cleanup: cleanupLocationSearch
  } = useLocationAutocomplete({
    minCharacters: 3,
    debounceMs: 300,
    limit: 5
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupLocationSearch();
    };
  }, [cleanupLocationSearch]);

  // Show dropdown when suggestions change
  useEffect(() => {
    if (suggestions.length > 0) {
      setShowLocationDropdown(true);
    }
  }, [suggestions]);

  const handleAddTag = () => {
    if (newTag.trim() && !remixDetails.tags.includes(newTag.trim().toLowerCase())) {
      onDetailsChange({
        ...remixDetails,
        tags: [...remixDetails.tags, newTag.trim().toLowerCase()],
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onDetailsChange({
      ...remixDetails,
      tags: remixDetails.tags.filter(tag => tag !== tagToRemove),
    });
  };

  const handleLocationInputChange = (value: string) => {
    setLocationInput(value);
    handleLocationSearch(value);
  };

  const handleSelectLocation = (suggestion: any) => {
    const locationName = suggestion.place_name || suggestion.text;
    const [lng, lat] = suggestion.center;

    // Check if already exists
    if (remixDetails.locations.some(loc => loc.name === locationName)) {
      setLocationInput('');
      setShowLocationDropdown(false);
      clearSuggestions();
      return;
    }

    // Add to locations with coordinates
    onDetailsChange({
      ...remixDetails,
      locations: [...remixDetails.locations, { name: locationName, lat, lng }],
    });

    setLocationInput('');
    setShowLocationDropdown(false);
    clearSuggestions();

    // Keep focus on input for adding more
    requestAnimationFrame(() => {
      locationInputRef.current?.focus();
    });
  };

  const handleRemoveLocation = (locationToRemove: string) => {
    onDetailsChange({
      ...remixDetails,
      locations: remixDetails.locations.filter(loc => loc.name !== locationToRemove),
    });
  };

  // Close dropdown when clicking outside (but not on dropdown itself)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showLocationDropdown &&
        !locationInputRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLocationDropdown]);

  return (
    <div className="remix-step-details p-4 space-y-4">
      {/* Remix Name */}
      <div>
        <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
          Remix Name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={remixDetails.name}
          onChange={(e) => onDetailsChange({ ...remixDetails, name: e.target.value })}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#81E4F2] transition-colors"
          placeholder="Give your remix a name..."
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
          Tags
          <span className="text-slate-500 normal-case ml-1">(aggregated from sources)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {remixDetails.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 rounded-full text-xs text-slate-300"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {remixDetails.tags.length === 0 && (
            <span className="text-xs text-slate-500 italic">No tags yet - add some below</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#81E4F2] transition-colors"
            placeholder="Add a tag..."
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={!newTag.trim()}
            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
          Notes
          <span className="text-slate-500 normal-case ml-1">(aggregated from sources)</span>
        </label>
        <textarea
          value={remixDetails.notes}
          onChange={(e) => onDetailsChange({ ...remixDetails, notes: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#81E4F2] transition-colors resize-none"
          placeholder="Add notes about your remix..."
        />
        <p className="text-[10px] text-slate-500 mt-1">
          Notes feed the semantic search / intelligence layer
        </p>
      </div>

      {/* Locations with Mapbox Autocomplete */}
      <div>
        <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
          <MapPin size={12} className="inline mr-1" />
          Locations
          <span className="text-slate-500 normal-case ml-1">(remix appears at all locations)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {remixDetails.locations.map((location) => (
            <span
              key={location.name}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 rounded-full text-xs text-slate-300"
            >
              <MapPin size={10} className="text-slate-500" />
              {location.name}
              <button
                onClick={() => handleRemoveLocation(location.name)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {remixDetails.locations.length === 0 && (
            <span className="text-xs text-slate-500 italic">No locations - add yours below</span>
          )}
        </div>

        {/* Location Input with Autocomplete */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={locationInputRef}
                type="text"
                value={locationInput}
                onChange={(e) => handleLocationInputChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowLocationDropdown(true)}
                className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#81E4F2] transition-colors"
                placeholder="Search for a location..."
              />
              {locationLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 size={14} className="animate-spin text-slate-400" />
                </div>
              )}
            </div>
          </div>

          {/* Location Dropdown */}
          {showLocationDropdown && suggestions.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-1 border rounded-lg shadow-lg max-h-60 overflow-auto"
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                backdropFilter: 'blur(8px)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              }}
            >
              {suggestions.map((suggestion: any) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-b-0"
                  onClick={() => handleSelectLocation(suggestion)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">{suggestion.text}</div>
                      <div className="text-xs text-slate-400 truncate">{suggestion.place_name}</div>
                    </div>
                    <div className="text-lg flex-shrink-0">
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
          <p className="text-xs text-red-400 mt-1">{locationError}</p>
        )}
      </div>

      {/* Source Attribution */}
      <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
          Source Attribution
        </div>
        <div className="flex flex-wrap gap-2">
          {loadedTracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-1.5 bg-slate-700/50 rounded px-2 py-1"
            >
              {track.cover_image_url && (
                <img src={track.cover_image_url} alt="" className="w-5 h-5 rounded object-cover" />
              )}
              <span className="text-xs text-slate-300 truncate max-w-[100px]">{track.title}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          These tracks will be credited as sources in your remix's genealogy
        </p>
      </div>
    </div>
  );
}
