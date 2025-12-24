"use client";

import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import GoogleSignInButton from '../auth/GoogleSignInButton';
import AppleSignInButton from '../auth/AppleSignInButton';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const { connectWallet } = useAuth();
  const [inviteCode, setInviteCode] = useState('');
  const [validatedInviteCode, setValidatedInviteCode] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');

  const handleWalletConnect = async () => {
    try {
      setError('');
      await connectWallet();
      // If successful, close modal
      onClose();
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setError('Failed to connect wallet. Please try again.');
    }
  };

  // Validate invite code (enables Google sign-in option)
  const handleValidateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setIsValidating(true);
    setError('');

    try {
      const response = await fetch('/api/auth/alpha-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: inviteCode.trim() })
      });

      const result = await response.json();

      if (result.success && result.user) {
        // Code is valid - enable Google sign-in
        setValidatedInviteCode(inviteCode.trim().toUpperCase());
        setError('');
      } else {
        setError(result.error || 'Invalid invite code. Please check and try again.');
        setValidatedInviteCode(null);
      }
    } catch (error) {
      console.error('Invite code validation failed:', error);
      setError('Validation failed. Please try again.');
      setValidatedInviteCode(null);
    } finally {
      setIsValidating(false);
    }
  };

  // Sign in directly with invite code (no Google)
  const handleInviteCodeSignIn = async () => {
    if (!validatedInviteCode) return;

    setIsAuthenticating(true);
    setError('');

    try {
      const response = await fetch('/api/auth/alpha-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: validatedInviteCode })
      });

      const result = await response.json();

      if (result.success && result.user) {
        localStorage.setItem('alpha_auth', JSON.stringify({
          type: 'invite',
          inviteCode: validatedInviteCode,
          walletAddress: result.user.wallet_address,
          artistName: result.user.artist_name
        }));

        window.location.reload();
      } else {
        setError(result.error || 'Sign-in failed. Please try again.');
      }
    } catch (error) {
      console.error('Invite code sign-in failed:', error);
      setError('Sign-in failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Reset validation if invite code changes
  const handleInviteCodeChange = (value: string) => {
    setInviteCode(value);
    if (validatedInviteCode && value.trim().toUpperCase() !== validatedInviteCode) {
      setValidatedInviteCode(null);
    }
    setError('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-6 p-2">
        {/* Header */}
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center mb-4"
            style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, rgba(129, 228, 242, 0.15) 0%, rgba(129, 228, 242, 0.05) 100%)',
              borderRadius: '14px',
              fontSize: '24px'
            }}
          >
            🔐
          </div>

          <h2
            className="text-2xl font-semibold mb-2"
            style={{
              background: 'linear-gradient(135deg, #e1e5f0 0%, #a8b2c3 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Welcome to mixmi Alpha
          </h2>

          <p className="text-gray-400 text-sm">
            {validatedInviteCode
              ? 'Choose how you want to sign in'
              : 'Sign in with your Stacks wallet or alpha invite code'
            }
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10" />

        {/* Connect Wallet Button */}
        <button
          onClick={handleWalletConnect}
          className="w-full px-6 py-4 text-gray-300 font-medium rounded-lg border border-white/40 hover:border-[#81E4F2] hover:shadow-[0_0_12px_rgba(129,228,242,0.3)] transition-all hover:bg-white/5"
          style={{ backgroundColor: '#061F3C' }}
        >
          🔗 Connect Stacks Wallet
        </button>

        {/* OR Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-gray-500 text-sm font-medium">OR</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Invite Code Section */}
        <div className="space-y-4">
          {/* Invite Code Input */}
          <form onSubmit={handleValidateInvite}>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Alpha Invite Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => handleInviteCodeChange(e.target.value)}
                  placeholder="mixmi-ABC123"
                  disabled={isValidating || isAuthenticating}
                  className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#81E4F2] transition-colors"
                />
                {!validatedInviteCode && (
                  <button
                    type="submit"
                    disabled={isValidating || !inviteCode.trim()}
                    className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isValidating ? '...' : 'Verify'}
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* Validation Success */}
          {validatedInviteCode && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Invite code verified! Choose your sign-in method:
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Sign-in Options (shown after validation) */}
          {validatedInviteCode && (
            <div className="space-y-3">
              {/* Google Sign-In */}
              <GoogleSignInButton
                inviteCode={validatedInviteCode}
                disabled={isAuthenticating}
              />

              {/* Apple Sign-In */}
              <AppleSignInButton
                inviteCode={validatedInviteCode}
                disabled={isAuthenticating}
              />

              {/* OR Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-gray-500 text-xs">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Direct Sign-In with Code */}
              <button
                onClick={handleInviteCodeSignIn}
                disabled={isAuthenticating}
                className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAuthenticating ? 'Signing in...' : 'Continue with Invite Code Only'}
              </button>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="pt-4 border-t border-white/10">
          <div className="text-center">
            <p className="text-gray-400 text-xs mb-2">
              {validatedInviteCode
                ? '🎉 Google or Apple sign-in creates a SUI wallet for you automatically'
                : 'ℹ️ Alpha access required during early testing'
              }
            </p>
            <p className="text-gray-500 text-xs">
              Need an invite?{' '}
              <a
                href="mailto:mixmialpha@gmail.com"
                className="text-[#81E4F2] hover:underline"
              >
                mixmialpha@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
