"use client";

import { useEffect, useState, useRef } from 'react';
import {
  extractJwtFromUrl,
  decodeJwtPayload,
  getZkProof,
  deriveSuiAddress,
  deserializeKeyPair,
} from '@/lib/zklogin';
import { getExtendedEphemeralPublicKey } from '@mysten/sui/zklogin';
import {
  getPendingZkLogin,
  storeZkLoginSession,
  clearPendingZkLogin,
} from '@/lib/zklogin/session';

type CallbackStatus = 'processing' | 'success' | 'error';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [statusMessage, setStatusMessage] = useState('Processing sign-in...');
  const [error, setError] = useState<string | null>(null);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    // Guard against React strict mode double-execution
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    async function completeZkLogin() {
      try {
        console.log('🔐 Step 1: Extracting JWT from URL...');
        // Step 1: Extract JWT from URL fragment
        setStatusMessage('Extracting authentication token...');
        const jwt = extractJwtFromUrl(window.location.href);
        console.log('🔐 JWT extracted:', jwt ? `${jwt.substring(0, 50)}...` : 'NULL');

        if (!jwt) {
          throw new Error('No authentication token found in callback URL');
        }

        console.log('🔐 Step 2: Getting pending zkLogin state...');
        // Step 2: Get pending zkLogin state
        setStatusMessage('Retrieving session state...');
        const pending = getPendingZkLogin();
        console.log('🔐 Pending state:', pending ? 'Found' : 'NULL');

        if (!pending) {
          throw new Error('Session expired. Please try signing in again.');
        }

        console.log('🔐 Step 3: Decoding JWT payload...');
        // Step 3: Decode JWT to get Google sub and email
        const jwtPayload = decodeJwtPayload(jwt);
        const { sub: googleSub, email: googleEmail } = jwtPayload;
        console.log('🔐 JWT decoded - email:', googleEmail);

        console.log('🔐 Step 4: Reconstructing ephemeral keypair...');
        // Step 4: Reconstruct ephemeral keypair
        const ephemeralKeyPair = deserializeKeyPair(pending.ephemeralSecretKey);
        console.log('🔐 Keypair reconstructed');

        console.log('🔐 Step 5: Calling salt API...');
        // Step 5: Get or create salt from our API
        setStatusMessage('Setting up your account...');
        const saltResponse = await fetch('/api/auth/zklogin/salt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleSub,
            email: googleEmail,
            inviteCode: pending.inviteCode,
            chosenUsername: pending.chosenUsername, // User-chosen username for new accounts
            jwt, // Needed for first-time users to derive address
          }),
        });

        console.log('🔐 Salt API response status:', saltResponse.status);
        if (!saltResponse.ok) {
          const saltError = await saltResponse.json();
          console.error('🔐 Salt API error:', saltError);
          throw new Error(saltError.error || 'Failed to set up account');
        }

        const { salt, suiAddress: saltSuiAddress } = await saltResponse.json();
        console.log('🔐 Salt received, SUI address:', saltSuiAddress?.substring(0, 20) + '...');

        console.log('🔐 Step 6: Getting ZK proof from Mysten Labs prover...');
        // Step 6: Get ZK proof from Mysten Labs prover
        setStatusMessage('Verifying credentials...');
        // Must use extended format for the prover
        const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(ephemeralKeyPair.getPublicKey());

        const zkProof = await getZkProof(
          jwt,
          extendedEphemeralPublicKey,
          pending.maxEpoch,
          pending.randomness,
          salt
        );
        console.log('🔐 ZK proof received');

        console.log('🔐 Step 7: Deriving SUI address...');
        // Step 7: Derive SUI address (should match what salt API returned)
        const suiAddress = saltSuiAddress || deriveSuiAddress(jwt, salt);
        console.log('🔐 SUI address:', suiAddress);

        console.log('🔐 Step 8: Completing authentication...');
        // Step 8: Complete authentication with our API
        setStatusMessage('Completing sign-in...');
        const completeResponse = await fetch('/api/auth/zklogin/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suiAddress,
            googleEmail,
            inviteCode: pending.inviteCode,
          }),
        });

        console.log('🔐 Complete API response status:', completeResponse.status);
        if (!completeResponse.ok) {
          const completeError = await completeResponse.json();
          console.error('🔐 Complete API error:', completeError);
          throw new Error(completeError.error || 'Failed to complete sign-in');
        }

        const { token, walletAddress } = await completeResponse.json();
        console.log('🔐 Auth complete! Wallet:', walletAddress ? walletAddress.substring(0, 20) + '...' : 'none');

        console.log('🔐 Step 9: Storing session...');
        // Step 9: Store session in sessionStorage
        storeZkLoginSession(
          ephemeralKeyPair,
          pending.maxEpoch,
          pending.randomness,
          jwt,
          salt,
          suiAddress,
          googleEmail,
          pending.inviteCode,
          zkProof
        );

        console.log('🔐 Step 10: Storing auth in localStorage...');
        // Step 10: Store auth state for AuthContext to pick up
        localStorage.setItem('zklogin_auth', JSON.stringify({
          type: 'zklogin',
          suiAddress,
          walletAddress, // Linked Stacks wallet if any
          email: googleEmail,
          inviteCode: pending.inviteCode,
          token,
        }));

        console.log('🔐 ✅ zkLogin complete! Redirecting to /account...');
        setStatus('success');
        setStatusMessage('Sign-in successful! Redirecting...');

        // Redirect to account page with full page reload so AuthContext re-initializes
        setTimeout(() => {
          window.location.href = '/account';
        }, 1000);

      } catch (err) {
        console.error('zkLogin callback error:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        clearPendingZkLogin();
      }
    }

    completeZkLogin();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 max-w-md w-full mx-4">
        {status === 'processing' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto border-4 border-[#81E4F2] border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Signing You In
            </h2>
            <p className="text-gray-400 text-sm">
              {statusMessage}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Welcome to mixmi!
            </h2>
            <p className="text-gray-400 text-sm">
              {statusMessage}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Sign-In Failed
            </h2>
            <p className="text-red-400 text-sm mb-4">
              {error}
            </p>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Return Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
