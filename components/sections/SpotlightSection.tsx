"use client";

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import SpotlightCard from '../cards/SpotlightCard';
import SpotlightItemModal from '../modals/SpotlightItemModal';
import { UserProfileService } from '@/lib/userProfileService';
import { useToast } from '@/contexts/ToastContext';

interface SpotlightItem {
  id: string;
  title: string;
  description: string;
  image: string;
  link?: string;
}

interface SpotlightSectionProps {
  config?: SpotlightItem[];
  isOwnProfile: boolean;
  targetWallet: string;
  onUpdate: () => Promise<void>;
}

export default function SpotlightSection({
  config = [],
  isOwnProfile,
  targetWallet,
  onUpdate
}: SpotlightSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SpotlightItem | undefined>(undefined);
  const [items, setItems] = useState<SpotlightItem[]>(config);
  const { showToast } = useToast();

  const handleAddItem = () => {
    // Check if we've reached the limit of 3 items
    if (items.length >= 3) {
      showToast('Maximum 3 items allowed in Spotlight section', 'error');
      return;
    }
    setEditingItem(undefined);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: SpotlightItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (item: SpotlightItem) => {
    try {
      let updatedItems: SpotlightItem[];

      if (editingItem) {
        // Update existing item
        updatedItems = items.map(i => i.id === item.id ? item : i);
      } else {
        // Add new item
        updatedItems = [...items, item];
      }

      // Save to database
      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'spotlight',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
      } else {
        console.error('Failed to save spotlight items');
      }
    } catch (error) {
      console.error('Error saving spotlight item:', error);
    }

    setIsModalOpen(false);
    setEditingItem(undefined);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this spotlight item?')) return;

    try {
      const updatedItems = items.filter(i => i.id !== itemId);

      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'spotlight',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
      } else {
        console.error('Failed to delete spotlight item');
      }
    } catch (error) {
      console.error('Error deleting spotlight item:', error);
    }
  };

  // Don't render section if no items and not owner
  if (!isOwnProfile && items.length === 0) {
    return null;
  }

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Spotlight</h2>
        {isOwnProfile && (
          <button
            onClick={handleAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#81E4F2] rounded-lg transition-colors border border-slate-600"
          >
            <Plus size={18} />
            <span>Add Item</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div
          className="relative w-72 aspect-square rounded-lg overflow-hidden border-2 border-gray-700 hover:border-accent hover:border-[3px] transition-all group cursor-pointer bg-slate-800"
          onClick={isOwnProfile ? handleAddItem : undefined}
        >
          {/* Empty state background with icon */}
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
              <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          </div>

          {/* Bottom text overlay - same as populated cards */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900/95 to-slate-900/0 transition-opacity duration-300 opacity-100">
            <div className="flex items-start">
              <div className="border-l-2 border-accent pl-2">
                <h3 className="text-white font-medium text-sm drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">Custom cards with image, text, and link</h3>
                <p className="text-gray-200 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">Feature anything: projects, people, or inspiration</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          {items.map(item => (
            <SpotlightCard
              key={item.id}
              item={item}
              onEdit={isOwnProfile ? () => handleEditItem(item) : undefined}
              onDelete={isOwnProfile ? () => handleDeleteItem(item.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Edit/Add Modal */}
      <SpotlightItemModal
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