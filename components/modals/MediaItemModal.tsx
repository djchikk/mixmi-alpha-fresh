"use client";

import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { MediaItem } from "@/types";
import { parseMediaUrl, getMediaPreview, MediaType } from "@/lib/mediaUtils";
import { v4 as uuidv4 } from "uuid";

interface MediaItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: MediaItem;
  onSave: (item: MediaItem) => void;
}

export default function MediaItemModal({
  isOpen,
  onClose,
  item,
  onSave,
}: MediaItemModalProps) {
  const [formData, setFormData] = useState<MediaItem>({
    id: "",
    type: "youtube",
    rawUrl: "",
    embedUrl: "",
  });
  
  const [preview, setPreview] = useState<React.ReactNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'complete'>('idle');

  // Reset form data when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({ ...item });
        if (item.embedUrl) {
          setPreview(getMediaPreview(item.type as MediaType, item.embedUrl));
        }
      } else {
        setFormData({
          id: uuidv4(),
          type: "youtube",
          rawUrl: "",
          embedUrl: "",
        });
        setPreview(null);
      }
      setError(null);
      setIsSaving(false);
      setSaveStatus('idle');
    }
  }, [isOpen, item]);
  
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    
    // Clear previous embed data to ensure it gets regenerated
    setFormData((prev) => ({ 
      ...prev, 
      rawUrl: url,
      embedUrl: "", // Clear the embed URL to force regeneration
      type: "youtube", // Reset type to default
    }));
    
    setError(null);
    setPreview(null);
  };
  
  const generatePreview = () => {
    const url = formData.rawUrl.trim();
    if (!url) {
      setError("Please enter a URL");
      return;
    }
    
    const mediaInfo = parseMediaUrl(url);
    if (!mediaInfo) {
      setError("Unable to parse media URL");
      return;
    }
    
    // Always update the media type and embed URL based on the raw URL
    setFormData((prev) => {
      return {
        ...prev,
        type: mediaInfo.type,
        embedUrl: mediaInfo.embedUrl,
      };
    });
    
    setPreview(getMediaPreview(mediaInfo.type, mediaInfo.embedUrl));
    setError(null);
  };

  const handleModalClose = () => {
    setFormData({
      id: uuidv4(),
      type: "youtube",
      rawUrl: "",
      embedUrl: "",
    });
    setPreview(null);
    setError(null);
    setIsSaving(false);
    setSaveStatus('idle');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.rawUrl.trim()) {
      setError("URL is required");
      return;
    }
    
    try {
      setIsSaving(true);
      setSaveStatus('saving');
      
      // Always regenerate the embed URL before saving
      if (!formData.embedUrl) {
        generatePreview();
        
        // Need to delay to allow the state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (!formData.embedUrl) {
          throw new Error("Failed to generate embed URL");
        }
      }
      
      // Call the save function (synchronous for media items)
      onSave(formData);
      
      // Show success state
      setSaveStatus('complete');
      
      // Brief delay to show success message, then close
      setTimeout(() => {
        setIsSaving(false);
        setSaveStatus('idle');
        onClose();
      }, 1500);
      
    } catch (error) {
      console.error('Save failed:', error);
      setIsSaving(false);
      setSaveStatus('idle');
      setError('Failed to save item. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? "Edit Media Item" : "Add Media Item"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="rawUrl"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Media URL*
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              id="rawUrl"
              name="rawUrl"
              value={formData.rawUrl}
              onChange={handleUrlChange}
              placeholder="https://youtube.com/watch?v=..."
              className="input-field flex-1"
              required
            />
            <button
              type="button"
              onClick={generatePreview}
              className="px-3 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-600"
            >
              Preview
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Supports YouTube, Spotify, SoundCloud, Mixcloud, Apple Music, and more
          </p>
        </div>

        {/* Preview area */}
        {preview && (
          <div className="border border-slate-700 rounded-md overflow-hidden">
            <div className="p-2 bg-slate-800">
              <h3 className="text-sm font-medium">Preview ({formData.type})</h3>
            </div>
            <div className="p-4 bg-slate-900">
              {preview}
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Save Status Indicator */}
        {isSaving && (
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center space-x-2">
              {saveStatus === 'complete' ? (
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin"></div>
              )}
              <span className="text-sm font-medium text-gray-300">
                {saveStatus === 'saving' ? 'Saving...' : 'Content will appear momentarily! ✨'}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={handleModalClose}
            disabled={isSaving}
            className="px-4 py-1.5 bg-slate-800 text-gray-400 border border-slate-600 rounded-lg font-medium hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#101726] text-white border-2 border-white rounded-lg font-semibold hover:bg-[#1a2030] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSaving && saveStatus === 'saving' && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{item ? "Save Changes" : "Add Item"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
} 