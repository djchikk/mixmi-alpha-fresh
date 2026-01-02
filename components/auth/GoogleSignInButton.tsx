"use client";

import { useState } from 'react';
import {
  generateEphemeralKeyPair,
  generateNonce,
  getMaxEpoch,
  buildGoogleAuthUrl,
} from '@/lib/zklogin';
import { storePendingZkLogin } from '@/lib/zklogin/session';

interface GoogleSignInButtonProps {
  inviteCode: string;
  chosenUsername?: string;
  disabled?: boolean;
  className?: string;
}

export default function GoogleSignInButton({
  inviteCode,
  chosenUsername,
  disabled = false,
  className = '',
}: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
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

      // Step 5: Build Google OAuth URL
      const redirectUri = `${window.location.origin}/auth/callback`;
      const googleAuthUrl = buildGoogleAuthUrl(nonce, redirectUri);

      // Debug: Log the URL being used
      console.log('🔐 zkLogin Debug:', {
        origin: window.location.origin,
        redirectUri,
        googleAuthUrl,
        clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      });

      // Step 6: Redirect to Google
      window.location.href = googleAuthUrl;

    } catch (error) {
      console.error('Failed to initiate Google sign-in:', error);
      setIsLoading(false);
      // Error will be shown in the modal
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      disabled={disabled || isLoading}
      className={`
        w-full px-6 py-4 flex items-center justify-center gap-3
        text-gray-300 font-medium rounded-lg
        border transition-all
        ${disabled
          ? 'border-white/20 bg-slate-800/30 opacity-50 cursor-not-allowed'
          : 'border-white/40 hover:border-[#4285F4] hover:shadow-[0_0_12px_rgba(66,133,244,0.3)] hover:bg-white/5'
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
          {/* Google Logo SVG */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Sign in with Google</span>
        </>
      )}
    </button>
  );
}
