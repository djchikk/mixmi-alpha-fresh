"use client";

import React, { useState } from "react";
import SafeImage from "../shared/SafeImage";
import ProfileImageModal from "./ProfileImageModal";

interface ProfileImageProps {
  profile: {
    avatar_url?: string | null;  // Changed from 'image' to 'avatar_url' to match DB
    name?: string | null;
  };
  isOwnProfile: boolean;
  targetWallet: string;
  personaId?: string | null;  // Active persona ID (for syncing to personas table)
  onUpdate: () => Promise<void>;
}

export default function ProfileImage({ profile, isOwnProfile, targetWallet, personaId, onUpdate }: ProfileImageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Debug: log personaId when component renders
  console.log('🔧 ProfileImage render - personaId:', personaId, 'isOwnProfile:', isOwnProfile);

  // Handle clicks on the profile image or edit button
  const handleEditClick = () => {
    if (!isOwnProfile) return;
    setIsModalOpen(true);
  };

  // Detect if avatar_url is a video
  const isVideo = profile.avatar_url && (
    profile.avatar_url.includes('.mp4') ||
    profile.avatar_url.includes('.webm') ||
    profile.avatar_url.includes('video/')
  );

  return (
    <>
      <div className="relative w-[400px] h-[400px] mx-auto">
        <div
          className={`w-full h-full rounded-lg border-4 border-accent overflow-hidden group bg-[#151C2A] ${
            isOwnProfile ? "cursor-pointer" : ""
          }`}
          onClick={isOwnProfile ? handleEditClick : undefined}
        >
          <div className="relative w-full h-full">
            {profile.avatar_url ? (
              <div className="relative w-full h-full">
                {isVideo ? (
                  <video
                    src={profile.avatar_url}
                    className="w-full h-full object-cover rounded-[6px]"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onError={() => console.warn('Failed to load profile video:', profile.avatar_url)}
                  />
                ) : (
                  <SafeImage
                    src={profile.avatar_url}
                    alt={profile.name || "Profile"}
                    fill
                    className="object-cover rounded-[6px] transition-opacity duration-200"
                    sizes="400px"
                    priority
                    onError={() => console.warn('Failed to load profile image:', profile.avatar_url)}
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-[#151C2A] flex items-center justify-center">
                {isOwnProfile && (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-12 h-12 text-gray-500 group-hover:text-gray-400 transition-colors"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ProfileImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentImage={profile.avatar_url || undefined}
        targetWallet={targetWallet}
        personaId={personaId}
        onUpdate={onUpdate}
      />
    </>
  );
} 