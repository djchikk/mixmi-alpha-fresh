"use client";

import React, { useState, useEffect } from 'react';
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
  const { walletAddress: currentUserWallet } = useAuth();
  const identifier = params.walletAddress as string; // Can be username or wallet

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [targetWallet, setTargetWallet] = useState<string>('');
  const [artistName, setArtistName] = useState<string>('New User');

  const isOwnProfile = currentUserWallet === targetWallet;

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        console.log('Loading profile for identifier:', identifier);

        // Use the new method that handles both username and wallet
        const data = await UserProfileService.getProfileByIdentifier(identifier);
        console.log('Profile data received:', data);

        if (data.profile) {
          // Set the actual wallet address for comparison
          setTargetWallet(data.profile.wallet_address);
          setProfileData(data);
        } else {
          // If not found by identifier, try by wallet if it looks like a wallet
          if (identifier.startsWith('SP') || identifier.startsWith('ST')) {
            console.log('Trying direct wallet lookup for:', identifier);
            const walletData = await UserProfileService.getProfile(identifier);
            if (walletData.profile) {
              setTargetWallet(identifier);
              setProfileData(walletData);
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
              setProfileData(walletData);
            }
          } else {
            setProfileData(data);
          }
        }

        // Fetch artist name and cover image from first track if no profile exists
        if (!data.profile && (identifier.startsWith('SP') || identifier.startsWith('ST'))) {
          const { data: tracks } = await supabase
            .from('ip_tracks')
            .select('artist, cover_image_url')
            .eq('primary_uploader_wallet', identifier)
            .order('created_at', { ascending: true })
            .limit(1);

          if (tracks && tracks.length > 0) {
            if (tracks[0].artist) {
              setArtistName(tracks[0].artist);
            }
            // Cheeky: Use their first track's cover as profile image!
            if (tracks[0].cover_image_url) {
              setProfileData(prev => ({
                ...prev,
                profile: {
                  ...(prev?.profile || {
                    wallet_address: identifier,
                    display_name: tracks[0].artist || 'New User',
                    tagline: '',
                    bio: '',
                    sticker_id: 'daisy-blue',
                    sticker_visible: true,
                    show_wallet_address: true,
                    show_btc_address: false,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }),
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
    const data = await UserProfileService.getProfileByIdentifier(identifier);
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
  const profile = profileData?.profile || {
    wallet_address: identifier.startsWith('SP') || identifier.startsWith('ST') ? identifier : '',
    display_name: artistName, // Use fetched artist name instead of 'New User'
    tagline: '',
    bio: '',
    avatar_url: undefined,
    sticker_id: 'daisy-blue',
    sticker_visible: true,
    custom_sticker: undefined,
    show_wallet_address: true,
    show_btc_address: false,
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
                onUpdate={refreshProfile}
              />
            </div>
            <div className="flex flex-col md:self-center">
              <div className="flex flex-col items-center text-center max-w-[400px]">
                <ProfileInfo
                  profile={profile}
                  links={links}
                  targetWallet={targetWallet}
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