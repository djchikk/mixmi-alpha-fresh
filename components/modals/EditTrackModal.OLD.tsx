"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import TrackCoverUploader from '../shared/TrackCoverUploader';

interface Track {
  id: string;
  title: string;
  artist: string;
  description?: string;
  cover_image_url?: string;
  bpm?: number;
  key?: string;
  tags?: string[];
  location?: string;
  download_price_stx?: number;
  contact_commercial_fee?: number;
  contact_collab_fee?: number;
  is_deleted?: boolean;
}

interface EditTrackModalProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MODES = ['Major', 'Minor'];

export default function EditTrackModal({
  track,
  isOpen,
  onClose,
  onSave
}: EditTrackModalProps) {
  const { walletAddress } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: track.title || '',
    artist: track.artist || '',
    description: track.description || '',
    cover_image_url: track.cover_image_url || '',
    bpm: track.bpm || '',
    key: track.key || '',
    tags: track.tags || [],
    location: track.location || '',
    download_price_stx: track.download_price_stx || ''
  });

  const [tagInput, setTagInput] = useState('');

  // Update form when track changes
  useEffect(() => {
    setFormData({
      title: track.title || '',
      artist: track.artist || '',
      description: track.description || '',
      cover_image_url: track.cover_image_url || '',
      bpm: track.bpm || '',
      key: track.key || '',
      tags: track.tags || [],
      location: track.location || '',
      download_price_stx: track.download_price_stx || ''
    });
  }, [track]);

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSaveChanges = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/tracks/${track.id}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          walletAddress
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error updating track:', data.error);
        alert(data.error || 'Failed to update track');
      } else {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update track');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleHideToggle = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/tracks/toggle-visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackId: track.id,
          walletAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error toggling visibility:', data.error);
        alert(data.error || 'Failed to update track visibility');
      } else {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update track visibility');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteForever = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/tracks/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackId: track.id,
          walletAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error deleting track:', data.error);
        alert(data.error || 'Failed to delete track');
      } else {
        onSave();
        onClose();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to delete track');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-lg border border-slate-700 max-h-[calc(90vh-90px)] flex flex-col">
        {!showDeleteConfirm ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-slate-700 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold text-white">
                  Edit "{track.title}"
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Secondary Actions - Horizontal */}
              <div className="flex gap-3">
                <button
                  onClick={handleHideToggle}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {track.is_deleted ? '👁️ Show in Store' : '👁️‍🗨️ Hide from Store'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-red-900/30 text-white rounded-lg transition-colors border border-slate-600 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  🗑️ Delete Forever
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="p-6 pb-24 overflow-y-auto flex-1">
              <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#81E4F2]"
                  required
                />
              </div>

              {/* Artist */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Artist *
                </label>
                <input
                  type="text"
                  value={formData.artist}
                  onChange={(e) => handleInputChange('artist', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#81E4F2]"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#81E4F2]"
                  placeholder="Optional description..."
                />
              </div>

              {/* BPM and Key */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    BPM
                  </label>
                  <input
                    type="number"
                    value={formData.bpm}
                    onChange={(e) => handleInputChange('bpm', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#81E4F2]"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Key (Optional)
                  </label>
                  <select
                    value={formData.key}
                    onChange={(e) => handleInputChange('key', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#81E4F2]"
                  >
                    <option value="">Select key...</option>
                    {KEYS.flatMap(key =>
                      MODES.map(mode => (
                        <option key={`${key}-${mode}`} value={`${key} ${mode}`}>
                          {key} {mode}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-[#81E4F2]/20 text-[#81E4F2] rounded-full text-sm flex items-center gap-2"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-white transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#81E4F2]"
                    placeholder="Add a tag..."
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-[#81E4F2] text-slate-900 rounded-lg hover:bg-[#6dd4e2] transition-colors font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#81E4F2]"
                  placeholder="City, Country"
                />
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cover Image
                </label>
                <TrackCoverUploader
                  currentImageUrl={formData.cover_image_url}
                  onImageUploaded={(url) => handleInputChange('cover_image_url', url)}
                  walletAddress={walletAddress || ''}
                />
              </div>

              {/* Pricing */}
              <div className="space-y-4 border-t border-slate-700 pt-6">
                <h3 className="text-lg font-semibold text-white">Pricing</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Download Price (STX)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.download_price_stx}
                    onChange={(e) => handleInputChange('download_price_stx', e.target.value)}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-[#81E4F2]"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="flex gap-3 pt-6">
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#8b92a6'
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#a3b1c6';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.color = '#8b92a6';
                  }
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={isProcessing}
                className="px-4 py-1.5 rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 bg-gray-200 text-[#0a0e1a] hover:bg-gray-300"
              >
                {isProcessing ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            </div>
          </>
        ) : (
          /* Delete Confirmation */
          <>
            <div className="p-6 space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  Delete "{track.title}"?
                </h3>
                <p className="text-gray-400">
                  This action cannot be undone. The track will be permanently removed from the database.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteForever}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'Deleting...' : 'Delete Forever'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
