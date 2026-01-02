"use client";

import { useState } from 'react';
import {
  generateEphemeralKeyPair,
  generateNonce,
  getMaxEpoch,
  buildAppleAuthUrl,
} from '@/lib/zklogin';
import { storePendingZkLogin } from '@/lib/zklogin/session';

interface AppleSignInButtonProps {
  inviteCode: string;
  chosenUsername?: string;
  disabled?: boolean;
  className?: string;
}

export default function AppleSignInButton({
  inviteCode,
  chosenUsername,
  disabled = false,
  className = '',
}: AppleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleAppleSignIn = async () => {
    if (disabled || !inviteCode) return;

    setIsLoading(true);

    try {
      // Step 1: Generate ephemeral keypair
      const ephemeralKeyPair = generateEphemeralKeyPair();

      // Step 2: Get max epoch for session validity
      const maxEpoch = await getMaxEpoch();

      // Step 3: Generate nonce
      const { nonce, randomness } = await generateNonce(ephemeralKeyPair, maxEpoch);

      // Step 4: Store pending state before redirect
      storePendingZkLogin(ephemeralKeyPair, maxEpoch, randomness, inviteCode, chosenUsername);

      // Step 5: Build Apple OAuth URL
      // Note: Apple requires exact redirect URI match - using /auth/callback/apple as configured in Apple Developer Console
      const redirectUri = `${window.location.origin}/auth/callback/apple`;
      const appleAuthUrl = buildAppleAuthUrl(nonce, redirectUri);

      // Debug: Log the URL being used
      console.log('🍎 Apple zkLogin Debug:', {
        origin: window.location.origin,
        redirectUri,
        appleAuthUrl,
        clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID
      });

      // Step 6: Redirect to Apple
      window.location.href = appleAuthUrl;

    } catch (error) {
      console.error('Failed to initiate Apple sign-in:', error);
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleAppleSignIn}
      disabled={disabled || isLoading}
      className={`
        w-full px-6 py-4 flex items-center justify-center gap-3
        text-gray-300 font-medium rounded-lg
        border transition-all
        ${disabled
          ? 'border-white/20 bg-slate-800/30 opacity-50 cursor-not-allowed'
          : 'border-white/40 hover:border-white hover:shadow-[0_0_12px_rgba(255,255,255,0.2)] hover:bg-white/5'
        }
        ${className}
      `}
      style={{ backgroundColor: disabled ? undefined : '#061F3C' }}
    >
      {isLoading ? (
        <>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          {/* Apple Logo SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          <span>Sign in with Apple</span>
        </>
      )}
    </button>
  );
}
