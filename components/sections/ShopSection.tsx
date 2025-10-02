"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Eye, EyeOff } from 'lucide-react';
import ShopCard from '../cards/ShopCard';
import StoreCard from '../cards/StoreCard';
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

  // Separate store card from regular items
  const savedStoreCard = config.find(item => item.id === 'store-card');
  const regularItems = config.filter(item => item.id !== 'store-card');

  const [items, setItems] = useState<ShopItem[]>(regularItems);
  const [storeCardVisible, setStoreCardVisible] = useState(true);
  const [storeCard, setStoreCard] = useState<ShopItem>(savedStoreCard || {
    id: 'store-card',
    title: 'My Creator Store',
    description: 'Browse my tracks and loops',
    image: ''
  });
  const { showToast } = useToast();

  // Load store card visibility state from localStorage
  useEffect(() => {
    const storedVisibility = localStorage.getItem(`storeCardVisible_${targetWallet}`);
    if (storedVisibility !== null) {
      setStoreCardVisible(JSON.parse(storedVisibility));
    }
  }, [targetWallet]);

  // Save store card visibility state to localStorage
  const toggleStoreCardVisibility = () => {
    const newVisibility = !storeCardVisible;
    setStoreCardVisible(newVisibility);
    localStorage.setItem(`storeCardVisible_${targetWallet}`, JSON.stringify(newVisibility));
  };

  // Calculate display items including store card
  const displayItems = useMemo(() => {
    const allItems: (ShopItem & { isStoreCard?: boolean })[] = [];
    const maxItems = 3; // Maximum 3 items total including store card

    // Add store card if visible
    if (storeCardVisible) {
      allItems.push({ ...storeCard, isStoreCard: true });
    }

    // Add regular shop items up to the limit
    const remainingSlots = maxItems - (storeCardVisible ? 1 : 0);
    const regularItems = items.slice(0, remainingSlots);
    allItems.push(...regularItems);

    return allItems;
  }, [items, storeCard, storeCardVisible]);

  const handleAddItem = () => {
    // Check if we've reached the limit accounting for store card
    const maxRegularItems = storeCardVisible ? 2 : 3;
    if (items.length >= maxRegularItems) {
      showToast(`Maximum ${maxRegularItems} product${maxRegularItems > 1 ? 's' : ''} allowed${storeCardVisible ? ' (plus store card)' : ''}`, 'error');
      return;
    }
    setEditingItem(undefined);
    setIsModalOpen(true);
  };

  const handleEditItem = (item: ShopItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleStoreCardEdit = () => {
    setEditingItem(storeCard);
    setIsModalOpen(true);
  };

  const handleSaveItem = async (item: ShopItem) => {
    try {
      console.log('Saving shop item:', item);

      let updatedRegularItems: ShopItem[];
      let updatedStoreCard: ShopItem = storeCard;

      // Check if we're saving the store card
      if (item.id === 'store-card') {
        updatedStoreCard = item;
        setStoreCard(item);
        updatedRegularItems = items;
      } else if (editingItem && editingItem.id !== 'store-card') {
        // Update existing regular item
        updatedRegularItems = items.map(i => i.id === item.id ? item : i);
      } else {
        // Add new regular item
        updatedRegularItems = [...items, item];
      }

      // Combine store card and regular items for database storage
      const allItemsToSave = [updatedStoreCard, ...updatedRegularItems];
      console.log('Updated shop config to save (including store card):', allItemsToSave);

      // Save to database
      const success = await UserProfileService.updateSectionConfig(
        targetWallet,
        'shop',
        allItemsToSave
      );

      if (success) {
        setItems(updatedRegularItems);
        await onUpdate();
        console.log('Shop section saved successfully (including store card)');
      } else {
        console.error('Failed to save shop section - service returned false');
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

  // Don't render section if no items and no store card and not owner
  if (!isOwnProfile && items.length === 0 && !storeCardVisible) {
    return null;
  }

  return (
    <section className="mb-16">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Shop</h2>
        {isOwnProfile && (
          <div className="flex items-center gap-2">
            <button
              onClick={toggleStoreCardVisibility}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 hover:bg-slate-700 text-gray-300 rounded-lg transition-colors border border-slate-600"
              title={storeCardVisible ? "Hide store card" : "Show store card"}
            >
              {storeCardVisible ? <EyeOff size={16} /> : <Eye size={16} />}
              <span className="text-sm">{storeCardVisible ? 'Hide' : 'Show'} Store</span>
            </button>
            <button
              onClick={handleAddItem}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#81E4F2] rounded-lg transition-colors border border-slate-600"
            >
              <Plus size={18} />
              <span>Add Product</span>
            </button>
          </div>
        )}
      </div>

      {displayItems.length === 0 ? (
        <div
          className="relative w-72 aspect-square rounded-lg overflow-hidden border-2 border-gray-700 bg-slate-800 cursor-pointer hover:border-accent hover:border-[3px] transition-all"
          onClick={isOwnProfile ? handleAddItem : undefined}
        >
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto bg-accent/10 rounded-full flex items-center justify-center mb-4 border border-accent/20">
                <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="text-white font-medium text-sm mb-1">Shop</h3>
              {isOwnProfile && (
                <p className="text-gray-400 text-xs px-4">Showcase your products</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-4 justify-center">
          {displayItems.map(item => {
            if ((item as any).isStoreCard) {
              return (
                <StoreCard
                  key={item.id}
                  storeCard={storeCard}
                  targetWallet={targetWallet}
                  isOwnProfile={isOwnProfile}
                  onEdit={isOwnProfile ? handleStoreCardEdit : undefined}
                  onDelete={isOwnProfile ? toggleStoreCardVisibility : undefined}
                />
              );
            } else {
              return (
                <ShopCard
                  key={item.id}
                  item={item}
                  onEdit={isOwnProfile ? () => handleEditItem(item) : undefined}
                  onDelete={isOwnProfile ? () => handleDeleteItem(item.id) : undefined}
                />
              );
            }
          })}
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