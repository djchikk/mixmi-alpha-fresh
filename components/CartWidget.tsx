'use client';

import { useState, useRef, useEffect } from 'react';
import { useDrop } from 'react-dnd';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

export default function CartWidget() {
  const {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    cartTotal,
    purchaseAll,
    purchaseStatus,
    purchaseError,
    showPurchaseModal,
    setShowPurchaseModal
  } = useCart();

  const [showCartPopover, setShowCartPopover] = useState(false);
  const [cartPinned, setCartPinned] = useState(false);
  const cartPopoverRef = useRef<HTMLDivElement>(null);

  // Cart drop zone - accepts all track types
  const [{ isOverCart }, cartDropRef] = useDrop({
    accept: ['TRACK_CARD', 'COLLECTION_TRACK', 'TRACK', 'GLOBE_CARD', 'CRATE_TRACK', 'RADIO_TRACK'],
    drop: (item: any) => {
      console.log('🛒 Cart drop received:', item);
      // Handle different drag item structures
      const track = item.track || item;
      addToCart(track);
      setShowCartPopover(true); // Auto-expand cart on drop
    },
    collect: (monitor) => ({
      isOverCart: monitor.isOver(),
    }),
  });

  // Handle click outside cart popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!cartPinned && cartPopoverRef.current && !cartPopoverRef.current.contains(event.target as Node)) {
        setShowCartPopover(false);
      }
    };

    if (showCartPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCartPopover, cartPinned]);

  return (
    <>
      {/* Large invisible drop zone for cart - extends left and down from cart position */}
      <div
        id="onborda-cart"
        ref={cartDropRef}
        className="fixed top-20 right-4 z-[40] w-[200px] h-[200px]"
        style={{ pointerEvents: 'auto' }}
      >
        {/* Cart icon pinned to top-right corner of drop zone */}
        <div className="absolute top-0 right-0">
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCartPopover(!showCartPopover)}
              className={`p-1.5 hover:bg-[#1E293B] rounded transition-all ${isOverCart ? 'animate-wiggle' : ''}`}
              style={isOverCart ? {
                filter: 'drop-shadow(0 0 8px #81E4F2) drop-shadow(0 0 16px #81E4F2)',
              } : {}}
            >
              <ShoppingCart className={`w-6 h-6 transition-colors ${isOverCart ? 'text-[#81E4F2]' : 'text-gray-200'}`} strokeWidth={2.5} />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#81E4F2] text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>

          {/* Cart Popover */}
          {showCartPopover && (
            <div
              ref={cartPopoverRef}
              className="absolute top-full mt-2 right-0 w-80 bg-[#101726]/95 backdrop-blur-sm border border-[#1E293B] rounded-lg shadow-xl"
              style={{ fontFamily: 'monospace' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-3 border-b border-[#1E293B]">
                <span className="text-sm text-white">Cart ({cart.length} items)</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCartPinned(!cartPinned)}
                    className="p-1 hover:bg-[#1E293B] rounded transition-colors"
                    title={cartPinned ? "Unpin cart" : "Pin cart"}
                  >
                    {cartPinned ? '📌' : '📍'}
                  </button>
                  <button
                    onClick={() => setShowCartPopover(false)}
                    className="p-1 hover:bg-[#1E293B] rounded transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Cart Items */}
              {cart.length > 0 ? (
                <>
                  <div className="max-h-60 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="group flex justify-between items-center p-3 hover:bg-[#1E293B]/50 border-b border-[#151C2A] last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-white truncate">{item.title}</div>
                          <div className="text-xs text-gray-500 truncate">{item.artist}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#81E4F2]">${(item.price_usdc || parseFloat(item.price_stx || '0')).toFixed(2)} USDC</span>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#252a3a] rounded transition-all"
                            title="Remove from cart"
                          >
                            <svg className="w-3 h-3 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="p-3 border-t border-[#1E293B]">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-gray-400">Total:</span>
                      <span className="text-sm text-white font-bold">${cartTotal.toFixed(2)} USDC</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={clearCart}
                        className="flex-1 px-3 py-2 bg-[#1E293B] hover:bg-[#252a3a] text-gray-400 hover:text-white rounded text-xs transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={purchaseAll}
                        disabled={purchaseStatus === 'pending'}
                        className={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
                          purchaseStatus === 'pending'
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-[#81E4F2] hover:bg-[#6BC8D6] text-black'
                        }`}
                      >
                        {purchaseStatus === 'pending' ? 'Processing...' : 'Purchase'}
                      </button>
                    </div>
                    {/* Testnet Notice */}
                    <div className="mt-2 p-2 bg-blue-900/30 border border-blue-700/50 rounded text-center">
                      <p className="text-blue-300 text-xs">
                        🧪 Testnet - Using test USDC
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center text-gray-500 text-xs">
                  Cart is empty
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Purchase Status Modal */}
      {showPurchaseModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            // Allow closing by clicking backdrop for error/success states
            if (e.target === e.currentTarget && (purchaseStatus === 'error' || purchaseStatus === 'success')) {
              setShowPurchaseModal(false);
            }
          }}
        >
          <div className="bg-[#101726] border border-[#1E293B] rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            {purchaseStatus === 'pending' && (
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2] mx-auto mb-4"></div>
                <h3 className="text-lg font-bold text-white mb-2">Processing Payment</h3>
                <p className="text-sm text-gray-400">
                  Please confirm the transaction in your wallet...
                </p>
                <div className="mt-4 p-3 bg-[#1E293B] rounded">
                  <p className="text-xs text-gray-300">Amount: ${cartTotal.toFixed(2)} USDC</p>
                  <p className="text-xs text-gray-300 mt-1">Items: {cart.length}</p>
                </div>
                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                  }}
                  className="mt-4 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {purchaseStatus === 'success' && (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Payment Successful!</h3>
                <p className="text-sm text-gray-400">
                  Your transaction has been submitted to the blockchain.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  You'll receive download access once confirmed.
                </p>
              </div>
            )}

            {purchaseStatus === 'error' && (
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Payment Failed</h3>
                <p className="text-sm text-gray-400 mb-4">
                  {purchaseError || 'Something went wrong with your transaction.'}
                </p>
                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                  }}
                  className="px-4 py-2 bg-[#81E4F2] hover:bg-[#6BC8D6] text-black font-medium rounded text-sm transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
