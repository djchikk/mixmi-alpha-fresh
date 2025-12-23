"use client";

import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import { useProfile } from "@/contexts/ProfileContext";
import { ProfileData } from "@/types";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  children,
  className = "",
  ...props
}) => {
  const baseClasses = "py-1.5 px-4 rounded-lg font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900";
  
  const variantClasses = {
    primary: "bg-[#101726] text-white border-2 border-white hover:bg-[#1a2030] hover:scale-105 focus:ring-[#81E4F2]",
    secondary: "bg-slate-800 text-gray-400 border border-slate-600 hover:bg-slate-700 hover:text-white focus:ring-[#81E4F2]"
  };
  
  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Character limits for fields
const CHARACTER_LIMITS = {
  name: 40,
  title: 40,
  bio: 350
};

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile } = useProfile();
  const [formData, setFormData] = useState<ProfileData>({
    ...profile,
    // We're managing wallet visibility in a separate modal now
    showWalletAddress: profile.showWalletAddress,
    showBtcAddress: profile.showBtcAddress
  });

  useEffect(() => {
    // Reset form data when modal opens
    if (isOpen) {
      setFormData({
        ...profile,
        // We're managing wallet visibility in a separate modal now
        showWalletAddress: profile.showWalletAddress,
        showBtcAddress: profile.showBtcAddress
      });
    }
  }, [isOpen, profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Apply character limits if needed
    if (CHARACTER_LIMITS[name as keyof typeof CHARACTER_LIMITS]) {
      const limit = CHARACTER_LIMITS[name as keyof typeof CHARACTER_LIMITS];
      if (value.length <= limit) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Preserve existing wallet visibility settings and image
    const updatedProfile = {
      ...formData,
      showWalletAddress: profile.showWalletAddress,
      showBtcAddress: profile.showBtcAddress,
      image: profile.image, // Preserve the image since it's managed separately
      socialLinks: profile.socialLinks // Preserve social links since they're managed separately
    };
    updateProfile(updatedProfile);
    onClose();
  };


  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Edit Profile Details">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                Name
              </label>
              <span className="text-sm text-slate-400">
                {(formData.name?.length || 0)}/{CHARACTER_LIMITS.name}
              </span>
            </div>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name || ''}
              onChange={handleChange}
              className="w-full py-1.5 px-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-[#81E4F2]"
              maxLength={CHARACTER_LIMITS.name}
              placeholder="Choose any display name - change it any time"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="title" className="block text-sm font-medium text-gray-300">
                What You Do
              </label>
              <span className="text-sm text-slate-400">
                {(formData.title?.length || 0)}/{CHARACTER_LIMITS.title}
              </span>
            </div>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title || ''}
              onChange={handleChange}
              className="w-full py-1.5 px-3 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-[#81E4F2]"
              maxLength={CHARACTER_LIMITS.title}
              placeholder="A short description of who you are or what you do"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="bio" className="block text-sm font-medium text-gray-300">
                Bio
              </label>
              <span className="text-sm text-slate-400">
                {(formData.bio?.length || 0)}/{CHARACTER_LIMITS.bio}
              </span>
            </div>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio || ''}
              onChange={handleChange}
              rows={3}
              className="w-full p-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:border-[#81E4F2]"
              maxLength={CHARACTER_LIMITS.bio}
              placeholder="Share a bit about yourself, your work, interests, or anything you'd like others to know"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
  );
};

export default EditProfileModal; 