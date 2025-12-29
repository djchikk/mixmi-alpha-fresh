"use client";

import React, { useState, useEffect, useCallback } from "react";
import Modal from "../ui/Modal";
import { UserProfileService } from "@/lib/userProfileService";
import { Instagram, Youtube, Music, Github, Twitch, Plus, X, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { FaSoundcloud, FaMixcloud, FaTiktok, FaXTwitter } from "react-icons/fa6";
import ConfirmDialog from "../ui/ConfirmDialog";
import ToastNotification from "../ui/ToastNotification";

interface ProfileInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    username?: string | null;
    bns_name?: string | null;
    display_name?: string | null;
    tagline?: string | null;
    bio?: string | null;
    show_wallet_address?: boolean;
    show_btc_address?: boolean;
    show_sui_address?: boolean;
  };
  links: Array<{
    platform: string;
    url: string;
  }>;
  targetWallet: string;
  suiAddress?: string | null;  // SUI address from zkLogin (null if not zkLogin user)
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
  suiAddress,
  onUpdate
}: ProfileInfoModalProps) {
  const [formData, setFormData] = useState({
    username: '',
    bns_name: '',
    use_bns: false,
    display_name: '',
    tagline: '',
    bio: '',
    show_wallet_address: false,
    show_btc_address: false,
    show_sui_address: false
  });
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState<string>('');
  const [bnsDetected, setBnsDetected] = useState<string | null>(null);
  const [checkingBns, setCheckingBns] = useState(false);
  const [bnsOwnershipStatus, setBnsOwnershipStatus] = useState<'idle' | 'checking' | 'owned' | 'not-owned'>('idle');

  const [socialLinks, setSocialLinks] = useState<Array<{ platform: string; url: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dialog and Toast states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ isOpen: false, message: '', type: 'info' });

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen) {
      // BNS is temporarily disabled - always use username
      setFormData({
        username: profile.username || profile.bns_name || '', // Use BNS as username if that's all we have
        bns_name: profile.bns_name || '',
        use_bns: false, // Always false while BNS is disabled
        display_name: profile.display_name || '',
        tagline: profile.tagline || '',
        bio: profile.bio || '',
        show_wallet_address: profile.show_wallet_address || false,
        show_btc_address: profile.show_btc_address || false,
        show_sui_address: profile.show_sui_address || false
      });
      setSocialLinks(links || []);
      setErrors({});
      setUsernameStatus('idle');
      setUsernameError('');
      setBnsDetected(null);

      // Always check for BNS name to show it as an option
      checkForBnsName();
    }
  }, [isOpen, profile, links]);

  // Check if wallet has a BNS name
  const checkForBnsName = async () => {
    setCheckingBns(true);
    try {
      const response = await fetch('/api/profile/check-bns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: targetWallet })
      });

      const result = await response.json();
      if (result.found && result.bnsName) {
        setBnsDetected(result.bnsName);
        // Only auto-fill if user has neither username nor BNS set yet
        if (!profile.username && !profile.bns_name) {
          setFormData(prev => ({
            ...prev,
            username: result.bnsName,
            bns_name: result.bnsName,
            use_bns: true
          }));
        } else if (profile.bns_name) {
          // If they already have a BNS name saved, keep it populated
          setFormData(prev => ({
            ...prev,
            bns_name: result.bnsName
          }));
        }
        // Otherwise, just show it as an available option without changing anything
      }
    } catch (error) {
      console.error('Error checking BNS:', error);
    } finally {
      setCheckingBns(false);
    }
  };

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
    // Skip validation if using BNS
    if (formData.use_bns) {
      setUsernameStatus('idle');
      setUsernameError('');
      return;
    }

    if (formData.username === profile.username) {
      setUsernameStatus('idle'); // Don't check if it's the same as current
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(formData.username);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timer);
  }, [formData.username, formData.use_bns, profile.username, checkUsernameAvailability]);

  // Check BNS ownership when typing
  useEffect(() => {
    if (!formData.use_bns) {
      setBnsOwnershipStatus('idle');
      return;
    }

    const bnsName = formData.bns_name || formData.username;
    if (!bnsName || bnsName === profile.bns_name) {
      setBnsOwnershipStatus('idle');
      return;
    }

    const timer = setTimeout(async () => {
      setBnsOwnershipStatus('checking');
      try {
        const BNSResolver = (await import('@/lib/bnsResolver')).default;
        const isOwner = await BNSResolver.verifyBNSOwnership(bnsName, targetWallet);
        setBnsOwnershipStatus(isOwner ? 'owned' : 'not-owned');
      } catch (error) {
        console.error('Error checking BNS ownership:', error);
        setBnsOwnershipStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.bns_name, formData.username, formData.use_bns, profile.bns_name, targetWallet]);

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

    // Username validation (only if not using BNS)
    if (!formData.use_bns) {
      if (formData.username && (usernameStatus === 'taken' || usernameStatus === 'invalid')) {
        newErrors.username = usernameError;
      }
      if (formData.username && formData.username.length > 0 && formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      }
      if (formData.username && formData.username.length > 30) {
        newErrors.username = 'Username must be 30 characters or less';
      }
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

    // Check if URL identifier is changing
    const currentIdentifier = profile.bns_name || profile.username;
    const newIdentifier = formData.use_bns
      ? (formData.bns_name || formData.username)
      : formData.username;

    const isChangingIdentifier = currentIdentifier && newIdentifier &&
                                currentIdentifier !== newIdentifier;

    if (isChangingIdentifier) {
      const confirmMessage =
        `Changing your URL identifier will make your old profile link stop working!\n\n` +
        `Old URL: mixmi.com/profile/${currentIdentifier}\n` +
        `New URL: mixmi.com/profile/${newIdentifier}\n\n` +
        `Your wallet address URL will always work as a backup:\n` +
        `mixmi.com/profile/${targetWallet}`;

      setConfirmDialog({
        isOpen: true,
        title: '⚠️ URL Change Warning',
        message: confirmMessage,
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          proceedWithSave();
        }
      });
      setIsSaving(false);
      return;
    }

    proceedWithSave();
  };

  const proceedWithSave = async () => {
    const currentIdentifier = profile.bns_name || profile.username;
    const newIdentifier = formData.use_bns
      ? (formData.bns_name || formData.username)
      : formData.username;

    const isChangingIdentifier = currentIdentifier && newIdentifier &&
                                currentIdentifier !== newIdentifier;

    try {
      setIsSaving(true);

      console.log('Saving profile with data:', {
        targetWallet,
        formData,
        socialLinks,
        use_bns: formData.use_bns,
        bns_value: formData.bns_name || formData.username
      });

      // If using BNS, verify ownership first
      if (formData.use_bns && (formData.bns_name || formData.username)) {
        const bnsToVerify = formData.bns_name || formData.username;
        console.log('Verifying BNS ownership for:', bnsToVerify);

        // Import BNSResolver dynamically to use it
        const BNSResolver = (await import('@/lib/bnsResolver')).default;
        const isOwner = await BNSResolver.verifyBNSOwnership(bnsToVerify, targetWallet);

        if (!isOwner) {
          setToast({
            isOpen: true,
            message: `You don't own the BNS name "${bnsToVerify}". Only the owner of this BNS name can use it.`,
            type: 'error'
          });
          setIsSaving(false);
          return;
        }
        console.log('BNS ownership verified!');
      }

      // Update profile info
      const profileUpdate = {
        username: formData.use_bns ? null : (formData.username || null),
        bns_name: formData.use_bns ? (formData.bns_name || formData.username || null) : null,
        display_name: formData.display_name || null,
        tagline: formData.tagline || null,
        bio: formData.bio || null,
        show_wallet_address: formData.show_wallet_address,
        show_btc_address: formData.show_btc_address,
        show_sui_address: formData.show_sui_address
      };

      console.log('Profile update payload:', profileUpdate);
      const updateResult = await UserProfileService.updateProfile(targetWallet, profileUpdate);

      console.log('Profile update result:', updateResult);

      // Update social links
      const validLinks = socialLinks.filter(link => link.url);
      const linksResult = await UserProfileService.updateLinks(targetWallet, validLinks);
      console.log('Links update result:', linksResult);

      // Refresh the parent component
      await onUpdate();

      // Show success message with new URL if identifier changed
      if (isChangingIdentifier) {
        setToast({
          isOpen: true,
          message: `Profile updated successfully!\n\nYour new profile URL is:\nmixmi.com/profile/${newIdentifier}\n\nRemember: Your wallet URL always works too:\nmixmi.com/profile/${targetWallet}`,
          type: 'success'
        });
      } else {
        setToast({
          isOpen: true,
          message: 'Profile updated successfully!',
          type: 'success'
        });
      }

      // Close modal after successful save
      onClose();

    } catch (error) {
      console.error('Failed to save profile info - Full error:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        error
      });
      setToast({
        isOpen: true,
        message: `Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    const found = SOCIAL_PLATFORMS.find(p => p.value === platform);
    return found ? found.icon : Music;
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile Information">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto">
        {/* BNS Detection Alert */}
        {bnsDetected && (
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3">
            <p className="text-sm text-blue-300">
              🎉 BNS name detected: <strong>{bnsDetected}</strong>
            </p>
            <p className="text-xs text-blue-400 mt-1">
              {!profile.username && !profile.bns_name
                ? "We've auto-selected BNS for your profile URL. You can switch to a custom username if you prefer."
                : profile.bns_name
                ? "Your BNS name is currently active."
                : "You're using a custom username. Toggle to 'BNS Name' to use your .btc domain instead."}
            </p>
          </div>
        )}

        {/* Username/BNS Toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2 text-left">
            Username (optional)
          </label>

          {/* BNS Toggle temporarily hidden - Sept 2025 API compatibility issues
              TODO: Re-enable when BNS/BNSx API endpoints are clarified */}
          {false && (
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, use_bns: false }))}
                className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                  !formData.use_bns
                    ? 'bg-slate-700 border-[#81E4F2] text-white'
                    : 'bg-slate-800 border-slate-600 text-gray-400 hover:border-slate-500'
                }`}
              >
                Custom Username
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, use_bns: true }))}
                className={`flex-1 py-2 px-3 rounded-lg border transition-colors ${
                  formData.use_bns
                    ? 'bg-slate-700 border-[#81E4F2] text-white'
                    : 'bg-slate-800 border-slate-600 text-gray-400 hover:border-slate-500'
                }`}
              >
                BNS Name (.btc)
              </button>
            </div>
          )}

          {/* Username Field (always shown for now while BNS is disabled) */}
          {true && (
            <div className="relative">
              <input
                type="text"
                value={formData.username}
                onChange={(e) => !suiAddress && handleInputChange('username', e.target.value.toLowerCase())}
                placeholder="Defaults to wallet address"
                maxLength={30}
                disabled={!!suiAddress}
                className={`w-full px-3 py-2 pr-10 bg-slate-800 text-white rounded-lg border ${
                  suiAddress ? 'border-slate-700 opacity-60 cursor-not-allowed' :
                  usernameStatus === 'available' ? 'border-green-500' :
                  usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-red-500' :
                  'border-slate-600'
                } focus:outline-none transition-colors`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {!suiAddress && usernameStatus === 'checking' && (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                )}
                {!suiAddress && usernameStatus === 'available' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {!suiAddress && (usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          )}

          {/* zkLogin username notice */}
          {suiAddress && (
            <p className="text-xs text-amber-400 mt-2">
              Username changes require admin support during alpha. Contact support if you need to change your username.
            </p>
          )}

          {/* BNS Field (hidden while BNS is disabled) */}
          {false && formData.use_bns && (
            <div className="relative">
              <input
                type="text"
                value={formData.bns_name || formData.username}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase();
                  setFormData(prev => ({ ...prev, bns_name: value, username: value }));
                }}
                placeholder="yourname.btc"
                className={`w-full px-3 py-2 pr-10 bg-slate-800 text-white rounded-lg border ${
                  bnsOwnershipStatus === 'owned' ? 'border-green-500' :
                  bnsOwnershipStatus === 'not-owned' ? 'border-red-500' :
                  'border-slate-600'
                } focus:outline-none transition-colors`}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                {bnsOwnershipStatus === 'checking' && (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                )}
                {bnsOwnershipStatus === 'owned' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {bnsOwnershipStatus === 'not-owned' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-500">
              {formData.use_bns
                ? (formData.bns_name || formData.username
                  ? `Your profile URL: mixmi.com/profile/${formData.bns_name || formData.username}`
                  : 'Enter your BNS name')
                : (formData.username
                  ? `Your profile URL: mixmi.com/profile/${formData.username}`
                  : `Your profile URL: mixmi.com/profile/${targetWallet.slice(0, 6)}...`)
              }
            </span>
            {!formData.use_bns && usernameError && (
              <span className="text-xs text-red-400">{usernameError}</span>
            )}
            {!formData.use_bns && usernameStatus === 'available' && (
              <span className="text-xs text-green-400">Available!</span>
            )}
            {formData.use_bns && bnsOwnershipStatus === 'owned' && (
              <span className="text-xs text-green-400">✓ You own this BNS name</span>
            )}
            {formData.use_bns && bnsOwnershipStatus === 'not-owned' && (
              <span className="text-xs text-red-400">✗ You don't own this BNS name</span>
            )}
          </div>
        </div>

        {/* Name Field */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2 text-left">
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
          <label className="block text-sm font-medium text-gray-300 mb-2 text-left">
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
          <label className="block text-sm font-medium text-gray-300 mb-2 text-left">
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
            <label className="block text-sm font-medium text-gray-300 text-left">
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
          <label className="block text-sm font-medium text-gray-300 text-left">
            Display Settings
          </label>

          {/* STX Wallet Toggle - greyed out if no STX wallet linked */}
          <label className={`flex items-center space-x-3 ${targetWallet ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <input
              type="checkbox"
              checked={formData.show_wallet_address}
              onChange={(e) => handleInputChange('show_wallet_address', e.target.checked)}
              disabled={!targetWallet}
              className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-[#81E4F2] focus:ring-[#81E4F2] focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-400">
              Show STX wallet address
              {!targetWallet && <span className="text-xs text-gray-500 ml-2">(No STX wallet linked)</span>}
            </span>
          </label>

          {/* SUI Wallet Toggle - greyed out if no zkLogin */}
          <label className={`flex items-center space-x-3 ${suiAddress ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}>
            <input
              type="checkbox"
              checked={formData.show_sui_address}
              onChange={(e) => handleInputChange('show_sui_address', e.target.checked)}
              disabled={!suiAddress}
              className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-[#81E4F2] focus:ring-[#81E4F2] focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-gray-400">
              Show SUI wallet address
              {!suiAddress && <span className="text-xs text-gray-500 ml-2">(Requires zkLogin)</span>}
            </span>
          </label>

          {/* BTC wallet address option hidden for now */}
          {false && (
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_btc_address}
                onChange={(e) => handleInputChange('show_btc_address', e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-[#81E4F2] focus:ring-[#81E4F2] focus:ring-offset-0"
              />
              <span className="text-sm text-gray-400">Show BTC wallet address</span>
            </label>
          )}
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

    {/* Confirmation Dialog */}
    <ConfirmDialog
      isOpen={confirmDialog.isOpen}
      title={confirmDialog.title}
      message={confirmDialog.message}
      confirmText="Yes, Change It"
      cancelText="Cancel"
      onConfirm={confirmDialog.onConfirm}
      onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      type="warning"
    />

    {/* Toast Notification */}
    {toast.isOpen && (
      <ToastNotification
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
        duration={toast.type === 'success' && toast.message.includes('new profile URL') ? 10000 : 5000}
      />
    )}
  </>
  );
}