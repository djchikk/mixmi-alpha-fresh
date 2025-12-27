"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth, Persona } from "@/contexts/AuthContext";
// Removed profile dependency for alpha version
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/Button";
// SyncStatus not needed for alpha version
import { Menu, X, Radio, ChevronDown, Check, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SignInModal from "../modals/SignInModal";
import IPTrackModal from "../modals/IPTrackModal";
import RadioStationModal from "../modals/RadioStationModal";
import ContentTypeSelector from "../modals/ContentTypeSelector";
import { generateAvatar } from "@/lib/avatarUtils";
import { TourButton } from "../onboarding/TourButton";
import { PRICING } from "@/config/pricing";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isGlobePage = pathname === '/';
  const isWelcomePage = pathname === '/welcome';
  const isMixerPage = pathname === '/mixer';
  const isProfilePage = pathname?.startsWith('/profile');
  const isStorePage = pathname?.startsWith('/store');

  // Use auth on all pages for wallet functionality
  const {
    isAuthenticated,
    connectWallet,
    disconnectWallet,
    walletAddress,
    suiAddress,
    authType,
    personas,
    activePersona,
    setActivePersona
  } = useAuth();

  // For zkLogin users, use suiAddress; for wallet users, use walletAddress
  const effectiveAddress = walletAddress || suiAddress;

  // Display address: prefer SUI address for display (migration to SUI)
  const displayAddress = suiAddress || walletAddress;

  // State for persona picker expansion
  const [showPersonaList, setShowPersonaList] = useState(false);

  // Debug logging
  console.log('🎨 Header auth state:', { isAuthenticated, walletAddress, suiAddress, authType, effectiveAddress });

  // Alpha version - no profile sync status needed
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarThumb48Url, setAvatarThumb48Url] = useState<string | null>(null);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [showUploadTypeModal, setShowUploadTypeModal] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [showAvatarDropdown, setShowAvatarDropdown] = useState(false);
  const avatarDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch username and avatar when user connects (wallet or zkLogin)
  useEffect(() => {
    const fetchUserData = async () => {
      if (!effectiveAddress) {
        setUsername(null);
        setAvatarUrl(null);
        setAvatarThumb48Url(null);
        return;
      }

      // For wallet users, get profile data including thumbnail
      // zkLogin users won't have a profile yet - they'll use DiceBear avatar
      if (walletAddress) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('username, avatar_url, avatar_thumb_48_url')
          .eq('wallet_address', walletAddress)
          .single();

        setUsername(profileData?.username || null);

        // Priority 1: Profile avatar (with thumbnail for small displays)
        if (profileData?.avatar_url) {
          setAvatarUrl(profileData.avatar_url);
          setAvatarThumb48Url(profileData?.avatar_thumb_48_url || null);
          return;
        }

        // Priority 2: First track cover they uploaded
        const { data: trackData } = await supabase
          .from('ip_tracks')
          .select('cover_image_url')
          .eq('primary_uploader_wallet', walletAddress)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (trackData?.cover_image_url) {
          setAvatarUrl(trackData.cover_image_url);
          return;
        }
      }

      // For zkLogin users or users without profile data: use DiceBear (handled in render)
      setAvatarUrl(null);
    };

    fetchUserData();
  }, [effectiveAddress, walletAddress]);

  // Handle click outside avatar dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (avatarDropdownRef.current && !avatarDropdownRef.current.contains(event.target as Node)) {
        setShowAvatarDropdown(false);
        setShowPersonaList(false);
      }
    };

    if (showAvatarDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAvatarDropdown]);

  // Close persona list when dropdown closes
  useEffect(() => {
    if (!showAvatarDropdown) {
      setShowPersonaList(false);
    }
  }, [showAvatarDropdown]);

  // Handle Escape key for upload type modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showUploadTypeModal) {
        setShowUploadTypeModal(false);
      }
    };

    if (showUploadTypeModal) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showUploadTypeModal]);

  return (
    <>
    <header className="bg-background py-4 px-6 flex items-center fixed top-0 left-0 right-0 z-50 border-b border-border">
      {/* Left: Logo */}
      <div className="flex-1">
        <Link href="/" className="flex items-center">
          <Image
            src="/logos/logotype-mixmi.svg"
            alt="mixmi Logo"
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
          sandbox
        </Link>
        <button
          id="onborda-upload"
          onClick={() => {
            if (!isAuthenticated || !effectiveAddress) {
              setIsSignInModalOpen(true);
            } else {
              setShowUploadTypeModal(true);
            }
          }}
          className="text-gray-300 hover:text-white hover:scale-105 font-medium active:scale-95 transition-all duration-300 tracking-wide"
        >
          upload
        </button>
        <button
          onClick={() => {
            if (typeof window !== 'undefined' && (window as any).openHelpWidget) {
              (window as any).openHelpWidget();
            }
          }}
          className="text-gray-300 hover:text-white hover:scale-105 font-medium active:scale-95 transition-all duration-300 tracking-wide"
        >
          help
        </button>
      </nav>

      {/* Right: Wallet Authentication */}
      <div className="flex-1 flex justify-end items-center gap-4">
        <div className="hidden md:block">
          {isAuthenticated && effectiveAddress ? (
            <div className="relative" ref={avatarDropdownRef}>
              {/* Clickable Avatar */}
              <button
                onClick={() => setShowAvatarDropdown(!showAvatarDropdown)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-accent/50">
                  {avatarUrl && (avatarUrl.includes('.mp4') || avatarUrl.includes('.webm') || avatarUrl.includes('video/')) ? (
                    <video
                      src={avatarUrl}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={avatarThumb48Url || avatarUrl || generateAvatar(effectiveAddress || '')}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </button>

              {/* Avatar Dropdown Menu */}
              {showAvatarDropdown && (
                <div className="absolute top-full mt-2 right-0 w-72 bg-[#101726]/95 backdrop-blur-sm border border-[#1E293B] rounded-lg shadow-xl">
                  {/* Active Persona Header - Clickable to expand persona list */}
                  <div className="p-4 border-b border-[#1E293B]">
                    <button
                      onClick={() => setShowPersonaList(!showPersonaList)}
                      className="w-full flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-accent/50 flex-shrink-0">
                        {(activePersona?.avatar_url || avatarUrl) && ((activePersona?.avatar_url || avatarUrl || '').includes('.mp4') || (activePersona?.avatar_url || avatarUrl || '').includes('.webm') || (activePersona?.avatar_url || avatarUrl || '').includes('video/')) ? (
                          <video
                            src={activePersona?.avatar_url || avatarUrl || ''}
                            className="w-full h-full object-cover"
                            autoPlay
                            loop
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={activePersona?.avatar_url || avatarUrl || generateAvatar(effectiveAddress || '')}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-medium text-white truncate">
                          {activePersona?.display_name || activePersona?.username || username || 'mixmi User'}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          {displayAddress ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}` : 'No address'}
                        </div>
                      </div>
                      {personas.length > 1 && (
                        <ChevronDown
                          size={16}
                          className={`text-gray-400 transition-transform ${showPersonaList ? 'rotate-180' : ''}`}
                        />
                      )}
                    </button>
                  </div>

                  {/* Persona List (expandable) */}
                  {showPersonaList && personas.length > 0 && (
                    <div className="py-2 border-b border-[#1E293B]">
                      {personas.map((persona) => (
                        <button
                          key={persona.id}
                          onClick={() => {
                            setActivePersona(persona);
                            setShowPersonaList(false);
                          }}
                          className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-[#1E293B]/50 transition-colors ${
                            activePersona?.id === persona.id ? 'bg-[#1E293B]/30' : ''
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-600 flex-shrink-0">
                            <img
                              src={persona.avatar_url || generateAvatar(persona.username || '')}
                              alt={persona.username || 'Persona'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm text-white truncate">
                              {persona.display_name || persona.username}
                            </div>
                            {persona.username && (
                              <div className="text-xs text-gray-500">@{persona.username}</div>
                            )}
                          </div>
                          {activePersona?.id === persona.id && (
                            <Check size={16} className="text-[#81E4F2] flex-shrink-0" />
                          )}
                        </button>
                      ))}
                      {/* Add Account button - only show if under limit */}
                      {personas.length < PRICING.account.maxPersonas && (
                        <Link
                          href="/account?tab=settings"
                          onClick={() => {
                            setShowAvatarDropdown(false);
                            setShowPersonaList(false);
                          }}
                          className="w-full px-4 py-2 flex items-center gap-3 text-gray-400 hover:text-white hover:bg-[#1E293B]/50 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full border border-dashed border-gray-600 flex items-center justify-center">
                            <Plus size={14} />
                          </div>
                          <span className="text-sm">Add Account</span>
                          <span className="text-xs text-gray-500 ml-auto">
                            {PRICING.account.maxPersonas - personas.length} left
                          </span>
                        </Link>
                      )}
                    </div>
                  )}

                  {/* Menu Items */}
                  <div className="py-1">
                    <Link
                      href={activePersona?.username ? `/profile/${activePersona.username}` : username ? `/profile/${username}` : `/profile/${effectiveAddress}`}
                      className="block w-full px-4 py-3 text-sm text-gray-300 hover:bg-[#1E293B]/50 hover:text-white transition-colors"
                      onClick={() => setShowAvatarDropdown(false)}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-lg">👤</span>
                        <span>My Profile</span>
                      </span>
                    </Link>
                    <Link
                      href={activePersona?.username ? `/store/${activePersona.username}` : username ? `/store/${username}` : `/store/${effectiveAddress}`}
                      className="block w-full px-4 py-3 text-sm text-gray-300 hover:bg-[#1E293B]/50 hover:text-white transition-colors"
                      onClick={() => setShowAvatarDropdown(false)}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-lg">🏪</span>
                        <span>My Store</span>
                      </span>
                    </Link>
                    <Link
                      href="/account"
                      className="block w-full px-4 py-3 text-sm text-gray-300 hover:bg-[#1E293B]/50 hover:text-white transition-colors"
                      onClick={() => setShowAvatarDropdown(false)}
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-lg">📊</span>
                        <span>Dashboard</span>
                      </span>
                    </Link>
                  </div>

                  {/* Disconnect Button */}
                  <div className="p-3 border-t border-[#1E293B]">
                    <button
                      onClick={() => {
                        disconnectWallet();
                        setShowAvatarDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors flex items-center justify-center gap-2"
                    >
                      <span>🚪</span>
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              )}
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
              Sandbox
            </Link>

            <button
              onClick={() => {
                setShowUploadTypeModal(true);
                setIsMobileMenuOpen(false);
              }}
              className="text-gray-300 hover:text-white font-medium active:scale-95 transition-all duration-300 text-left"
            >
              Upload
            </button>

            <button
              onClick={() => {
                if (typeof window !== 'undefined' && (window as any).openHelpWidget) {
                  (window as any).openHelpWidget();
                }
                setIsMobileMenuOpen(false);
              }}
              className="text-gray-300 hover:text-white font-medium active:scale-95 transition-all duration-300 text-left"
            >
              Help
            </button>

            {/* Mobile Wallet Authentication */}
            <div className="pt-2 border-t border-border">
              {isAuthenticated && effectiveAddress ? (
                <div className="flex flex-col gap-3">
                  {/* User Info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-accent/50">
                      {avatarUrl && (avatarUrl.includes('.mp4') || avatarUrl.includes('.webm') || avatarUrl.includes('video/')) ? (
                        <video
                          src={avatarUrl}
                          className="w-full h-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={avatarThumb48Url || avatarUrl || generateAvatar(effectiveAddress || '')}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {username || 'mixmi User'}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">
                        {displayAddress ? `${displayAddress.slice(0, 6)}...${displayAddress.slice(-4)}` : 'No address'}
                      </div>
                    </div>
                  </div>

                  {/* Menu Links */}
                  <div className="flex flex-col gap-2">
                    <Link
                      href={username ? `/profile/${username}` : `/profile/${effectiveAddress}`}
                      className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span>👤</span>
                      <span>My Profile</span>
                    </Link>
                    <Link
                      href={username ? `/store/${username}` : `/store/${effectiveAddress}`}
                      className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span>🏪</span>
                      <span>My Store</span>
                    </Link>
                    <Link
                      href="/account"
                      className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <span>📊</span>
                      <span>Dashboard</span>
                    </Link>
                  </div>

                  <button
                    onClick={() => {
                      disconnectWallet();
                      setIsMobileMenuOpen(false);
                    }}
                    className="px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors w-fit flex items-center gap-2"
                  >
                    <span>🚪</span>
                    <span>Disconnect</span>
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

      {/* Upload Type Selection Modal */}
      <ContentTypeSelector
        isOpen={showUploadTypeModal}
        onClose={() => setShowUploadTypeModal(false)}
        onSelectMusic={() => {
          setShowUploadTypeModal(false);
          setIsUploadModalOpen(true);
        }}
        onSelectRadio={() => {
          setShowUploadTypeModal(false);
          setIsRadioModalOpen(true);
        }}
        onSelectVideo={() => {
          setShowUploadTypeModal(false);
          setIsVideoModalOpen(true);
        }}
        onSelectChat={() => {
          setShowUploadTypeModal(false);
          router.push('/upload-studio');
        }}
      />

      {/* Track Upload Modal */}
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

      {/* Radio Station Upload Modal */}
      <RadioStationModal
        isOpen={isRadioModalOpen}
        onClose={() => setIsRadioModalOpen(false)}
        onUploadComplete={() => {
          setIsRadioModalOpen(false);
          // Refresh globe data if on globe page
          if (typeof window !== 'undefined' && (window as any).refreshGlobeData) {
            (window as any).refreshGlobeData();
          }
        }}
      />

      {/* Video Clip Upload Modal */}
      <IPTrackModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        onSave={() => {
          setIsVideoModalOpen(false);
          // Refresh globe data if on globe page
          if (typeof window !== 'undefined' && (window as any).refreshGlobeData) {
            (window as any).refreshGlobeData();
          }
        }}
        contentCategory="visual"
      />
    </header>
    </>
  );
}
