"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ConversationalUploader from '@/components/upload-studio/ConversationalUploader';
import Header from '@/components/layout/Header';

export default function UploadStudioPage() {
  const { isAuthenticated, walletAddress, suiAddress, activePersona } = useAuth();
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isApproved, setIsApproved] = useState(false);

  // Determine the effective wallet address (zkLogin users may only have suiAddress)
  // Priority: active persona's wallet > active persona's sui > root suiAddress > legacy walletAddress
  const effectiveWallet = activePersona?.wallet_address || activePersona?.sui_address || suiAddress || walletAddress;
  const hasValidAuth = isAuthenticated && !!effectiveWallet;

  // Check if user is authenticated and approved for alpha
  useEffect(() => {
    const checkApproval = async () => {
      if (!hasValidAuth) {
        setIsCheckingAuth(false);
        return;
      }

      try {
        // For zkLogin users, pass suiAddress for alpha check
        const response = await fetch('/api/auth/alpha-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: effectiveWallet })
        });

        const result = await response.json();
        setIsApproved(result.success);
      } catch (error) {
        console.error('Error checking approval:', error);
        setIsApproved(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkApproval();
  }, [hasValidAuth, effectiveWallet]);

  // Loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#0a0e1a]">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2] mx-auto mb-4"></div>
            <p className="text-gray-400">Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!hasValidAuth) {
    return (
      <div className="min-h-screen bg-[#0a0e1a]">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center max-w-md mx-auto p-8">
            <h1 className="text-2xl font-bold text-white mb-4">Upload Studio</h1>
            <p className="text-gray-400 mb-2">
              Sign in to start uploading your work through our conversational assistant.
            </p>
            <p className="text-gray-500 text-sm">
              Click <span className="text-[#81E4F2]">Sign In</span> in the top right corner to get started.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Not approved for alpha
  if (!isApproved) {
    return (
      <div className="min-h-screen bg-[#0a0e1a]">
        <Header />
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="text-6xl mb-6">🔐</div>
            <h1 className="text-2xl font-bold text-white mb-4">Alpha Access Required</h1>
            <p className="text-gray-400 mb-6">
              This feature is currently available to alpha users only.
              Contact us for access if you'd like to try the conversational upload experience.
            </p>
            <a
              href="mailto:mixmialpha@gmail.com?subject=Alpha%20Access%20Request"
              className="inline-block px-6 py-3 bg-[#81E4F2] text-[#0a0e1a] font-semibold rounded-lg hover:bg-[#6BC4D4] transition-colors"
            >
              Request Alpha Access
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated and approved - show the conversational uploader
  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <Header />
      <ConversationalUploader walletAddress={effectiveWallet!} />
    </div>
  );
}
