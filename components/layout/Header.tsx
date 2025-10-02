"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
// Removed profile dependency for alpha version
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/Button";
// SyncStatus not needed for alpha version
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SignInModal from "../modals/SignInModal";

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

  return (
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
    </header>
  );
} 