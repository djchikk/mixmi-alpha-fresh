"use client";

import React, { useState, useRef, useEffect } from "react";
import { useToast } from "@/contexts/ToastContext";
import { Instagram, Youtube, Music, Github, Twitch, Clipboard, Edit2, ChevronDown } from "lucide-react";
import { UserProfileService } from "@/lib/userProfileService";
import {
  FaSoundcloud,
  FaMixcloud,
  FaTiktok,
  FaXTwitter
} from "react-icons/fa6";
import ProfileInfoModal from "./ProfileInfoModal";

type StoreLabel = 'Store' | 'Space' | 'Shelf' | 'Spot' | 'Stall';

interface ProfileInfoProps {
  profile: {
    display_name?: string | null;
    tagline?: string | null;
    bio?: string | null;
    show_wallet_address?: boolean;
    show_btc_address?: boolean;
    show_sui_address?: boolean;
    btc_address?: string | null;
    store_label?: StoreLabel | null;
  };
  links: Array<{
    platform: string;
    url: string;
  }>;
  targetWallet: string;
  suiAddress?: string | null;  // SUI address from zkLogin
  personaId?: string | null;   // Active persona ID (for syncing to personas table)
  username?: string;
  hasUploadedTracks: boolean;
  isOwnProfile: boolean;
  onUpdate: () => Promise<void>;
}

const STORE_LABEL_OPTIONS: StoreLabel[] = ['Store', 'Space', 'Shelf', 'Spot', 'Stall'];

export default function ProfileInfo({
  profile,
  links,
  targetWallet,
  suiAddress,
  personaId,
  username,
  hasUploadedTracks,
  isOwnProfile,
  onUpdate
}: ProfileInfoProps) {
  const { showToast } = useToast();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [isUpdatingLabel, setIsUpdatingLabel] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Current store label (default to 'Store' if not set)
  const currentStoreLabel = profile.store_label || 'Store';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLabelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle store label change
  const handleLabelChange = async (newLabel: StoreLabel) => {
    if (newLabel === currentStoreLabel) {
      setShowLabelDropdown(false);
      return;
    }

    setIsUpdatingLabel(true);
    try {
      await UserProfileService.updateProfile(targetWallet, { store_label: newLabel });
      showToast(`Button updated to "${newLabel}"`, 'success');
      setShowLabelDropdown(false);
      await onUpdate();
    } catch (error) {
      console.error('Failed to update store label:', error);
      showToast('Failed to update label', 'error');
    } finally {
      setIsUpdatingLabel(false);
    }
  };
  
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
      {((profile.show_wallet_address && targetWallet) || (profile.show_btc_address && profile.btc_address) || (profile.show_sui_address && suiAddress)) && (
        <div className="flex flex-col items-center gap-2 mb-8 max-w-[350px]">
          {profile.show_sui_address && suiAddress && (
            <div className="bg-[#0f172a] py-2 px-4 rounded-md w-full border border-[#1e293b] flex items-center">
              <span className="text-xs text-gray-500 shrink-0 font-medium">SUI:</span>
              <span className="text-xs text-gray-400 ml-2 truncate flex-1">{`${suiAddress.slice(0, 8)}...${suiAddress.slice(-8)}`}</span>
              <button
                className="text-gray-400 hover:text-[#81E4F2] ml-1 p-1 shrink-0 transition-colors"
                onClick={() => copyToClipboard(suiAddress)}
                title="Copy address"
              >
                <Clipboard size={14} />
              </button>
            </div>
          )}

          {profile.show_wallet_address && targetWallet && (
            <div className="bg-[#0f172a] py-2 px-4 rounded-md w-full border border-[#1e293b] flex items-center">
              <span className="text-xs text-gray-500 shrink-0 font-medium">STX:</span>
              <span className="text-xs text-gray-400 ml-2 truncate flex-1">{`${targetWallet.slice(0, 8)}...${targetWallet.slice(-8)}`}</span>
              <button
                className="text-gray-400 hover:text-[#81E4F2] ml-1 p-1 shrink-0 transition-colors"
                onClick={() => copyToClipboard(targetWallet)}
                title="Copy address"
              >
                <Clipboard size={14} />
              </button>
            </div>
          )}

          {profile.show_btc_address && profile.btc_address && (
            <div className="bg-[#0f172a] py-2 px-4 rounded-md w-full border border-[#1e293b] flex items-center">
              <span className="text-xs text-gray-500 shrink-0 font-medium">BTC:</span>
              <span className="text-xs text-gray-400 ml-2 truncate flex-1">{`${profile.btc_address.slice(0, 8)}...${profile.btc_address.slice(-8)}`}</span>
              <button
                className="text-gray-400 hover:text-[#81E4F2] ml-1 p-1 shrink-0 transition-colors"
                onClick={() => copyToClipboard(profile.btc_address)}
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
          <div className="relative" ref={dropdownRef}>
            {/* Main button - link for visitors, dropdown trigger for owners */}
            {isOwnProfile ? (
              <button
                onClick={() => setShowLabelDropdown(!showLabelDropdown)}
                disabled={isUpdatingLabel}
                className="px-8 py-2 bg-[#061F3C] border-2 border-[#81E4F2] rounded-lg text-[#81E4F2] font-medium hover:shadow-[0_0_20px_rgba(129,228,242,0.5)] transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
              >
                {isUpdatingLabel ? (
                  <div className="w-4 h-4 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {currentStoreLabel}
                    <ChevronDown size={16} className={`transition-transform ${showLabelDropdown ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
            ) : (
              <a
                href={`/store/${username || targetWallet}`}
                className="px-8 py-2 bg-[#061F3C] border-2 border-[#81E4F2] rounded-lg text-[#81E4F2] font-medium hover:shadow-[0_0_20px_rgba(129,228,242,0.5)] transition-all duration-300 inline-block"
              >
                {currentStoreLabel}
              </a>
            )}

            {/* Dropdown for owners */}
            {isOwnProfile && showLabelDropdown && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-[#0f172a] border border-[#81E4F2]/40 rounded-lg shadow-xl overflow-hidden z-50 min-w-[140px]">
                {/* Go to store link */}
                <a
                  href={`/store/${username || targetWallet}`}
                  className="block px-4 py-2 text-sm text-gray-300 hover:bg-[#81E4F2]/10 hover:text-[#81E4F2] border-b border-[#81E4F2]/20"
                >
                  Go to {currentStoreLabel} →
                </a>
                {/* Divider with label */}
                <div className="px-4 py-1.5 text-xs text-gray-500 bg-slate-800/50">
                  Change button label:
                </div>
                {/* Label options */}
                {STORE_LABEL_OPTIONS.map((label) => (
                  <button
                    key={label}
                    onClick={() => handleLabelChange(label)}
                    className={`w-full px-4 py-2 text-sm text-left transition-colors ${
                      label === currentStoreLabel
                        ? 'bg-[#81E4F2]/20 text-[#81E4F2] font-medium'
                        : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {label}
                    {label === currentStoreLabel && ' ✓'}
                  </button>
                ))}
              </div>
            )}
          </div>
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
        suiAddress={suiAddress}
        personaId={personaId}
        onUpdate={onUpdate}
      />
    </>
  );
} 