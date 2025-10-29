"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Instagram, Youtube, Music, Github, Twitch, Clipboard, Edit2 } from "lucide-react";
import {
  FaSoundcloud,
  FaMixcloud,
  FaTiktok,
  FaXTwitter
} from "react-icons/fa6";
import ProfileInfoModal from "./ProfileInfoModal";

interface ProfileInfoProps {
  profile: {
    display_name?: string | null;
    tagline?: string | null;
    bio?: string | null;
    show_wallet_address?: boolean;
    show_btc_address?: boolean;
  };
  links: Array<{
    platform: string;
    url: string;
  }>;
  targetWallet: string;
  username?: string;
  hasUploadedTracks: boolean;
  isOwnProfile: boolean;
  onUpdate: () => Promise<void>;
}

export default function ProfileInfo({
  profile,
  links,
  targetWallet,
  username,
  hasUploadedTracks,
  isOwnProfile,
  onUpdate
}: ProfileInfoProps) {
  const { walletAddress, btcAddress } = useAuth();
  const { showToast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Map social links to their icons
  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'instagram':
        return <Instagram size={20} />;
      case 'youtube':
        return <Youtube size={20} />;
      case 'twitter':
        return <FaXTwitter size={20} />;
      case 'spotify':
        return <Music size={20} />;
      case 'github':
        return <Github size={20} />;
      case 'twitch':
        return <Twitch size={20} />;
      case 'soundcloud':
        return <FaSoundcloud size={20} />;
      case 'mixcloud':
        return <FaMixcloud size={20} />;
      case 'tiktok':
        return <FaTiktok size={20} />;
      default:
        return <Music size={20} />;
    }
  };
  
  // Function to handle wallet address copy
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Address copied to clipboard", "success", 2000);
  };
  
  // Filter and prepare social links
  const socialLinks = links
    ? links.map(link => ({
        icon: getSocialIcon(link.platform),
        url: link.url,
        platform: link.platform
      }))
    : [];

  // Truncate fields with character limits - ensure consistent processing
  const nameText = profile.display_name ? profile.display_name.slice(0, 40) : (isOwnProfile ? "Add Your Name" : "");
  const taglineText = profile.tagline ? profile.tagline.slice(0, 40) : (isOwnProfile ? "Add Your Tagline" : "");
  const bioText = profile.bio ? profile.bio.slice(0, 350) : (isOwnProfile ? "Tell us about yourself..." : "");
  
  return (
    <>
      <div className="flex flex-col items-center text-center relative">
        {/* Edit button positioned at top right of info section */}
        {isOwnProfile && (
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="absolute -top-2 -right-2 p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors border border-slate-600 hover:border-[#81E4F2]"
            title="Edit profile info"
          >
            <Edit2 size={16} className="text-[#81E4F2]" />
          </button>
        )}

        <h1 className="text-3xl font-medium text-accent mb-3" title={profile.display_name}>
          {nameText}
          {profile.display_name && profile.display_name.length > 40 ? "..." : ""}
        </h1>

        <p className="text-xl text-white/90 mb-4" title={profile.tagline}>
          {taglineText}
          {profile.tagline && profile.tagline.length > 40 ? "..." : ""}
        </p>

        <p
          className="text-gray-400 w-full mb-6 line-clamp-3 hover:line-clamp-none transition-all duration-200 cursor-default"
          title={profile.bio && profile.bio.length > 350 ? profile.bio : undefined}
        >
          {bioText}
          {profile.bio && profile.bio.length > 350 ? "..." : ""}
        </p>

        {/* Social links */}
        {(socialLinks.length > 0 || isOwnProfile) && (
          <div className="flex flex-wrap justify-center gap-4 mb-6">
          {socialLinks.length > 0 ? (
            socialLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-[#81E4F2] transition-colors"
                title={link.platform}
              >
                {link.icon}
              </a>
            ))
          ) : isOwnProfile ? (
            <span className="text-gray-500 text-sm italic">No social links added</span>
          ) : null}
        </div>
      )}

      {/* Wallet addresses */}
      {((profile.show_wallet_address && walletAddress) || (profile.show_btc_address && btcAddress)) && (
        <div className="flex flex-col items-center gap-2 mb-8 max-w-[350px]">
          {profile.show_wallet_address && walletAddress && (
            <div className="bg-[#0f172a] py-2 px-4 rounded-md w-full border border-[#1e293b] flex items-center">
              <span className="text-xs text-gray-500 shrink-0 font-medium">STX:</span>
              <span className="text-xs text-gray-400 ml-2 truncate flex-1">{`${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`}</span>
              <button 
                className="text-gray-400 hover:text-[#81E4F2] ml-1 p-1 shrink-0 transition-colors"
                onClick={() => copyToClipboard(walletAddress)}
                title="Copy address"
              >
                <Clipboard size={14} />
              </button>
            </div>
          )}
          
          {profile.show_btc_address && btcAddress && (
            <div className="bg-[#0f172a] py-2 px-4 rounded-md w-full border border-[#1e293b] flex items-center">
              <span className="text-xs text-gray-500 shrink-0 font-medium">BTC:</span>
              <span className="text-xs text-gray-400 ml-2 truncate flex-1">{`${btcAddress.slice(0, 8)}...${btcAddress.slice(-8)}`}</span>
              <button 
                className="text-gray-400 hover:text-[#81E4F2] ml-1 p-1 shrink-0 transition-colors"
                onClick={() => copyToClipboard(btcAddress)}
                title="Copy address"
              >
                <Clipboard size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Store Button */}
      {hasUploadedTracks && (
        <div className="flex justify-center mt-6">
          <a
            href={`/store/${username || targetWallet}`}
            className="px-8 py-3 bg-[#061F3C] border-2 border-[#81E4F2] rounded-lg text-[#81E4F2] font-medium hover:shadow-[0_0_20px_rgba(129,228,242,0.5)] transition-all duration-300"
          >
            Store
          </a>
        </div>
      )}
      </div>

      {/* Profile Info Edit Modal */}
      <ProfileInfoModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        profile={profile}
        links={links}
        targetWallet={targetWallet}
        onUpdate={onUpdate}
      />
    </>
  );
} 