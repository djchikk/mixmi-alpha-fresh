"use client";

import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import ShopCard from '../cards/ShopCard';
import ShopItemModal from '../modals/ShopItemModal';
import { UserProfileService } from '@/lib/userProfileService';
import { useToast } from '@/contexts/ToastContext';

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
  const { showToast } = useToast();

  // Sync local state with config prop changes (e.g., after save)
  useEffect(() => {
    setItems(config);
  }, [config]);

  const handleAddItem = () => {
    const maxItems = 3;
    if (items.length >= maxItems) {
      showToast(`Maximum ${maxItems} products allowed`, 'error');
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
      let updatedItems: ShopItem[];

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
        'shop',
        updatedItems
      );

      if (success) {
        setItems(updatedItems);
        await onUpdate();
      } else {
        showToast('Failed to save changes', 'error');
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

  // Don't render section if viewing someone else's profile and they have no items
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

      <div className="flex flex-wrap gap-4">
        {/* Show Shop Items - either populated or empty state */}
        {items.length === 0 ? (
          <div
            className="relative w-72 aspect-square rounded-lg overflow-hidden border-[3px] border-dashed border-gray-600 hover:border-gray-500 transition-all group cursor-pointer bg-[#81E4F2]/5"
            onClick={isOwnProfile ? handleAddItem : undefined}
          >
            {/* Empty state - minimal with subtle cyan wash */}
            <div className="w-full h-full flex items-center justify-center" />

            {/* Bottom text overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900/80 to-transparent">
              <div className="flex items-start">
                <div className="border-l-2 border-gray-500 pl-2">
                  <h3 className="text-gray-300 font-medium text-sm">Showcase products, services, merch, or gated content</h3>
                  <p className="text-gray-400 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to add your first product</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          items.slice(0, 3).map(item => (
            <ShopCard
              key={item.id}
              item={item}
              onEdit={isOwnProfile ? () => handleEditItem(item) : undefined}
              onDelete={isOwnProfile ? () => handleDeleteItem(item.id) : undefined}
            />
          ))
        )}
      </div>

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