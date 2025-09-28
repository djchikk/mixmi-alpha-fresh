"use client";

import React, { useState, useMemo } from 'react';
import { useProfile } from '@/contexts/ProfileContext';
import { useAuth } from '@/contexts/AuthContext';
import ShopCard from '../cards/ShopCard';
import StoreCard from '../cards/StoreCard';
import ShopItemModal from '../modals/ShopItemModal';
import SectionEditorModal from '../modals/SectionEditorModal';
import { ShopItem } from '@/types';
import EmptyItemCard from '../shared/EmptyItemCard';

export default function ShopSection() {
  const { profile, updateProfile, shopItems, addShopItem, updateShopItem, removeShopItem, updateAllShopItems, storeCard, storeCardVisible, updateStoreCard, toggleStoreCardVisibility } = useProfile();
  const { isAuthenticated } = useAuth();
  
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | undefined>(undefined);
  
  const handleEdit = (item: ShopItem) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };
  
  // Special handler for editing from the section editor modal
  const handleEditFromEditor = (item: ShopItem) => {
    // First close the section editor modal
    setIsSectionModalOpen(false);
    
    // Then after a short delay, open the item modal for editing
    setTimeout(() => {
      setEditingItem(item);
      setIsItemModalOpen(true);
    }, 100);
  };
  
  const handleAdd = () => {
    setEditingItem(undefined);
    setIsItemModalOpen(true);
  };
  
  // Special handler for adding from the section editor modal
  const handleAddFromEditor = () => {
    // First close the section editor modal
    setIsSectionModalOpen(false);
    
    // Then after a short delay, open the item modal
    setTimeout(() => {
      setEditingItem(undefined);
      setIsItemModalOpen(true);
    }, 100);
  };
  
  const handleSave = async (item: ShopItem) => {
    console.log('🛒 ShopSection handleSave called with:', { 
      itemId: item.id, 
      itemTitle: item.title,
      imageSize: item.image ? `${(item.image.length / 1024).toFixed(2)}KB` : 'no image',
      editingItemId: editingItem?.id,
      isEditing: !!editingItem 
    });
    
    // Check if we're editing the store card
    if (editingItem?.id === 'store-card') {
      console.log('🏪 Calling updateStoreCard');
      await updateStoreCard(item);
    } else if (editingItem) {
      console.log('🛒 Calling updateShopItem for:', item.id);
      await updateShopItem(editingItem.id, item);
    } else {
      console.log('🛒 Calling addShopItem for new item:', item.id);
      await addShopItem(item);
    }
    
    // Small delay to ensure loading states are visible
    await new Promise(resolve => setTimeout(resolve, 300));
    
    setEditingItem(null);
    setIsItemModalOpen(false);
  };
  
  const handleUpdateItems = (items: ShopItem[]) => {
    // Update all items including their order
    // The store card (if present) maintains its position in the list
    const storeCardItem = items.find(item => item.id === 'store-card');
    
    // Update store card if it was in the list
    if (storeCardItem) {
      updateStoreCard(storeCardItem);
    }
    
    // Update all shop items (including store card for position tracking)
    updateAllShopItems(items);
  };
  
  const handleUpdateSectionTitle = (newTitle: string) => {
    updateProfile({
      sectionTitles: {
        ...profile.sectionTitles,
        shop: newTitle
      }
    });
  };

  // Handle StoreCard edit
  const handleStoreCardEdit = () => {
    if (storeCard) {
      setEditingItem(storeCard);
      setIsItemModalOpen(true);
    }
  };

  // Handle StoreCard visibility toggle
  const handleStoreCardDelete = () => {
    toggleStoreCardVisibility();
  };

  // Create display items list based on what's visible
  // If store card exists in shopItems, use that order; otherwise add it at the beginning
  const displayItems = useMemo(() => {
    const items: ShopItem[] = [];
    const maxItems = 3; // Always max 3 items in shop section
    
    // Check if store card is already in shopItems (from reordering)
    const storeCardInList = shopItems.some(item => item.id === 'store-card');
    
    if (storeCardVisible && storeCard && !storeCardInList) {
      // Add store card at the beginning if not already in the list
      items.push(storeCard);
    }
    
    // Add shop items (may include store card if it was reordered)
    for (const item of shopItems) {
      if (items.length >= maxItems) break;
      
      if (item.id === 'store-card') {
        // Use the store card data from context, but respect the position from shopItems
        if (storeCardVisible && storeCard) {
          items.push(storeCard);
        }
      } else {
        items.push(item);
      }
    }
    
    return items.slice(0, maxItems);
  }, [shopItems, storeCard, storeCardVisible]);
  
  // Items for the modal should be all shop items
  const allItemsForModal = displayItems;
  
  return (
    <section className="max-w-6xl mx-auto mb-20">
      <div className="mb-8">
        <h2 className="text-2xl font-bold uppercase tracking-wider">{profile.sectionTitles.shop}</h2>
        {isAuthenticated && (
          <>
            <p className="text-gray-400 text-sm mt-1 mb-2">Your creator store plus products, services, and token-gated content</p>
            <div className="flex items-center gap-2 mt-2">
              <button 
                onClick={() => setIsSectionModalOpen(true)}
                className="bg-slate-800 hover:bg-slate-700 text-accent px-3 py-1 rounded-md flex items-center space-x-2 transition-colors text-sm"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
                <span>Edit Section</span>
              </button>
              {!storeCardVisible && (
                <button 
                  onClick={handleStoreCardDelete}
                  className="bg-slate-800/50 hover:bg-slate-700 text-gray-300 px-3 py-1 rounded-md flex items-center space-x-2 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Show Store Card</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center mb-4">
        {/* Render items in their saved order */}
        {displayItems.map((item) => {
          if (item.id === 'store-card') {
            return (
              <StoreCard 
                key={item.id}
                onEdit={isAuthenticated ? handleStoreCardEdit : undefined}
                onDelete={isAuthenticated ? handleStoreCardDelete : undefined}
              />
            );
          } else {
            return (
              <ShopCard 
                key={item.id} 
                item={item} 
                onEdit={isAuthenticated ? () => handleEdit(item) : undefined}
                onDelete={isAuthenticated ? () => removeShopItem(item.id) : undefined}
              />
            );
          }
        })}
        
        {/* Add buttons for remaining positions */}
        {isAuthenticated && displayItems.length < 3 && (
          <EmptyItemCard 
            onClick={handleAdd}
            aspectRatio="square"
          />
        )}
        
        {/* Show message when no shop items and not authenticated */}
        {displayItems.length === 0 && !isAuthenticated && (
          <div className="col-span-3 text-center py-8">
            <p className="text-gray-400">Shop items will appear here</p>
          </div>
        )}
      </div>
      
      {/* Individual item edit modal */}
      <ShopItemModal 
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        item={editingItem}
        onSave={handleSave}
      />
      
      {/* Section editor modal with reordering */}
      <SectionEditorModal<ShopItem>
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        title={profile.sectionTitles.shop}
        items={allItemsForModal}
        onUpdateItems={handleUpdateItems}
        onAddItem={handleAddFromEditor}
        onEditItem={handleEditFromEditor}
        onDeleteItem={(id) => {
          if (id === 'store-card') {
            // Hide store card instead of deleting
            toggleStoreCardVisibility();
          } else {
            removeShopItem(id);
          }
        }}
        imageField="image"
        sectionKey="shop"
        onUpdateSectionTitle={handleUpdateSectionTitle}
        maxItems={3}  // Maximum 3 items total in shop section
      />
    </section>
  );
} 