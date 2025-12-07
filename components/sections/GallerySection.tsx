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
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        {items.map(item => (
          <GalleryCard
            key={item.id}
            item={item}
            onEdit={isOwnProfile ? () => handleEditItem(item) : undefined}
            onDelete={isOwnProfile ? () => handleDeleteItem(item.id) : undefined}
          />
        ))}

        {/* Add card placeholder - shown when under limit and is own profile */}
        {isOwnProfile && items.length < 3 && (
          items.length === 0 ? (
            // Empty state - dashed border with text
            <div
              className="relative w-72 aspect-square rounded-lg overflow-hidden border-[3px] border-dashed border-gray-600 hover:border-gray-500 transition-all group cursor-pointer bg-[#81E4F2]/5"
              onClick={handleAddItem}
            >
              {/* Plus icon - shifted up to make room for text */}
              <div className="absolute inset-0 flex items-center justify-center pb-16">
                <Plus size={48} className="text-gray-500 group-hover:text-gray-400 transition-colors" />
              </div>

              {/* Bottom text overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900/80 to-transparent">
                <div className="flex items-start">
                  <div className="border-l-2 border-gray-500 pl-2">
                    <h3 className="text-gray-300 font-medium text-sm">Share images, GIFs, and short videos</h3>
                    <p className="text-gray-400 text-xs mt-1">Up to 3 gallery items</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Add another - minimal, just centered plus
            <div
              className="relative w-72 aspect-square rounded-lg flex items-center justify-center cursor-pointer group"
              onClick={handleAddItem}
            >
              <Plus size={48} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
            </div>
          )
        )}
      </div>

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