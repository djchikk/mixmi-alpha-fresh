"use client";

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import MediaCard from '../cards/MediaCard';
import MediaItemModal from '../modals/MediaItemModal';
import { UserProfileService } from '@/lib/userProfileService';

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

  const handleAddItem = () => {
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
        <div className="bg-gray-800/30 rounded-lg p-8 text-center">
          <p className="text-gray-400">
            {isOwnProfile
              ? "No media items yet. Click 'Add Media' to embed videos and music from YouTube, Spotify, SoundCloud, and more."
              : "No media items to display."}
          </p>
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