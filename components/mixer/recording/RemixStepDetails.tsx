"use client";

import React from 'react';
import { X, Plus, MapPin } from 'lucide-react';
import { RemixDetails } from './RemixCompletionModal';
import { IPTrack } from '@/types';

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
  const [newTag, setNewTag] = React.useState('');
  const [newLocation, setNewLocation] = React.useState('');

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

  const handleAddLocation = () => {
    if (newLocation.trim() && !remixDetails.locations.includes(newLocation.trim())) {
      onDetailsChange({
        ...remixDetails,
        locations: [...remixDetails.locations, newLocation.trim()],
      });
      setNewLocation('');
    }
  };

  const handleRemoveLocation = (locationToRemove: string) => {
    onDetailsChange({
      ...remixDetails,
      locations: remixDetails.locations.filter(loc => loc !== locationToRemove),
    });
  };

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
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#81E4F2] transition-colors"
            placeholder="Add a tag..."
          />
          <button
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

      {/* Locations */}
      <div>
        <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
          <MapPin size={12} className="inline mr-1" />
          Locations
          <span className="text-slate-500 normal-case ml-1">(remix appears at all locations)</span>
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {remixDetails.locations.map((location) => (
            <span
              key={location}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-700 rounded-full text-xs text-slate-300"
            >
              <MapPin size={10} className="text-slate-500" />
              {location}
              <button
                onClick={() => handleRemoveLocation(location)}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          {remixDetails.locations.length === 0 && (
            <span className="text-xs text-slate-500 italic">No locations from source tracks</span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
            className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#81E4F2] transition-colors"
            placeholder="Add your location..."
          />
          <button
            onClick={handleAddLocation}
            disabled={!newLocation.trim()}
            className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
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
