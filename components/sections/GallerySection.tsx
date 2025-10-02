"use client";

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import GalleryCard from '../cards/GalleryCard';
import GalleryItemModal from '../modals/GalleryItemModal';
import { UserProfileService } from '@/lib/userProfileService';
import { useToast } from '@/contexts/ToastContext';

interface GalleryItem {
  id: string;
  image: string;
  caption?: string;
  createdAt?: string;
}

interface GallerySectionProps {
  config?: GalleryItem[];
  isOwnProfile: boolean;
  targetWallet: string;
  onUpdate: () => Promise<void>;
}

export default function GallerySection({
  config = [],
  isOwnProfile,
  targetWallet,
  onUpdate
}: GallerySectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | undefined>(undefined);
  const [items, setItems] = useState<GalleryItem[]>(config);
  const { showToast } = useToast();

  const handleAddItem = () => {
    // Check if we've reached the limit of 3 items
    if (items.length >= 3) {
      showToast('Maximum 3 items allowed in Gallery section', 'error');
      return;
    }
    setEditingItem(undefined);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: GalleryItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (item: GalleryItem) => {
    try {
      console.log('Saving gallery item:', item);

      let updatedItems: GalleryItem[];

      if (editingItem) {
        // Update existing item
        updatedItems = items.map(i => i.id === item.id ? item : i);
      } else {
        // Add new item
        updatedItems = [...items, item];
      }

      console.log('Updated gallery items to save:', updatedItems);

      // Save to database
      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'gallery',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
        console.log('Gallery items saved successfully');
      } else {
        console.error('Failed to save gallery items - service returned false');
        alert('Failed to save gallery items. Check console for details.');
      }
    } catch (error) {
      console.error('Error saving gallery item:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsModalOpen(false);
    setEditingItem(undefined);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this gallery item?')) return;

    try {
      const updatedItems = items.filter(i => i.id !== itemId);

      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'gallery',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
      } else {
        console.error('Failed to delete gallery item');
      }
    } catch (error) {
      console.error('Error deleting gallery item:', error);
    }
  };

  // Don't render section if no items and not owner
  if (!isOwnProfile && items.length === 0) {
    return null;
  }

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Gallery</h2>
        {isOwnProfile && (
          <button
            onClick={handleAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#81E4F2] rounded-lg transition-colors border border-slate-600"
          >
            <Plus size={18} />
            <span>Add Image</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="relative w-72 aspect-square rounded-lg overflow-hidden border-2 border-gray-700 bg-slate-800 cursor-pointer hover:border-accent hover:border-[3px] transition-all"
          onClick={isOwnProfile ? handleAddItem : undefined}
        >
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-accent/10 rounded-full flex items-center justify-center mb-4 border border-accent/20">
                <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-white font-medium text-sm mb-1">Gallery</h3>
              {isOwnProfile && (
                <p className="text-gray-400 text-xs px-4">Share visual moments</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          {items.map(item => (
            <GalleryCard
              key={item.id}
              item={item}
              onEdit={isOwnProfile ? () => handleEditItem(item) : undefined}
              onDelete={isOwnProfile ? () => handleDeleteItem(item.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Edit/Add Modal */}
      <GalleryItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(undefined);
        }}
        item={editingItem}
        onSave={handleSaveItem}
      />
    </section>
  );
}