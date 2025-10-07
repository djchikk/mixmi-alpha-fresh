"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
// Removed profile dependency for alpha version
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/Button";
// SyncStatus not needed for alpha version
import { Menu, X, ShoppingCart } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SignInModal from "../modals/SignInModal";
import IPTrackModal from "../modals/IPTrackModal";

export default function Header() {
  const pathname = usePathname();
  const isGlobePage = pathname === '/';
  const isWelcomePage = pathname === '/welcome';
  const isMixerPage = pathname === '/mixer';
  const isProfilePage = pathname?.startsWith('/profile');
  const isStorePage = pathname?.startsWith('/store');
  
  // Use auth on all pages for wallet functionality
  const { isAuthenticated, connectWallet, disconnectWallet, walletAddress } = useAuth();

  // Alpha version - no profile sync status needed
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Cart state
  const { cart, removeFromCart, clearCart, purchaseAll, cartTotal, purchaseStatus, purchaseError, showPurchaseModal, setShowPurchaseModal } = useCart();
  const [showCartPopover, setShowCartPopover] = useState(false);
  const [cartPinned, setCartPinned] = useState(false);
  const cartPopoverRef = useRef<HTMLDivElement>(null);

  // Fetch username and avatar when wallet connects
  useEffect(() => {
    const fetchUserData = async () => {
      if (!walletAddress) {
        setUsername(null);
        setAvatarUrl(null);
        return;
      }

      const { data } = await supabase
        .from('user_profiles')
        .select('username, avatar_url')
        .eq('wallet_address', walletAddress)
        .single();

      setUsername(data?.username || null);
      setAvatarUrl(data?.avatar_url || null);
    };

    fetchUserData();
  }, [walletAddress]);

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
    <header className="bg-background py-4 px-6 flex items-center fixed top-0 left-0 right-0 z-50 border-b border-border">
      {/* Left: Logo */}
      <div className="flex-1">
        <Link href="/" className="flex items-center">
          <Image 
            src="/logos/logotype-mixmi.svg" 
            alt="Mixmi Logo" 
            width={100} 
            height={32} 
            priority
          />
        </Link>
      </div>

      {/* Center: Navigation */}
      <nav className="hidden md:flex items-center gap-8 font-mono">
        <Link
          href="/"
          className={`transition-all duration-300 tracking-wide ${
            isGlobePage
              ? 'text-white font-bold transform scale-105'
              : 'text-gray-300 hover:text-white hover:scale-105 font-medium active:scale-95'
          }`}
        >
          globe
        </Link>
        <Link
          href="/welcome"
          className={`transition-all duration-300 tracking-wide ${
            isWelcomePage
              ? 'text-white font-bold transform scale-105'
              : 'text-gray-300 hover:text-white hover:scale-105 font-medium active:scale-95'
          }`}
        >
          welcome
        </Link>
        <Link
          href="/mixer"
          className={`transition-all duration-300 tracking-wide ${
            isMixerPage
              ? 'text-white font-bold transform scale-105'
              : 'text-gray-300 hover:text-white hover:scale-105 font-medium active:scale-95'
          }`}
        >
          mixer
        </Link>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="text-gray-300 hover:text-white hover:scale-105 font-medium active:scale-95 transition-all duration-300 tracking-wide"
        >
          upload
        </button>
      </nav>

      {/* Right: Wallet Authentication */}
      <div className="flex-1 flex justify-end items-center gap-4">
        <div className="hidden md:block">
          {isAuthenticated && walletAddress ? (
            <div className="flex items-center gap-3">
              {/* My Profile | My Store links */}
              <div className="flex items-center gap-2 text-sm">
                {/* Avatar */}
                {avatarUrl && (
                  <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-accent/50">
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <Link
                  href={username ? `/profile/${username}` : `/profile/${walletAddress}`}
                  className={`transition-colors ${
                    isProfilePage
                      ? 'text-[#81E4F2] font-semibold'
                      : 'text-[#81E4F2]/70 hover:text-[#81E4F2] font-medium'
                  }`}
                >
                  My Profile
                </Link>
                <span className="text-gray-600">|</span>
                <Link
                  href={username ? `/store/${username}` : `/store/${walletAddress}`}
                  className={`transition-colors ${
                    isStorePage
                      ? 'text-[#81E4F2] font-semibold'
                      : 'text-[#81E4F2]/70 hover:text-[#81E4F2] font-medium'
                  }`}
                >
                  My Store
                </Link>
              </div>

              <div className="text-sm text-gray-300 font-mono">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
              <button
                onClick={disconnectWallet}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsSignInModalOpen(true)}
              className="px-4 py-2 text-sm text-gray-300 font-medium rounded-md border border-white/40 hover:border-[#81E4F2] hover:shadow-[0_0_12px_rgba(129,228,242,0.3)] transition-all"
              style={{ backgroundColor: '#061F3C' }}
            >
              Sign In
            </button>
          )}
        </div>
        
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-gray-300 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-lg z-50">
          <nav className="flex flex-col py-4 px-6 space-y-4">
            <Link
              href="/welcome"
              className={`transition-all duration-300 ${
                isWelcomePage
                  ? 'text-white font-bold'
                  : 'text-gray-300 hover:text-white font-medium active:scale-95'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Welcome
            </Link>

            <Link
              href="/"
              className={`transition-all duration-300 ${
                isGlobePage
                  ? 'text-white font-bold'
                  : 'text-gray-300 hover:text-white font-medium active:scale-95'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Globe
            </Link>

            <Link
              href="/mixer"
              className={`transition-all duration-300 ${
                isMixerPage
                  ? 'text-white font-bold'
                  : 'text-gray-300 hover:text-white font-medium active:scale-95'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Mixer
            </Link>

            <button
              onClick={() => {
                setIsUploadModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="text-gray-300 hover:text-white font-medium active:scale-95 transition-all duration-300 text-left"
            >
              Upload
            </button>

            {/* Mobile Wallet Authentication */}
            <div className="pt-2 border-t border-border">
              {isAuthenticated && walletAddress ? (
                <div className="flex flex-col gap-2">
                  {/* My Profile | My Store links */}
                  <div className="flex items-center gap-2 text-sm">
                    {/* Avatar */}
                    {avatarUrl && (
                      <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-accent/50">
                        <img
                          src={avatarUrl}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <Link
                      href={username ? `/profile/${username}` : `/profile/${walletAddress}`}
                      className={`transition-colors ${
                        isProfilePage
                          ? 'text-[#81E4F2] font-semibold'
                          : 'text-[#81E4F2]/70 hover:text-[#81E4F2] font-medium'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      My Profile
                    </Link>
                    <span className="text-gray-600">|</span>
                    <Link
                      href={username ? `/store/${username}` : `/store/${walletAddress}`}
                      className={`transition-colors ${
                        isStorePage
                          ? 'text-[#81E4F2] font-semibold'
                          : 'text-[#81E4F2]/70 hover:text-[#81E4F2] font-medium'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      My Store
                    </Link>
                  </div>

                  <div className="text-sm text-gray-300 font-mono">
                    {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </div>
                  <button
                    onClick={() => {
                      disconnectWallet();
                      setIsMobileMenuOpen(false);
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors w-fit"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsSignInModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="px-4 py-2 text-sm text-gray-300 font-medium rounded-md border border-white/40 hover:border-[#81E4F2] hover:shadow-[0_0_12px_rgba(129,228,242,0.3)] transition-all w-fit"
                  style={{ backgroundColor: '#061F3C' }}
                >
                  Sign In
                </button>
              )}
            </div>
          </nav>
        </div>
      )}

      {/* Sign In Modal */}
      <SignInModal
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
      />

      {/* Upload Modal */}
      <IPTrackModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSave={() => {
          setIsUploadModalOpen(false);
          // Refresh globe data if on globe page
          if (typeof window !== 'undefined' && (window as any).refreshGlobeData) {
            (window as any).refreshGlobeData();
          }
        }}
      />
    </header>

    {/* Shopping Cart - Fixed top-right, below header, mirroring search position */}
    <div className="fixed top-20 right-4 z-30">
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowCartPopover(!showCartPopover)}
          className="p-1.5 hover:bg-[#1E293B] rounded transition-colors"
        >
          <ShoppingCart className="w-6 h-6 text-gray-200" strokeWidth={2.5} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#81E4F2] text-black text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>

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
                        <span className="text-xs text-[#81E4F2]">{item.price_stx} STX</span>
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
                    <span className="text-sm text-white font-bold">{cartTotal.toFixed(1)} STX</span>
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
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                      title="Purchase all items in cart"
                    >
                      Purchase All ({cartTotal.toFixed(2)} STX)
                    </button>
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
                Please confirm the transaction in your Stacks wallet...
              </p>
              <div className="mt-4 p-3 bg-[#1E293B] rounded">
                <p className="text-xs text-gray-300">Amount: {cartTotal.toFixed(2)} STX</p>
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