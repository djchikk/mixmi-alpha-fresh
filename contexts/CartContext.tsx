'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getZkLoginSession } from '@/lib/zklogin/session';
import { getZkLoginSignature, genAddressSeed } from '@mysten/sui/zklogin';
import {
  getCurrentNetwork,
  usdcToUnits,
  getUsdcCoins,
  buildSplitPaymentForSponsorship,
  type PaymentRecipient,
} from '@/lib/sui';

// Cart item interface
export interface CartItem {
  id: string;
  title: string;
  artist: string;
  price_usdc: number;  // USDC price (primary)
  price_stx?: string;  // STX price (legacy fallback)
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
  const { walletAddress, suiAddress, authType, isAuthenticated } = useAuth();

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

  const addToCart = async (track: any) => {
    // Check if already in cart
    const exists = cart.some(item => item.id === track.id);
    if (!exists) {
      // Use USDC price (new model) or convert from STX (legacy)
      // Parse as float to handle string values from database
      let rawPriceUsdc = track.download_price_usdc ?? track.price_usdc;

      // If USDC price is missing, fetch fresh from database (handles cached collection data)
      if (rawPriceUsdc == null) {
        // Strip location suffix from multi-location track IDs (e.g., "abc-123-loc-0" -> "abc-123")
        const dbTrackId = track.id.replace(/-loc-\d+$/, '');
        console.log('🛒 USDC price missing, fetching fresh from database for:', dbTrackId);
        try {
          const { data: freshTrack } = await supabase
            .from('ip_tracks')
            .select('download_price_usdc, price_usdc, download_price_stx, price_stx')
            .eq('id', dbTrackId)
            .single();

          if (freshTrack) {
            rawPriceUsdc = freshTrack.download_price_usdc ?? freshTrack.price_usdc;
            console.log('🛒 Fresh price from DB:', { rawPriceUsdc, freshTrack });
          }
        } catch (err) {
          console.warn('🛒 Failed to fetch fresh price:', err);
        }
      }

      const downloadPriceUsdc = rawPriceUsdc != null ? parseFloat(rawPriceUsdc) : 2.00;
      const rawPriceStx = track.download_price_stx ?? track.price_stx;
      const downloadPriceStx = rawPriceStx != null ? parseFloat(rawPriceStx) : 2.5;

      console.log('🛒 Adding to cart:', {
        id: track.id,
        title: track.title,
        download_price_usdc: track.download_price_usdc,
        price_usdc: track.price_usdc,
        finalPriceUsdc: downloadPriceUsdc
      });

      const cartItem: CartItem = {
        id: track.id,
        title: track.title || track.name,
        artist: track.artist || 'Unknown Artist',
        price_usdc: downloadPriceUsdc,
        price_stx: downloadPriceStx.toString(),
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

  /**
   * Purchase with SUI (zkLogin users)
   */
  const purchaseWithSUI = async () => {
    if (!suiAddress) {
      throw new Error('SUI address not available');
    }

    const zkSession = getZkLoginSession();
    if (!zkSession) {
      throw new Error('zkLogin session expired. Please sign in again.');
    }

    console.log('💎 [SUI] Starting SUI purchase flow...');
    console.log('💎 [SUI] Network:', process.env.NEXT_PUBLIC_SUI_NETWORK || 'not set (defaulting to testnet)');
    console.log('💎 [SUI] Buyer address:', suiAddress);
    console.log('💎 [SUI] Session maxEpoch:', zkSession.maxEpoch, '| Session created:', new Date(zkSession.createdAt).toISOString());
    console.log('💎 [SUI] Cart items:', cart.length);

    // Check current epoch vs session maxEpoch
    try {
      const epochResponse = await fetch(`https://fullnode.${process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet'}.sui.io:443`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getLatestSuiSystemState',
          params: [],
        }),
      });
      const epochData = await epochResponse.json();
      const currentEpoch = Number(epochData.result?.epoch || 0);
      console.log('💎 [SUI] Current epoch:', currentEpoch, '| Session maxEpoch:', zkSession.maxEpoch, '| Valid:', currentEpoch < zkSession.maxEpoch);
      if (currentEpoch >= zkSession.maxEpoch) {
        throw new Error(`Session expired. Current epoch ${currentEpoch} >= maxEpoch ${zkSession.maxEpoch}. Please sign out and sign in again.`);
      }
    } catch (epochErr) {
      if (epochErr instanceof Error && epochErr.message.includes('Session expired')) {
        throw epochErr;
      }
      console.warn('💎 [SUI] Could not check epoch:', epochErr);
    }

    // 1. Resolve payment recipients for all tracks
    const trackIds = cart.map(item => item.id);
    console.log('💎 [SUI] Resolving recipients for tracks:', trackIds);

    const resolveResponse = await fetch('/api/sui/resolve-recipients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackIds }),
    });

    if (!resolveResponse.ok) {
      const error = await resolveResponse.json();
      throw new Error(error.error || 'Failed to resolve payment recipients');
    }

    const { tracks } = await resolveResponse.json();
    console.log('💎 [SUI] Resolved tracks:', tracks);

    // 2. Build aggregated payment recipients
    const recipients: PaymentRecipient[] = [];
    const treasuryAmounts: { accountId: string; amount: number }[] = [];
    let platformTotal = 0;

    for (const track of tracks) {
      const cartItem = cart.find(item => item.id === track.trackId);
      if (!cartItem) continue;

      const trackPrice = cartItem.price_usdc;

      // Split: 50% composition, 50% production
      const compositionPool = trackPrice * 0.5;
      const productionPool = trackPrice * 0.5;

      // Process composition splits
      for (const split of track.compositionSplits) {
        const amount = compositionPool * (split.percentage / 100);
        if (split.suiAddress) {
          // Direct payment
          const existing = recipients.find(r => r.address === split.suiAddress);
          if (existing) {
            existing.amountUsdc += amount;
          } else {
            recipients.push({
              address: split.suiAddress,
              amountUsdc: amount,
              label: split.name || split.wallet || 'Collaborator',
            });
          }
        } else {
          // Treasury hold - goes to uploader
          if (track.uploaderAccountId) {
            const existing = treasuryAmounts.find(t => t.accountId === track.uploaderAccountId);
            if (existing) {
              existing.amount += amount;
            } else {
              treasuryAmounts.push({ accountId: track.uploaderAccountId, amount });
            }
          }
          // If no uploader account, add to platform
          platformTotal += amount;
        }
      }

      // Process production splits
      for (const split of track.productionSplits) {
        const amount = productionPool * (split.percentage / 100);
        if (split.suiAddress) {
          // Direct payment
          const existing = recipients.find(r => r.address === split.suiAddress);
          if (existing) {
            existing.amountUsdc += amount;
          } else {
            recipients.push({
              address: split.suiAddress,
              amountUsdc: amount,
              label: split.name || split.wallet || 'Collaborator',
            });
          }
        } else {
          // Treasury hold - goes to uploader
          if (track.uploaderAccountId) {
            const existing = treasuryAmounts.find(t => t.accountId === track.uploaderAccountId);
            if (existing) {
              existing.amount += amount;
            } else {
              treasuryAmounts.push({ accountId: track.uploaderAccountId, amount });
            }
          }
          // If no uploader account, add to platform
          platformTotal += amount;
        }
      }

      // Treasury holds go to uploader's SUI address
      if (track.uploaderSuiAddress) {
        for (const treasury of treasuryAmounts.filter(t => t.accountId === track.uploaderAccountId)) {
          const existing = recipients.find(r => r.address === track.uploaderSuiAddress);
          if (existing) {
            existing.amountUsdc += treasury.amount;
          } else {
            recipients.push({
              address: track.uploaderSuiAddress,
              amountUsdc: treasury.amount,
              label: 'Treasury (held for collaborators)',
            });
          }
        }
      }
    }

    // Add platform fee if any unattributed funds
    if (platformTotal > 0) {
      const platformAddress = process.env.NEXT_PUBLIC_SUI_PLATFORM_ADDRESS;
      if (platformAddress) {
        recipients.push({
          address: platformAddress,
          amountUsdc: platformTotal,
          label: 'Platform',
        });
      }
    }

    console.log('💎 [SUI] Payment recipients:', recipients);

    if (recipients.length === 0) {
      throw new Error('No valid payment recipients found');
    }

    // 3. Check USDC balance
    const network = getCurrentNetwork();
    const coins = await getUsdcCoins(suiAddress, network);

    const totalUsdc = cart.reduce((sum, item) => sum + item.price_usdc, 0);
    const totalUnits = usdcToUnits(totalUsdc);
    const availableBalance = coins.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));

    if (availableBalance < totalUnits) {
      const available = Number(availableBalance) / 1_000_000;
      throw new Error(`Insufficient USDC balance. Need $${totalUsdc.toFixed(2)}, have $${available.toFixed(2)}`);
    }

    console.log('💎 [SUI] Balance check passed:', {
      needed: totalUnits.toString(),
      available: availableBalance.toString(),
    });

    // 4. Build transaction for sponsorship
    const { tx, kindBytes } = await buildSplitPaymentForSponsorship({
      senderAddress: suiAddress,
      recipients,
      network,
    });

    console.log('💎 [SUI] Built transaction, requesting sponsorship...');

    // 5. Request gas sponsorship
    const sponsorResponse = await fetch('/api/sui/sponsor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kindBytes: Buffer.from(kindBytes).toString('base64'),
        senderAddress: suiAddress,
      }),
    });

    if (!sponsorResponse.ok) {
      const error = await sponsorResponse.json();
      throw new Error(error.error || 'Failed to sponsor transaction');
    }

    const { txBytes, sponsorSignature } = await sponsorResponse.json();
    console.log('💎 [SUI] Got sponsorship, signing with zkLogin...');

    // 6. Sign with zkLogin
    const txBytesBuffer = Buffer.from(txBytes, 'base64');

    // Debug: Log session details
    console.log('🔐 [zkLogin] Session details at sign time:', {
      maxEpoch: zkSession.maxEpoch,
      sessionCreated: new Date(zkSession.createdAt).toISOString(),
      ephemeralPubKey: zkSession.ephemeralKeyPair.getPublicKey().toBase64(),
    });

    // Sign with ephemeral keypair
    const ephemeralSignature = await zkSession.ephemeralKeyPair.signTransaction(
      new Uint8Array(txBytesBuffer)
    );
    console.log('🔐 [zkLogin] Ephemeral signature created:', ephemeralSignature.signature.substring(0, 50) + '...');

    // Decode JWT to get claims for addressSeed computation
    const jwtPayload = JSON.parse(atob(zkSession.jwt.split('.')[1]));
    // Handle aud being either string or array
    const aud = Array.isArray(jwtPayload.aud) ? jwtPayload.aud[0] : jwtPayload.aud;
    console.log('🔐 [zkLogin] JWT claims for addressSeed:', { sub: jwtPayload.sub, aud, salt: zkSession.salt.substring(0, 10) + '...' });
    const addressSeed = genAddressSeed(
      BigInt(zkSession.salt),
      'sub',
      jwtPayload.sub,
      aud
    ).toString();
    console.log('🔐 [zkLogin] Computed addressSeed:', addressSeed.substring(0, 20) + '...');

    // Combine with zkProof to create zkLogin signature
    console.log('🔐 [zkLogin] Full debug info:', {
      zkProof: {
        hasProofPoints: !!zkSession.zkProof?.proofPoints,
        proofPointsA: zkSession.zkProof?.proofPoints?.a?.length,
        proofPointsB: zkSession.zkProof?.proofPoints?.b?.length,
        proofPointsC: zkSession.zkProof?.proofPoints?.c?.length,
        hasIssBase64Details: !!zkSession.zkProof?.issBase64Details,
        issValue: zkSession.zkProof?.issBase64Details?.value?.substring(0, 30) + '...',
        indexMod4: zkSession.zkProof?.issBase64Details?.indexMod4,
        hasHeaderBase64: !!zkSession.zkProof?.headerBase64,
        headerBase64: zkSession.zkProof?.headerBase64?.substring(0, 30) + '...',
      },
      session: {
        maxEpoch: zkSession.maxEpoch,
        salt: zkSession.salt?.substring(0, 20) + '...',
        suiAddress: zkSession.suiAddress,
      },
      computed: {
        addressSeed: addressSeed.substring(0, 30) + '...',
        jwtSub: jwtPayload.sub,
        jwtAud: aud,
      },
    });
    const userSignature = getZkLoginSignature({
      inputs: {
        ...zkSession.zkProof,
        addressSeed,
      },
      maxEpoch: zkSession.maxEpoch,
      userSignature: ephemeralSignature.signature,
    });

    console.log('💎 [SUI] Signed, executing transaction...');

    // 7. Execute the sponsored transaction
    const executeResponse = await fetch('/api/sui/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txBytes,
        userSignature,
        sponsorSignature,
        purchaseData: {
          cartItems: cart.map(item => ({
            id: item.id,
            title: item.title,
            price_usdc: item.price_usdc,
          })),
          buyerAddress: suiAddress,
          // Note: buyerPersonaId could be added if we track active persona
        },
      }),
    });

    if (!executeResponse.ok) {
      const error = await executeResponse.json();
      throw new Error(error.error || 'Transaction failed');
    }

    const result = await executeResponse.json();
    console.log('💎 [SUI] Transaction successful:', result);

    return result;
  };

  const purchaseAll = async () => {
    console.log('🛒 Purchase All clicked!', {
      isAuthenticated,
      walletAddress,
      suiAddress,
      authType,
      cartLength: cart.length
    });

    if (!isAuthenticated) {
      console.log('❌ Not authenticated');
      setPurchaseError('Please sign in first');
      setPurchaseStatus('error');
      setShowPurchaseModal(true);
      return;
    }

    if (cart.length === 0) {
      console.log('❌ Cart is empty');
      return;
    }

    try {
      setPurchaseStatus('pending');
      setShowPurchaseModal(true);
      setPurchaseError(null);

      // SUI-only payment flow
      if (authType === 'zklogin' && suiAddress) {
        console.log('🔷 Using SUI payment flow (zkLogin)');
        await purchaseWithSUI();
      } else if (authType === 'wallet' || authType === 'invite') {
        // Stacks wallet users need to migrate to zkLogin
        throw new Error('Purchases now require signing in with Google. Please sign out and sign in with Google to continue.');
      } else {
        throw new Error('Please sign in with Google to make purchases');
      }

      setPurchaseStatus('success');

      // Clear cart after successful transaction
      setTimeout(() => {
        clearCart();
        setShowPurchaseModal(false);
        setPurchaseStatus('idle');
      }, 3000);

    } catch (error) {
      console.error('💥 Purchase error:', error);
      setPurchaseError(error instanceof Error ? error.message : 'Transaction failed');
      setPurchaseStatus('error');
    }
  };

  const isInCart = (trackId: string) => {
    return cart.some(item => item.id === trackId);
  };

  // Cart total in USDC (fallback to price_stx for legacy items)
  const cartTotal = cart.reduce((sum, item) => {
    const price = item.price_usdc || parseFloat(item.price_stx || '0') || 0;
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
