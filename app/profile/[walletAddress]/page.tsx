"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfileService, ProfileData } from '@/lib/userProfileService';
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
  const targetWallet = params.walletAddress as string;

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);

  const isOwnProfile = currentUserWallet === targetWallet;

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const data = await UserProfileService.getProfile(targetWallet);

        if (!data.profile && isOwnProfile) {
          setIsInitializing(true);
          const initialized = await UserProfileService.initializeProfile(targetWallet);

          if (initialized) {
            const refreshedData = await UserProfileService.getProfile(targetWallet);
            setProfileData(refreshedData);
          }
          setIsInitializing(false);
        } else {
          setProfileData(data);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (targetWallet) {
      loadProfile();
    }
  }, [targetWallet, isOwnProfile]);

  const refreshProfile = async () => {
    const data = await UserProfileService.getProfile(targetWallet);
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

  if (!profileData?.profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#151C2A] to-[#101726] pt-16">
        <Header />
        <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 64px)' }}>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-3">Profile Not Found</h2>
            <p className="text-gray-400">
              {isOwnProfile
                ? 'There was an error setting up your profile. Please try again.'
                : 'This user has not set up their profile yet.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const profile = profileData.profile;
  const sections = profileData.sections;
  const links = profileData.links;

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