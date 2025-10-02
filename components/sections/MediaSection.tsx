"use client";

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import MediaCard from '../cards/MediaCard';
import MediaItemModal from '../modals/MediaItemModal';
import { UserProfileService } from '@/lib/userProfileService';
import { useToast } from '@/contexts/ToastContext';

interface MediaItem {
  id: string;
  type: string;
  rawUrl: string;
  embedUrl: string;
  title?: string;
  link?: string;
}

interface MediaSectionProps {
  config?: MediaItem[];
  isOwnProfile: boolean;
  targetWallet: string;
  onUpdate: () => Promise<void>;
}

export default function MediaSection({
  config = [],
  isOwnProfile,
  targetWallet,
  onUpdate
}: MediaSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | undefined>(undefined);
  const [items, setItems] = useState<MediaItem[]>(config);
  const { showToast } = useToast();

  const handleAddItem = () => {
    // Check if we've reached the limit of 3 items
    if (items.length >= 3) {
      showToast('Maximum 3 items allowed in Media section', 'error');
      return;
    }
    setEditingItem(undefined);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: MediaItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (item: MediaItem) => {
    try {
      console.log('Saving media item:', item);

      let updatedItems: MediaItem[];

      if (editingItem) {
        // Update existing item
        updatedItems = items.map(i => i.id === item.id ? item : i);
      } else {
        // Add new item
        updatedItems = [...items, item];
      }

      console.log('Updated items to save:', updatedItems);

      // Save to database
      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'media',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
        console.log('Media items saved successfully');
      } else {
        console.error('Failed to save media items - service returned false');
        alert('Failed to save media items. Check console for details.');
      }
    } catch (error) {
      console.error('Error saving media item:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsModalOpen(false);
    setEditingItem(undefined);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this media item?')) return;

    try {
      const updatedItems = items.filter(i => i.id !== itemId);

      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'media',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
      } else {
        console.error('Failed to delete media item');
      }
    } catch (error) {
      console.error('Error deleting media item:', error);
    }
  };

  // Don't render section if no items and not owner
  if (!isOwnProfile && items.length === 0) {
    return null;
  }

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Media</h2>
        {isOwnProfile && (
          <button
            onClick={handleAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#81E4F2] rounded-lg transition-colors border border-slate-600"
          >
            <Plus size={18} />
            <span>Add Media</span>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-white font-medium text-sm mb-1">Media</h3>
              {isOwnProfile && (
                <p className="text-gray-400 text-xs px-4">Embed your content</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          {items.map(item => (
            <MediaCard
              key={item.id}
              item={item}
              onEdit={isOwnProfile ? () => handleEditItem(item) : undefined}
              onDelete={isOwnProfile ? () => handleDeleteItem(item.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Edit/Add Modal */}
      <MediaItemModal
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