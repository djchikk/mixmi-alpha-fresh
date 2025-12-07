"use client";

import React, { useState, useEffect, useCallback } from "react";
import Modal from "../ui/Modal";
import ImageUploader from "../shared/ImageUploader";
import { SpotlightItem } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { Users, X } from "lucide-react";

interface MixmiUser {
  walletAddress: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
}

interface SpotlightItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: SpotlightItem; // Existing item when editing, undefined when adding new
  onSave: (item: SpotlightItem) => void;
}

export default function SpotlightItemModal({
  isOpen,
  onClose,
  item,
  onSave,
}: SpotlightItemModalProps) {
  const [formData, setFormData] = useState<SpotlightItem>({
    id: uuidv4(),
    title: "",
    description: "",
    image: "",
    link: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'complete'>('idle');

  // User linking state
  const [isUserLinkMode, setIsUserLinkMode] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<MixmiUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<MixmiUser | null>(null);
  const [linkDestination, setLinkDestination] = useState<'profile' | 'store'>('profile');

  // Reset form data when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      try {
        if (item) {
          // Editing existing item
          console.log("Editing existing item:", item);
          setFormData({ ...item });
        } else {
          // Adding new item with a fresh ID
          console.log("Creating new item");
          const newItem = {
            id: uuidv4(),
            title: "",
            description: "",
            image: "",
            link: "",
          };
          setFormData(newItem);
        }
        setIsSaving(false);
        setSaveStatus('idle');
        // Reset user linking state
        setIsUserLinkMode(false);
        setUserSearchQuery("");
        setUserSearchResults([]);
        setSelectedUser(null);
        setLinkDestination('profile');
      } catch (error) {
        console.error("Error resetting form data:", error);
      }
    }
  }, [isOpen, item]);

  // Debounced user search
  useEffect(() => {
    if (!userSearchQuery || userSearchQuery.length < 2) {
      setUserSearchResults([]);
      return;
    }

    const debounceTimer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/profile/search-users?q=${encodeURIComponent(userSearchQuery)}`);
        const data = await response.json();
        setUserSearchResults(data.users || []);
      } catch (error) {
        console.error("Error searching users:", error);
        setUserSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [userSearchQuery]);

  // Handle selecting a user from search results
  const handleSelectUser = (user: MixmiUser) => {
    setSelectedUser(user);
    setUserSearchQuery("");
    setUserSearchResults([]);

    // Auto-fill the form
    const identifier = user.username || user.walletAddress;
    const linkUrl = linkDestination === 'profile'
      ? `/profile/${identifier}`
      : `/store/${identifier}`;

    setFormData(prev => ({
      ...prev,
      title: user.displayName,
      link: linkUrl,
      // Only set image if user has an avatar and current image is empty
      image: prev.image || user.avatarUrl || "",
    }));
  };

  // Update link when destination changes
  const handleDestinationChange = (destination: 'profile' | 'store') => {
    setLinkDestination(destination);
    if (selectedUser) {
      const identifier = selectedUser.username || selectedUser.walletAddress;
      const linkUrl = destination === 'profile'
        ? `/profile/${identifier}`
        : `/store/${identifier}`;
      setFormData(prev => ({
        ...prev,
        link: linkUrl,
      }));
    }
  };

  // Clear selected user and reset to manual mode
  const handleClearSelectedUser = () => {
    setSelectedUser(null);
    setIsUserLinkMode(false);
  };

  // Function to handle modal close with clean state
  const handleModalClose = () => {
    // Clean up by explicitly clearing form data
    // to avoid stale state on next open
    setFormData({
      id: uuidv4(),
      title: "",
      description: "",
      image: "",
      link: "",
    });
    setIsSaving(false);
    setSaveStatus('idle');
    // Reset user linking state
    setIsUserLinkMode(false);
    setUserSearchQuery("");
    setUserSearchResults([]);
    setSelectedUser(null);
    setLinkDestination('profile');
    onClose();
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    try {
      const { name, value } = e.target;
      console.log(`Updating ${name} field with value:`, value);
      console.log("Current formData:", formData);
      
      // Safely update state
      setFormData((prev) => {
        const newState = { ...prev, [name]: value };
        console.log("New formData will be:", newState);
        return newState;
      });
    } catch (error) {
      console.error("Error in handleChange:", error);
    }
  };

  const handleImageChange = (imageData: string) => {
    try {
      console.log("Updating image data, length:", imageData?.length || 0);
      
      // Safely update state
      setFormData((prev) => {
        const newState = { ...prev, image: imageData };
        return newState;
      });
    } catch (error) {
      console.error("Error in handleImageChange:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title.trim()) {
      alert("Title is required");
      return;
    }
    
    if (!formData.image) {
      alert("Image is required");
      return;
    }
    
    try {
      setIsSaving(true);
      setSaveStatus('saving');
      
      // Call the save function
      await onSave(formData);
      
      // Show success state
      setSaveStatus('complete');
      
      // Detect if it's a GIF for longer delay (though Spotlight typically uses static images)
      const isGif = formData.image?.startsWith('data:image/gif') || 
                   formData.image?.includes('.gif') ||
                   formData.image?.toLowerCase().includes('gif');
      
      // GIFs need more time to load and render in the card
      const delay = isGif ? 3500 : 1500;
      
      // Brief delay to show success message, then close
      setTimeout(() => {
        setIsSaving(false);
        setSaveStatus('idle');
        onClose();
      }, delay);
      
    } catch (error) {
      console.error('Save failed:', error);
      setIsSaving(false);
      setSaveStatus('idle');
      alert('Failed to save item. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleModalClose}
      title={item ? "Edit Spotlight Item" : "Add Spotlight Item"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Title*
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter title"
            className="input-field"
            required
          />
        </div>

        <div>
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter description"
            rows={3}
            className="textarea-field resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Image*
          </label>
          <ImageUploader
            initialImage={formData.image}
            onImageChange={handleImageChange}
            aspectRatio="square"
            section="spotlight"
            hideToggle={true}
          />
        </div>

        {/* Link Section - with user linking option */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="link"
              className="block text-sm font-medium text-gray-300"
            >
              Link (optional)
            </label>
            {!selectedUser && (
              <button
                type="button"
                onClick={() => setIsUserLinkMode(!isUserLinkMode)}
                className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors ${
                  isUserLinkMode
                    ? 'bg-[#81E4F2]/20 text-[#81E4F2] border border-[#81E4F2]/50'
                    : 'bg-slate-700 text-gray-400 hover:text-white hover:bg-slate-600'
                }`}
              >
                <Users size={12} />
                <span>Link to mixmi user</span>
              </button>
            )}
          </div>

          {/* Selected User Display */}
          {selectedUser && (
            <div className="mb-2 p-3 bg-slate-800 rounded-lg border border-[#81E4F2]/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {selectedUser.avatarUrl ? (
                    <img
                      src={selectedUser.avatarUrl}
                      alt={selectedUser.displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center">
                      <Users size={16} className="text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="text-white font-medium">{selectedUser.displayName}</div>
                    {selectedUser.username && (
                      <div className="text-gray-400 text-xs">@{selectedUser.username}</div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearSelectedUser}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Profile/Store Toggle */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleDestinationChange('profile')}
                  className={`flex-1 py-1.5 px-3 text-xs rounded-md transition-colors ${
                    linkDestination === 'profile'
                      ? 'bg-[#81E4F2] text-slate-900 font-semibold'
                      : 'bg-slate-700 text-gray-400 hover:text-white'
                  }`}
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => handleDestinationChange('store')}
                  className={`flex-1 py-1.5 px-3 text-xs rounded-md transition-colors ${
                    linkDestination === 'store'
                      ? 'bg-[#81E4F2] text-slate-900 font-semibold'
                      : 'bg-slate-700 text-gray-400 hover:text-white'
                  }`}
                >
                  Creator Store
                </button>
              </div>
            </div>
          )}

          {/* User Search Mode */}
          {isUserLinkMode && !selectedUser && (
            <div className="mb-2 relative">
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                placeholder="Search by name or username..."
                className="input-field"
                autoFocus
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}

              {/* Search Results Dropdown */}
              {userSearchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {userSearchResults.map((user) => (
                    <button
                      key={user.walletAddress}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-slate-700 transition-colors text-left"
                    >
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.displayName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                          <Users size={14} className="text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="text-white text-sm">{user.displayName}</div>
                        {user.username && (
                          <div className="text-gray-400 text-xs">@{user.username}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {userSearchQuery.length >= 2 && !isSearching && userSearchResults.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg p-3 text-center text-gray-400 text-sm">
                  No users found
                </div>
              )}
            </div>
          )}

          {/* Manual URL Input (when not in user link mode or after selection for override) */}
          <input
            type="text"
            id="link"
            name="link"
            value={formData.link}
            onChange={handleChange}
            placeholder={isUserLinkMode ? "Or enter URL manually..." : "https://example.com"}
            className="input-field"
          />
        </div>

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
              <span className={`font-medium text-gray-300 ${
                saveStatus === 'saving' ? 'text-sm' : 
                (formData.image?.startsWith('data:image/gif') || formData.image?.includes('.gif') || formData.image?.toLowerCase().includes('gif'))
                  ? 'text-base' 
                  : 'text-sm'
              }`}>
                {saveStatus === 'saving' ? 'Saving...' : 
                 (formData.image?.startsWith('data:image/gif') || formData.image?.includes('.gif') || formData.image?.toLowerCase().includes('gif'))
                   ? 'GIF will appear momentarily! ✨' 
                   : 'Content will appear momentarily! ✨'}
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