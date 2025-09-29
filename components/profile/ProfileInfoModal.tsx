"use client";

import React, { useState, useEffect, useCallback } from "react";
import Modal from "../ui/Modal";
import { UserProfileService } from "@/lib/userProfileService";
import { Instagram, Youtube, Music, Github, Twitch, Plus, X, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { FaSoundcloud, FaMixcloud, FaTiktok, FaXTwitter } from "react-icons/fa6";

interface ProfileInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    username?: string | null;
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
  onUpdate: () => Promise<void>;
}

const SOCIAL_PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'twitter', label: 'X (Twitter)', icon: FaXTwitter },
  { value: 'spotify', label: 'Spotify', icon: Music },
  { value: 'soundcloud', label: 'SoundCloud', icon: FaSoundcloud },
  { value: 'mixcloud', label: 'Mixcloud', icon: FaMixcloud },
  { value: 'tiktok', label: 'TikTok', icon: FaTiktok },
  { value: 'github', label: 'GitHub', icon: Github },
  { value: 'twitch', label: 'Twitch', icon: Twitch },
];

export default function ProfileInfoModal({
  isOpen,
  onClose,
  profile,
  links,
  targetWallet,
  onUpdate
}: ProfileInfoModalProps) {
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    tagline: '',
    bio: '',
    show_wallet_address: false,
    show_btc_address: false
  });
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState<string>('');

  const [socialLinks, setSocialLinks] = useState<Array<{ platform: string; url: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        username: profile.username || '',
        display_name: profile.display_name || '',
        tagline: profile.tagline || '',
        bio: profile.bio || '',
        show_wallet_address: profile.show_wallet_address || false,
        show_btc_address: profile.show_btc_address || false
      });
      setSocialLinks(links || []);
      setErrors({});
      setUsernameStatus('idle');
      setUsernameError('');
    }
  }, [isOpen, profile, links]);

  // Debounced username check
  const checkUsernameAvailability = useCallback(async (username: string) => {
    if (!username || username.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    // Basic format validation first
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_]*$/.test(username)) {
      setUsernameStatus('invalid');
      setUsernameError('Username can only contain letters, numbers, and underscores (cannot start with underscore)');
      return;
    }

    setUsernameStatus('checking');
    setUsernameError('');

    try {
      const response = await fetch('/api/profile/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, currentWallet: targetWallet })
      });

      const result = await response.json();

      if (result.available) {
        setUsernameStatus('available');
        setUsernameError('');
      } else {
        setUsernameStatus('taken');
        setUsernameError(result.error || 'Username is already taken');
      }
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameStatus('invalid');
      setUsernameError('Failed to check username availability');
    }
  }, [targetWallet]);

  // Debounce timer for username check
  useEffect(() => {
    if (formData.username === profile.username) {
      setUsernameStatus('idle'); // Don't check if it's the same as current
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(formData.username);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [formData.username, profile.username, checkUsernameAvailability]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleAddSocialLink = () => {
    setSocialLinks(prev => [...prev, { platform: 'instagram', url: '' }]);
  };

  const handleRemoveSocialLink = (index: number) => {
    setSocialLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSocialLinkChange = (index: number, field: 'platform' | 'url', value: string) => {
    setSocialLinks(prev => prev.map((link, i) =>
      i === index ? { ...link, [field]: value } : link
    ));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Username validation
    if (formData.username && (usernameStatus === 'taken' || usernameStatus === 'invalid')) {
      newErrors.username = usernameError;
    }
    if (formData.username && formData.username.length > 0 && formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }
    if (formData.username && formData.username.length > 30) {
      newErrors.username = 'Username must be 30 characters or less';
    }

    // Character limits
    if (formData.display_name.length > 40) {
      newErrors.display_name = 'Name must be 40 characters or less';
    }
    if (formData.tagline.length > 40) {
      newErrors.tagline = 'Tagline must be 40 characters or less';
    }
    if (formData.bio.length > 350) {
      newErrors.bio = 'Bio must be 350 characters or less';
    }

    // Validate social links
    socialLinks.forEach((link, index) => {
      if (link.url && !link.url.startsWith('http://') && !link.url.startsWith('https://')) {
        newErrors[`link_${index}`] = 'URL must start with http:// or https://';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setIsSaving(true);

      console.log('Saving profile with data:', {
        targetWallet,
        formData,
        socialLinks
      });

      // Update profile info
      const updateResult = await UserProfileService.updateProfile(targetWallet, {
        username: formData.username || null,
        display_name: formData.display_name || null,
        tagline: formData.tagline || null,
        bio: formData.bio || null,
        show_wallet_address: formData.show_wallet_address,
        show_btc_address: formData.show_btc_address
      });

      console.log('Profile update result:', updateResult);

      // Update social links
      const validLinks = socialLinks.filter(link => link.url);
      const linksResult = await UserProfileService.updateLinks(targetWallet, validLinks);
      console.log('Links update result:', linksResult);

      // Refresh the parent component
      await onUpdate();

      // Close modal after successful save
      onClose();

    } catch (error) {
      console.error('Failed to save profile info - Full error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        error
      });
      alert('Failed to save profile information. Please check the console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const found = SOCIAL_PLATFORMS.find(p => p.value === platform);
    return found ? found.icon : Music;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile Information">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* Username Field with Real-time Validation */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Username <span className="text-xs text-gray-500">(for your profile URL)</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value.toLowerCase())}
              placeholder="username (letters, numbers, underscore)"
              maxLength={30}
              className={`w-full px-3 py-2 pr-10 bg-slate-800 text-white rounded-lg border ${
                usernameStatus === 'available' ? 'border-green-500' :
                usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-red-500' :
                'border-slate-600'
              } focus:outline-none transition-colors`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {usernameStatus === 'checking' && (
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              )}
              {usernameStatus === 'available' && (
                <CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {formData.username ? `mixmi.com/profile/${formData.username}` : 'Choose a unique username'}
            </span>
            {usernameError && (
              <span className="text-xs text-red-400">{usernameError}</span>
            )}
            {usernameStatus === 'available' && (
              <span className="text-xs text-green-400">Available!</span>
            )}
          </div>
        </div>

        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Display Name
          </label>
          <input
            type="text"
            value={formData.display_name}
            onChange={(e) => handleInputChange('display_name', e.target.value)}
            placeholder="Your display name"
            maxLength={40}
            className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-[#81E4F2] focus:outline-none transition-colors"
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {formData.display_name.length}/40 characters
            </span>
            {errors.display_name && (
              <span className="text-xs text-red-400">{errors.display_name}</span>
            )}
          </div>
        </div>

        {/* Tagline Field */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tagline
          </label>
          <input
            type="text"
            value={formData.tagline}
            onChange={(e) => handleInputChange('tagline', e.target.value)}
            placeholder="Your tagline"
            maxLength={40}
            className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-[#81E4F2] focus:outline-none transition-colors"
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {formData.tagline.length}/40 characters
            </span>
            {errors.tagline && (
              <span className="text-xs text-red-400">{errors.tagline}</span>
            )}
          </div>
        </div>

        {/* Bio Field */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Bio
          </label>
          <textarea
            value={formData.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder="Tell us about yourself..."
            maxLength={350}
            rows={4}
            className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-[#81E4F2] focus:outline-none transition-colors resize-none"
          />
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {formData.bio.length}/350 characters
            </span>
            {errors.bio && (
              <span className="text-xs text-red-400">{errors.bio}</span>
            )}
          </div>
        </div>

        {/* Social Links */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-300">
              Social Links
            </label>
            <button
              type="button"
              onClick={handleAddSocialLink}
              className="text-[#81E4F2] hover:text-[#6BC8D6] transition-colors flex items-center gap-1 text-sm"
            >
              <Plus size={16} />
              Add Link
            </button>
          </div>

          <div className="space-y-3">
            {socialLinks.map((link, index) => {
              const Icon = getPlatformIcon(link.platform);
              return (
                <div key={index} className="flex gap-2">
                  <select
                    value={link.platform}
                    onChange={(e) => handleSocialLinkChange(index, 'platform', e.target.value)}
                    className="px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-[#81E4F2] focus:outline-none transition-colors"
                  >
                    {SOCIAL_PLATFORMS.map(platform => (
                      <option key={platform.value} value={platform.value}>
                        {platform.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="url"
                    value={link.url}
                    onChange={(e) => handleSocialLinkChange(index, 'url', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-[#81E4F2] focus:outline-none transition-colors"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveSocialLink(index)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              );
            })}

            {socialLinks.length === 0 && (
              <p className="text-sm text-gray-500 italic">No social links added yet</p>
            )}
          </div>
        </div>

        {/* Wallet Address Settings */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Display Settings
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.show_wallet_address}
              onChange={(e) => handleInputChange('show_wallet_address', e.target.checked)}
              className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-[#81E4F2] focus:ring-[#81E4F2] focus:ring-offset-0"
            />
            <span className="text-sm text-gray-400">Show STX wallet address</span>
          </label>

          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.show_btc_address}
              onChange={(e) => handleInputChange('show_btc_address', e.target.checked)}
              className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-[#81E4F2] focus:ring-[#81E4F2] focus:ring-offset-0"
            />
            <span className="text-sm text-gray-400">Show BTC wallet address</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 bg-slate-800 text-gray-400 border border-slate-600 rounded-lg font-medium hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-[#101726] text-white border-2 border-white rounded-lg font-semibold hover:bg-[#1a2030] hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
}