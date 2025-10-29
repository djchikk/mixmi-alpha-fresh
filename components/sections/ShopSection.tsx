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
            className="relative w-72 aspect-square rounded-lg overflow-hidden border-2 border-gray-700 hover:border-accent hover:border-[3px] transition-all group cursor-pointer bg-slate-800"
            onClick={isOwnProfile ? handleAddItem : undefined}
          >
            {/* Empty state background with icon */}
            <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
              <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
                <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>

            {/* Bottom text overlay - same as populated cards */}
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-900/95 to-slate-900/0 transition-opacity duration-300 opacity-100">
              <div className="flex items-start">
                <div className="border-l-2 border-accent pl-2">
                  <h3 className="text-white font-medium text-sm drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">Showcase products, merch, or gated content -- NFTs welcome</h3>
                  <p className="text-gray-200 text-xs mt-1 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">Click to add your first product</p>
                </div>
              </div>
            </div>

            {/* Edit button */}
            {isOwnProfile && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddItem();
                  }}
                  className="bg-slate-800/70 p-1 rounded-full hover:bg-slate-700/80"
                  aria-label="Add Product"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-accent"
                  >
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </button>
              </div>
            )}
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