'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { openSTXTransfer } from '@stacks/connect';
import { useAuth } from '@/contexts/AuthContext';

// Cart item interface
export interface CartItem {
  id: string;
  title: string;
  artist: string;
  price_stx: string;
  license?: string;
  primary_uploader_wallet?: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (track: any) => void;
  removeFromCart: (trackId: string) => void;
  clearCart: () => void;
  purchaseAll: () => Promise<void>;
  isInCart: (trackId: string) => boolean;
  cartTotal: number;
  purchaseStatus: 'idle' | 'pending' | 'success' | 'error';
  purchaseError: string | null;
  showPurchaseModal: boolean;
  setShowPurchaseModal: (show: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const isInitialMount = useRef(true);
  const [purchaseStatus, setPurchaseStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const { walletAddress, isAuthenticated } = useAuth();

  // Load cart from localStorage on mount
  useEffect(() => {
    console.log('🛒 [CART LOAD] Component mounted, loading from localStorage...');
    const savedCart = localStorage.getItem('mixmi-cart');
    console.log('🛒 [CART LOAD] Raw localStorage data:', savedCart);
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart);
        console.log('🛒 [CART LOAD] Parsed cart items:', parsed);
        setCart(parsed);
      } catch (error) {
        console.error('🛒 [CART LOAD] Failed to load cart from localStorage:', error);
      }
    } else {
      console.log('🛒 [CART LOAD] No saved cart found in localStorage');
    }
  }, []);

  // Save cart to localStorage whenever it changes (but skip first render)
  useEffect(() => {
    if (isInitialMount.current) {
      console.log('🛒 [CART SAVE] Skipping save - initial mount');
      isInitialMount.current = false;
      return;
    }
    console.log('🛒 [CART SAVE] Cart changed, current items:', cart.length, cart);
    localStorage.setItem('mixmi-cart', JSON.stringify(cart));
    console.log('🛒 [CART SAVE] Saved to localStorage');
  }, [cart]);

  const addToCart = (track: any) => {
    // Check if already in cart
    const exists = cart.some(item => item.id === track.id);
    if (!exists) {
      console.log('🛒 Adding to cart:', { id: track.id, title: track.title, price_stx: track.price_stx });
      const cartItem: CartItem = {
        id: track.id,
        title: track.title || track.name,
        artist: track.artist || 'Unknown Artist',
        price_stx: track.price_stx?.toString() || '2.5',
        license: track.license || 'Standard',
        primary_uploader_wallet: track.primary_uploader_wallet
      };
      console.log('🛒 Cart item created:', cartItem);
      setCart([...cart, cartItem]);
    }
  };

  const removeFromCart = (trackId: string) => {
    setCart(cart.filter(item => item.id !== trackId));
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('mixmi-cart');
  };

  const purchaseAll = async () => {
    console.log('🛒 Purchase All clicked!', { isAuthenticated, walletAddress, cartLength: cart.length });

    if (!isAuthenticated || !walletAddress) {
      console.log('❌ Wallet not connected');
      setPurchaseError('Please connect your wallet first');
      setPurchaseStatus('error');
      setShowPurchaseModal(true);
      return;
    }

    if (cart.length === 0) {
      console.log('❌ Cart is empty');
      return;
    }

    console.log('✅ Starting purchase flow...');
    try {
      setPurchaseStatus('pending');
      setShowPurchaseModal(true);

      // Use the first track's uploader wallet
      // In production, you'd batch payments or split to multiple artists
      const recipientAddress = cart[0]?.primary_uploader_wallet;

      if (!recipientAddress) {
        console.log('❌ No recipient wallet address found');
        setPurchaseError('Track missing wallet address. Please contact support.');
        setPurchaseStatus('error');
        return;
      }

      // Convert STX to microSTX (1 STX = 1,000,000 microSTX)
      const amountInMicroSTX = Math.floor(cartTotal * 1000000);

      console.log('🔍 Purchase Debug:', {
        cartTotal,
        amountInMicroSTX,
        amountString: amountInMicroSTX.toString(),
        recipient: recipientAddress,
        cart: cart.map(i => ({ id: i.id, price_stx: i.price_stx, title: i.title }))
      });

      await openSTXTransfer({
        recipient: recipientAddress,
        amount: amountInMicroSTX.toString(),
        memo: `Purchase: ${cart.map(item => item.title).join(', ').slice(0, 32)}`,
        onFinish: (data) => {
          console.log('✅ Transaction submitted:', data);
          setPurchaseStatus('success');
          // Clear cart after successful transaction
          setTimeout(() => {
            clearCart();
            setShowPurchaseModal(false);
            setPurchaseStatus('idle');
          }, 3000);
        },
        onCancel: () => {
          console.log('❌ Transaction cancelled');
          setPurchaseStatus('idle');
          setShowPurchaseModal(false);
        }
      });
    } catch (error) {
      console.error('💥 Purchase error:', error);
      setPurchaseError(error instanceof Error ? error.message : 'Transaction failed');
      setPurchaseStatus('error');
    }
  };

  const isInCart = (trackId: string) => {
    return cart.some(item => item.id === trackId);
  };

  const cartTotal = cart.reduce((sum, item) => {
    const price = parseFloat(item.price_stx) || 0;
    return sum + price;
  }, 0);

  // Expose addToCart globally
  useEffect(() => {
    (window as any).addToCart = addToCart;
    return () => {
      delete (window as any).addToCart;
    };
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        clearCart,
        purchaseAll,
        isInCart,
        cartTotal,
        purchaseStatus,
        purchaseError,
        showPurchaseModal,
        setShowPurchaseModal
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
