"use client";

import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import ImageUploader from "../shared/ImageUploader";
import { ShopItem } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface ShopItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: ShopItem; // Existing item when editing, undefined when adding new
  onSave: (item: ShopItem) => void;
}

export default function ShopItemModal({
  isOpen,
  onClose,
  item,
  onSave,
}: ShopItemModalProps) {
  const [formData, setFormData] = useState<ShopItem>({
    id: "",
    title: "",
    description: "",
    image: "",
    link: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'complete'>('idle');

  // Reset form data when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      if (item) {
        // Editing existing item
        setFormData({ ...item });
      } else {
        // Adding new item
        setFormData({
          id: uuidv4(),
          title: "",
          description: "",
          image: "",
          link: "",
        });
      }
      setIsSaving(false);
      setSaveStatus('idle');
    }
  }, [isOpen, item]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (imageData: string) => {
    setFormData((prev) => ({ ...prev, image: imageData }));
  };

  const handleModalClose = () => {
    setFormData({
      id: uuidv4(),
      title: "",
      description: "",
      image: "",
      link: "",
    });
    setIsSaving(false);
    setSaveStatus('idle');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title.trim()) {
      alert("Item name is required");
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
      
      // Detect if it's a GIF for longer delay (though Shop typically uses static images)
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
      onClose={onClose}
      title={item?.id === 'store-card' ? "Edit Store Card" : item ? "Edit Shop Item" : "Add Shop Item"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Item Name*
          </label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter item name"
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
            placeholder="Brief description of what you're offering"
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
            section="shop"
          />
        </div>

        {item?.id !== 'store-card' && (
          <div>
            <label
              htmlFor="link"
              className="block text-sm font-medium text-gray-300 mb-1"
            >
              Purchase Link
            </label>
            <input
              type="text"
              id="link"
              name="link"
              value={formData.link}
              onChange={handleChange}
              placeholder="URL where this item can be purchased"
              className="input-field"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the URL where customers can purchase this item
            </p>
          </div>
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
            <span>{item?.id === 'store-card' ? "Save Store Card" : item ? "Save Changes" : "Add Item"}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
} 