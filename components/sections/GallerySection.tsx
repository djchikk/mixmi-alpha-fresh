"use client";

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import GalleryCard from '../cards/GalleryCard';
import GalleryItemModal from '../modals/GalleryItemModal';
import { UserProfileService } from '@/lib/userProfileService';

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

  const handleAddItem = () => {
    // Check if we've reached the limit of 3 items
    if (items.length >= 3) {
      alert('Maximum 3 items allowed in Gallery section');
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
        <div className="bg-gray-800/30 rounded-lg p-8 text-center">
          <p className="text-gray-400">
            {isOwnProfile
              ? "No images yet. Click 'Add Image' to build your visual gallery."
              : "No gallery images to display."}
          </p>
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