'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { openContractCall } from '@stacks/connect';
import { uintCV, listCV, tupleCV, standardPrincipalCV, PostConditionMode } from '@stacks/transactions';
import { aggregateCartPayments } from '@/lib/batch-payment-aggregator';
import { useAuth } from '@/contexts/AuthContext';

// Cart item interface
export interface CartItem {
  id: string;
  title: string;
  artist: string;
  price_stx: string; // Download price (uses download_price_stx from track, legacy price_stx as fallback)
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
      // Use download_price_stx (new model) or fallback to price_stx (legacy)
      const downloadPrice = track.download_price_stx ?? track.price_stx ?? 2.5;
      console.log('🛒 Adding to cart:', {
        id: track.id,
        title: track.title,
        download_price_stx: track.download_price_stx,
        price_stx: track.price_stx,
        finalPrice: downloadPrice
      });
      const cartItem: CartItem = {
        id: track.id,
        title: track.title || track.name,
        artist: track.artist || 'Unknown Artist',
        price_stx: downloadPrice.toString(),
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

    console.log('✅ Starting purchase flow with smart contract...');
    try {
      setPurchaseStatus('pending');
      setShowPurchaseModal(true);

      // Fetch payment splits for all tracks in cart
      const tracksWithSplits = await Promise.all(
        cart.map(async (item) => {
          const response = await fetch(`/api/calculate-payment-splits?trackId=${item.id}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch splits for track ${item.title}`);
          }
          const data = await response.json();
          return {
            trackId: item.id,
            title: item.title,
            totalPriceMicroSTX: Math.floor(parseFloat(item.price_stx) * 1000000),
            compositionSplits: data.compositionSplits,
            productionSplits: data.productionSplits
          };
        })
      );

      console.log('💰 Tracks with splits:', tracksWithSplits);

      // Aggregate all cart payments into single contract call
      const aggregated = aggregateCartPayments(tracksWithSplits);

      console.log('📊 Aggregated payment:', aggregated);

      // Format splits for smart contract
      const compositionCV = listCV(
        aggregated.compositionSplits.map(split =>
          tupleCV({
            wallet: standardPrincipalCV(split.wallet),
            percentage: uintCV(split.percentage)
          })
        )
      );

      const productionCV = listCV(
        aggregated.productionSplits.map(split =>
          tupleCV({
            wallet: standardPrincipalCV(split.wallet),
            percentage: uintCV(split.percentage)
          })
        )
      );

      const contractAddress = process.env.NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT || 'SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN';
      const network = process.env.NEXT_PUBLIC_STACKS_NETWORK || 'mainnet';

      console.log('🔗 Calling contract:', {
        contractAddress,
        network,
        totalMicroSTX: aggregated.totalPriceMicroSTX,
        compositionSplits: aggregated.compositionSplits,
        productionSplits: aggregated.productionSplits
      });

      await openContractCall({
        contractAddress,
        contractName: 'music-payment-splitter-v3',
        functionName: 'split-track-payment',
        functionArgs: [
          uintCV(aggregated.totalPriceMicroSTX),
          compositionCV,
          productionCV
        ],
        postConditionMode: PostConditionMode.Allow,
        onFinish: (data) => {
          console.log('✅ Payment split transaction submitted:', data);
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
