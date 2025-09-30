"use client";

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import ShopCard from '../cards/ShopCard';
import ShopItemModal from '../modals/ShopItemModal';
import { UserProfileService } from '@/lib/userProfileService';

interface ShopItem {
  id: string;
  title: string;
  description?: string;
  image: string;
  link?: string;
  price?: string;
}

interface ShopSectionProps {
  config?: ShopItem[];
  isOwnProfile: boolean;
  targetWallet: string;
  onUpdate: () => Promise<void>;
}

export default function ShopSection({
  config = [],
  isOwnProfile,
  targetWallet,
  onUpdate
}: ShopSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | undefined>(undefined);
  const [items, setItems] = useState<ShopItem[]>(config);

  const handleAddItem = () => {
    // Check if we've reached the limit of 3 items
    if (items.length >= 3) {
      alert('Maximum 3 items allowed in Shop section');
      return;
    }
    setEditingItem(undefined);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: ShopItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (item: ShopItem) => {
    try {
      console.log('Saving shop item:', item);

      let updatedItems: ShopItem[];

      if (editingItem) {
        // Update existing item
        updatedItems = items.map(i => i.id === item.id ? item : i);
      } else {
        // Add new item
        updatedItems = [...items, item];
      }

      console.log('Updated shop items to save:', updatedItems);

      // Save to database
      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'shop',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
        console.log('Shop items saved successfully');
      } else {
        console.error('Failed to save shop items - service returned false');
        alert('Failed to save shop items. Check console for details.');
      }
    } catch (error) {
      console.error('Error saving shop item:', error);
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    setIsModalOpen(false);
    setEditingItem(undefined);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this shop item?')) return;

    try {
      const updatedItems = items.filter(i => i.id !== itemId);

      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'shop',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
      } else {
        console.error('Failed to delete shop item');
      }
    } catch (error) {
      console.error('Error deleting shop item:', error);
    }
  };

  // Don't render section if no items and not owner
  if (!isOwnProfile && items.length === 0) {
    return null;
  }

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Shop</h2>
        {isOwnProfile && (
          <button
            onClick={handleAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#81E4F2] rounded-lg transition-colors border border-slate-600"
          >
            <Plus size={18} />
            <span>Add Product</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-gray-800/30 rounded-lg p-8 text-center">
          <p className="text-gray-400">
            {isOwnProfile
              ? "No products yet. Click 'Add Product' to showcase items for sale or link to your store."
              : "No products available."}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          {items.map(item => (
            <ShopCard
              key={item.id}
              item={item}
              onEdit={isOwnProfile ? () => handleEditItem(item) : undefined}
              onDelete={isOwnProfile ? () => handleDeleteItem(item.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Edit/Add Modal */}
      <ShopItemModal
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