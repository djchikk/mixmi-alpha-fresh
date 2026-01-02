"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfileService, ProfileData } from '@/lib/userProfileService';
import { supabase } from '@/lib/supabase';
import Header from '@/components/layout/Header';
// ProfileHeader not currently used
import ProfileInfo from '@/components/profile/ProfileInfo';
import ProfileImage from '@/components/profile/ProfileImage';
import SectionManager from '@/components/profile/SectionManager';
import SpotlightSection from '@/components/sections/SpotlightSection';
import MediaSection from '@/components/sections/MediaSection';
import ShopSection from '@/components/sections/ShopSection';
import GallerySection from '@/components/sections/GallerySection';
import ProfileSticker from '@/components/profile/ProfileSticker';

export default function UserProfilePage() {
  const params = useParams();
  const { walletAddress: currentUserWallet, suiAddress, personas, activePersona } = useAuth();
  // Decode URL-encoded characters (supports international usernames like Korean, Japanese, etc.)
  const identifier = decodeURIComponent(params.walletAddress as string);

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [targetWallet, setTargetWallet] = useState<string>('');
  const [artistName, setArtistName] = useState<string>('New User');
  const [hasUploadedTracks, setHasUploadedTracks] = useState(false);
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [profilePersonaId, setProfilePersonaId] = useState<string | null>(null); // The persona ID for this profile (not activePersona)

  // Check if this is the user's own profile:
  // 1. Wallet matches directly
  // 2. Profile's account_id matches the user's active persona's account_id
  // 3. The identifier is a username that matches one of the user's personas
  const isOwnProfile = useMemo(() => {
    // Direct wallet match
    if (currentUserWallet && currentUserWallet === targetWallet) {
      return true;
    }

    // Check if profile is linked to user's account via account_id
    if (linkedAccountId && activePersona?.account_id === linkedAccountId) {
      return true;
    }

    // Check if identifier matches one of user's persona usernames
    if (personas.some(p => p.username === identifier)) {
      return true;
    }

    return false;
  }, [currentUserWallet, targetWallet, linkedAccountId, activePersona, personas, identifier]);

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        console.log('Loading profile for identifier:', identifier);

        // First, check if identifier is a persona username and get linked wallet
        let walletFromPersona: string | null = null;
        let foundPersonaId: string | null = null; // Track locally since state updates are async
        if (!identifier.startsWith('SP') && !identifier.startsWith('ST')) {
          // Might be a persona username - check personas table
          const { data: personaData } = await supabase
            .from('personas')
            .select('id, account_id, username, wallet_address')
            .eq('username', identifier)
            .single();

          if (personaData) {
            console.log('Found persona:', personaData.username, 'id:', personaData.id, 'wallet:', personaData.wallet_address);
            setLinkedAccountId(personaData.account_id);
            setProfilePersonaId(personaData.id); // Store the persona ID for this profile
            foundPersonaId = personaData.id;

            // Use the wallet_address directly from the persona
            if (personaData.wallet_address) {
              walletFromPersona = personaData.wallet_address;
              console.log('Using persona wallet:', walletFromPersona);
            }
          }
        }

        // Use linked wallet if found, otherwise use identifier
        const lookupIdentifier = walletFromPersona || identifier;

        // Use the new method that handles both username and wallet
        const data = await UserProfileService.getProfileByIdentifier(lookupIdentifier);
        console.log('Profile data received:', data);

        if (data.profile) {
          // Set the actual wallet address for comparison
          setTargetWallet(data.profile.wallet_address);
          setProfileData(data);

          // Fetch account_id separately (not returned by RPC function)
          const { data: accountData } = await supabase
            .from('user_profiles')
            .select('account_id')
            .eq('wallet_address', data.profile.wallet_address)
            .single();
          if (accountData?.account_id) {
            setLinkedAccountId(accountData.account_id);
          }

          // If we didn't get persona ID from username lookup, try to get it by wallet_address
          if (!foundPersonaId && data.profile.wallet_address) {
            const { data: personaByWallet } = await supabase
              .from('personas')
              .select('id')
              .eq('wallet_address', data.profile.wallet_address)
              .eq('is_active', true)
              .single();
            if (personaByWallet?.id) {
              setProfilePersonaId(personaByWallet.id);
              console.log('Found persona by wallet:', personaByWallet.id);
            }
          }
        } else {
          // If not found by identifier, try by wallet if it looks like a wallet
          if (identifier.startsWith('SP') || identifier.startsWith('ST')) {
            console.log('Trying direct wallet lookup for:', identifier);
            const walletData = await UserProfileService.getProfile(identifier);
            if (walletData.profile) {
              setTargetWallet(identifier);
              setProfileData(walletData);
              // Fetch account_id for persona ownership check
              const { data: accountData } = await supabase
                .from('user_profiles')
                .select('account_id')
                .eq('wallet_address', identifier)
                .single();
              if (accountData?.account_id) {
                setLinkedAccountId(accountData.account_id);
              }
            } else if (currentUserWallet === identifier) {
              // Initialize if it's the current user's profile
              setIsInitializing(true);
              const initialized = await UserProfileService.initializeProfile(currentUserWallet);

              if (initialized) {
                const refreshedData = await UserProfileService.getProfile(currentUserWallet);
                setProfileData(refreshedData);
                setTargetWallet(currentUserWallet);
              }
              setIsInitializing(false);
            } else {
              // Profile doesn't exist but viewing someone else's profile
              setProfileData(walletData);
              setTargetWallet(identifier); // Set targetWallet even if no profile exists
            }
          } else {
            setProfileData(data);
          }
        }

        // Fetch artist name and cover image from first track as fallback
        // Use for profiles that don't exist OR haven't been customized yet
        const walletToCheck = data.profile?.wallet_address || identifier;
        if (walletToCheck.startsWith('SP') || walletToCheck.startsWith('ST')) {
          const { data: tracks } = await supabase
            .from('ip_tracks')
            .select('artist, cover_image_url')
            .eq('primary_uploader_wallet', walletToCheck)
            .order('created_at', { ascending: true })
            .limit(1);

          if (tracks && tracks.length > 0) {
            setHasUploadedTracks(true);
            const hasCustomizedName = data.profile?.display_name && data.profile.display_name !== 'New User';
            const hasCustomizedAvatar = data.profile?.avatar_url;

            // Set artist name as fallback if not customized
            if (tracks[0].artist && !hasCustomizedName) {
              setArtistName(tracks[0].artist);

              // Update profile data with artist name
              setProfileData(prev => ({
                ...prev,
                profile: {
                  ...(prev?.profile || {
                    wallet_address: walletToCheck,
                    tagline: '',
                    bio: '',
                    sticker_id: 'daisy-blue',
                    sticker_visible: true,
                    show_wallet_address: true,
                    show_btc_address: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }),
                  display_name: tracks[0].artist,
                  avatar_url: !hasCustomizedAvatar && tracks[0].cover_image_url ? tracks[0].cover_image_url : prev?.profile?.avatar_url
                } as any
              }));
            } else if (tracks[0].cover_image_url && !hasCustomizedAvatar) {
              // Only update avatar if name was already customized
              setProfileData(prev => ({
                ...prev,
                profile: {
                  ...prev?.profile,
                  avatar_url: tracks[0].cover_image_url
                } as any
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (identifier) {
      loadProfile();
    }
  }, [identifier, currentUserWallet]);

  const refreshProfile = async () => {
    // Use targetWallet for refresh if we have it (handles persona profiles correctly)
    // Otherwise fall back to identifier for initial load case
    const lookupWallet = targetWallet || identifier;

    // For personas, we need to use the wallet directly since the RPC function
    // doesn't search the personas table
    const data = lookupWallet.startsWith('SP') || lookupWallet.startsWith('ST')
      ? await UserProfileService.getProfile(lookupWallet)
      : await UserProfileService.getProfileByIdentifier(lookupWallet);

    if (data.profile) {
      setTargetWallet(data.profile.wallet_address);
    }
    setProfileData(data);
  };

  if (isLoading || isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#151C2A] to-[#101726] pt-16">
        <Header />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2] mx-auto mb-4"></div>
            <p className="text-white">
              {isInitializing ? 'Setting up your profile...' : 'Loading profile...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Instead of showing error, create a graceful default experience
  const profile = profileData?.profile ? {
    ...profileData.profile,
    // Use "..." placeholder if tagline is empty
    tagline: profileData.profile.tagline || '...',
    // Ensure store_label is passed through
    store_label: profileData.profile.store_label || 'Store'
  } : {
    wallet_address: identifier.startsWith('SP') || identifier.startsWith('ST') ? identifier : '',
    display_name: artistName, // Use fetched artist name instead of 'New User'
    tagline: '...', // Minimal, universal placeholder
    bio: '',
    avatar_url: undefined,
    sticker_id: 'daisy-blue',
    sticker_visible: true,
    custom_sticker: undefined,
    show_wallet_address: true,
    show_btc_address: false,
    store_label: 'Store',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const sections = profileData?.sections || [];
  const links = profileData?.links || [];

  const spotlightSection = sections.find(s => s.section_type === 'spotlight');
  const mediaSection = sections.find(s => s.section_type === 'media');
  const shopSection = sections.find(s => s.section_type === 'shop');
  const gallerySection = sections.find(s => s.section_type === 'gallery');

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#151C2A] to-[#101726] pt-16">
      <Header />

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-16 border border-white/10 rounded-lg shadow-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-center md:gap-16">
            <div className="self-center md:self-auto">
              <ProfileImage
                profile={profile}
                isOwnProfile={isOwnProfile}
                targetWallet={targetWallet}
                personaId={isOwnProfile ? profilePersonaId : null}
                onUpdate={refreshProfile}
              />
            </div>
            <div className="flex flex-col md:self-center">
              <div className="flex flex-col items-center text-center max-w-[400px]">
                <ProfileInfo
                  profile={profile}
                  links={links}
                  targetWallet={targetWallet}
                  suiAddress={isOwnProfile ? (activePersona?.sui_address || suiAddress) : null}
                  personaId={isOwnProfile ? profilePersonaId : null}
                  username={(!identifier.startsWith('SP') && !identifier.startsWith('ST')) ? identifier : profileData?.profile?.username}
                  hasUploadedTracks={hasUploadedTracks}
                  isOwnProfile={isOwnProfile}
                  onUpdate={refreshProfile}
                />
              </div>
            </div>
          </div>
        </div>

        {isOwnProfile && (
          <SectionManager
            sections={sections}
            targetWallet={targetWallet}
            stickerVisible={profile.sticker_visible}
            onUpdate={refreshProfile}
          />
        )}

        {spotlightSection?.is_visible && (
          <SpotlightSection
            config={spotlightSection.config}
            isOwnProfile={isOwnProfile}
            targetWallet={targetWallet}
            onUpdate={refreshProfile}
          />
        )}

        {mediaSection?.is_visible && (
          <MediaSection
            config={mediaSection.config}
            isOwnProfile={isOwnProfile}
            targetWallet={targetWallet}
            onUpdate={refreshProfile}
          />
        )}

        {shopSection?.is_visible && (
          <ShopSection
            config={shopSection.config}
            isOwnProfile={isOwnProfile}
            targetWallet={targetWallet}
            onUpdate={refreshProfile}
          />
        )}

        {gallerySection?.is_visible && (
          <GallerySection
            config={gallerySection.config}
            isOwnProfile={isOwnProfile}
            targetWallet={targetWallet}
            onUpdate={refreshProfile}
          />
        )}

        <ProfileSticker
          stickerId={profile.sticker_id}
          stickerVisible={profile.sticker_visible}
          customSticker={profile.custom_sticker}
          isOwnProfile={isOwnProfile}
          targetWallet={targetWallet}
          onUpdate={refreshProfile}
        />
      </div>
    </div>
  );
}