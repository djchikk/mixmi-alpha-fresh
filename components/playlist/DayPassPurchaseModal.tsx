"use client";

import React, { useState } from 'react';
import { X, Ticket, Clock, Music, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DAY_PASS_PRICE_USDC, DAY_PASS_DURATION_HOURS, cacheDayPassLocally } from '@/lib/dayPass';
import { getZkLoginSession } from '@/lib/zklogin/session';
import { getZkLoginSignature, genAddressSeed, getExtendedEphemeralPublicKey, jwtToAddress } from '@mysten/sui/zklogin';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

interface DayPassPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (dayPassId: string, expiresAt: string) => void;
}

type PurchaseState = 'idle' | 'creating' | 'signing' | 'confirming' | 'success' | 'error';

export default function DayPassPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
}: DayPassPurchaseModalProps) {
  const { suiAddress, authType } = useAuth();
  const [state, setState] = useState<PurchaseState>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    if (!suiAddress) {
      setError('Please sign in to purchase a day pass');
      return;
    }

    if (authType !== 'zklogin') {
      setError('Day pass purchase requires zkLogin authentication');
      return;
    }

    try {
      setState('creating');
      setError(null);

      // Step 1: Create pending day pass
      const createResponse = await fetch('/api/day-pass/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: suiAddress }),
      });

      const createData = await createResponse.json();

      if (!createResponse.ok) {
        throw new Error(createData.error || 'Failed to create day pass');
      }

      const { dayPassId, expiresAt, amountUsdc, recipientAddress } = createData;

      // Step 2: Get zkLogin session for signing
      setState('signing');
      const zkSession = getZkLoginSession();

      if (!zkSession) {
        throw new Error('zkLogin session expired. Please sign in again.');
      }

      // Step 3: Build and sponsor the payment transaction
      const sponsorResponse = await fetch('/api/sui/sponsor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderAddress: suiAddress,
          recipients: [{
            address: recipientAddress,
            amount: amountUsdc,
          }],
        }),
      });

      const sponsorData = await sponsorResponse.json();

      if (!sponsorResponse.ok) {
        throw new Error(sponsorData.error || 'Failed to sponsor transaction');
      }

      const { txBytes, sponsorSignature } = sponsorData;

      // Step 4: Sign with zkLogin
      const keypair = Ed25519Keypair.fromSecretKey(zkSession.ephemeralSecretKey);
      const txBytesArray = new Uint8Array(Buffer.from(txBytes, 'base64'));

      // Create ephemeral signature
      const { signature: ephemeralSignature } = await keypair.signTransaction(txBytesArray);

      // Decode JWT for address seed
      const [, payload] = zkSession.jwt.split('.');
      const jwtPayload = JSON.parse(atob(payload));
      const aud = Array.isArray(jwtPayload.aud) ? jwtPayload.aud[0] : jwtPayload.aud;

      // Generate address seed
      const addressSeed = genAddressSeed(
        BigInt(zkSession.salt),
        'sub',
        jwtPayload.sub,
        aud
      ).toString();

      // Create zkLogin signature
      const zkLoginSignature = getZkLoginSignature({
        inputs: {
          ...zkSession.zkProof,
          addressSeed,
        },
        maxEpoch: zkSession.maxEpoch,
        userSignature: ephemeralSignature,
      });

      // Step 5: Execute the transaction
      setState('confirming');
      const executeResponse = await fetch('/api/sui/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txBytes,
          userSignature: zkLoginSignature,
          sponsorSignature,
        }),
      });

      const executeData = await executeResponse.json();

      if (!executeResponse.ok) {
        throw new Error(executeData.error || 'Transaction failed');
      }

      // Step 6: Confirm the day pass purchase
      const confirmResponse = await fetch('/api/day-pass/purchase', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayPassId,
          txHash: executeData.txHash,
        }),
      });

      const confirmData = await confirmResponse.json();

      if (!confirmResponse.ok) {
        throw new Error(confirmData.error || 'Failed to activate day pass');
      }

      // Step 7: Success!
      setState('success');
      cacheDayPassLocally(dayPassId, expiresAt);

      // Notify parent and close after brief delay
      setTimeout(() => {
        onSuccess(dayPassId, expiresAt);
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Day pass purchase error:', err);
      setState('error');
      setError(err instanceof Error ? err.message : 'Purchase failed');
    }
  };

  const handleClose = () => {
    if (state === 'creating' || state === 'signing' || state === 'confirming') {
      // Don't allow closing during transaction
      return;
    }
    setState('idle');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 p-1 hover:bg-slate-800 rounded transition-colors"
          disabled={state === 'creating' || state === 'signing' || state === 'confirming'}
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Success State */}
        {state === 'success' ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 mx-auto mb-4 bg-[#A8E66B]/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-[#A8E66B]" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Day Pass Activated!</h3>
            <p className="text-gray-400 text-sm">
              Enjoy 24 hours of unlimited full-song streaming.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#81E4F2]/20 rounded-full flex items-center justify-center">
                <Ticket className="w-6 h-6 text-[#81E4F2]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Day Pass</h3>
                <p className="text-sm text-gray-400">Unlimited streaming for 24 hours</p>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <Music className="w-4 h-4 text-[#A8E66B]" />
                <span className="text-gray-300">Full songs (no 20-second preview)</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-[#81E4F2]" />
                <span className="text-gray-300">{DAY_PASS_DURATION_HOURS} hours of access</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Ticket className="w-4 h-4 text-[#A084F9]" />
                <span className="text-gray-300">Supports artists with every play</span>
              </div>
            </div>

            {/* Price */}
            <div className="bg-slate-800/50 rounded-lg p-4 mb-6 text-center">
              <span className="text-3xl font-bold text-white">${DAY_PASS_PRICE_USDC.toFixed(2)}</span>
              <span className="text-gray-400 ml-2">USDC</span>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Purchase Button */}
            <button
              onClick={handlePurchase}
              disabled={state !== 'idle' && state !== 'error'}
              className="w-full py-3 bg-[#81E4F2] hover:bg-[#6bcfdd] disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold text-slate-900 transition-colors flex items-center justify-center gap-2"
            >
              {state === 'creating' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating pass...
                </>
              )}
              {state === 'signing' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing transaction...
                </>
              )}
              {state === 'confirming' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Confirming payment...
                </>
              )}
              {(state === 'idle' || state === 'error') && (
                <>
                  <Ticket className="w-4 h-4" />
                  Purchase Day Pass
                </>
              )}
            </button>

            {/* Sign in prompt */}
            {!suiAddress && (
              <p className="text-center text-gray-500 text-xs mt-3">
                Sign in with Google to purchase
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
