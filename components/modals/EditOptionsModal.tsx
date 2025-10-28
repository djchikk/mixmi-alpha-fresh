"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Track {
  id: string;
  title: string;
  artist: string;
  is_deleted?: boolean;
}

interface EditOptionsModalProps {
  track: Track;
  isOpen: boolean;
  onClose: () => void;
  onEditDetails: () => void;
  onRefresh: () => void;
}

export default function EditOptionsModal({
  track,
  isOpen,
  onClose,
  onEditDetails,
  onRefresh
}: EditOptionsModalProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { walletAddress } = useAuth();

  if (!isOpen) return null;

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
          walletAddress: walletAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error toggling visibility:', data.error);
        alert(data.error || 'Failed to update track visibility');
      } else {
        onRefresh();
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
          walletAddress: walletAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error deleting track:', data.error);
        alert(data.error || 'Failed to delete track');
      } else {
        onRefresh();
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">
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

        {/* Content */}
        {!showDeleteConfirm ? (
          <div className="p-6 space-y-3">
            <p className="text-gray-400 mb-6">What would you like to do?</p>

            {/* Edit Track Details */}
            <button
              onClick={() => {
                onClose();
                onEditDetails();
              }}
              className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-left border border-slate-600 hover:border-[#81E4F2] group"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">✏️</span>
                <div>
                  <div className="text-white font-medium group-hover:text-[#81E4F2]">
                    Edit Track Details
                  </div>
                  <div className="text-sm text-gray-400">
                    Update title, description, pricing, etc.
                  </div>
                </div>
              </div>
            </button>

            {/* Hide/Show from Store */}
            <button
              onClick={handleHideToggle}
              disabled={isProcessing}
              className="w-full p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-left border border-slate-600 hover:border-[#81E4F2] group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{track.is_deleted ? '👁️' : '👁️‍🗨️'}</span>
                <div>
                  <div className="text-white font-medium group-hover:text-[#81E4F2]">
                    {track.is_deleted ? 'Show in Store' : 'Hide from Store'}
                  </div>
                  <div className="text-sm text-gray-400">
                    {track.is_deleted
                      ? 'Make this track visible in your store'
                      : 'Keep track but remove from public view'
                    }
                  </div>
                </div>
              </div>
            </button>

            {/* Delete Forever */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isProcessing}
              className="w-full p-4 bg-slate-800 hover:bg-red-900/30 rounded-lg transition-colors text-left border border-slate-600 hover:border-red-500 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">🗑️</span>
                <div>
                  <div className="text-white font-medium group-hover:text-red-400">
                    Delete Forever
                  </div>
                  <div className="text-sm text-gray-400">
                    Permanently remove this track
                  </div>
                </div>
              </div>
            </button>
          </div>
        ) : (
          /* Delete Confirmation */
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
        )}

        {/* Footer */}
        {!showDeleteConfirm && (
          <div className="p-4 border-t border-slate-700">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
