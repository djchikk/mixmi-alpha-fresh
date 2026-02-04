"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Check, Loader2, AlertCircle, Settings, Star } from 'lucide-react';
import { RemixDetails, PaymentRecipient } from './RemixCompletionModal';
import { RecordingCostInfo, TrimState, RecordingData } from '@/hooks/useMixerRecording';
import { IPTrack } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getZkLoginSession } from '@/lib/zklogin/session';
import { getZkLoginSignature, genAddressSeed } from '@mysten/sui/zklogin';
import { buildSplitPaymentForSponsorship } from '@/lib/sui/payment-splitter';
import { PRICING } from '@/config/pricing';

interface RemixStepConfirmProps {
  remixDetails: RemixDetails;
  costInfo: RecordingCostInfo;
  loadedTracks: IPTrack[];
  paymentData: {
    id: string;
    recipients: PaymentRecipient[];
    totalCost: number;
    sourceTracksMetadata: any[];
  } | null;
  onPaymentPrepared: (data: any) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  trimState: TrimState;
  recordingData: RecordingData;
  getAudioForTrim: () => Promise<Blob | null>;
  getVideoForTrim?: () => Promise<Blob | null>;
  hasVideo: boolean;
  coverImageUrl: string | null;
  onSuccess: (txHash: string, draftId: string) => void;
}

// Helper to safely decode base64url
function safeBase64Decode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

export default function RemixStepConfirm({
  remixDetails,
  costInfo,
  loadedTracks,
  paymentData,
  onPaymentPrepared,
  isProcessing,
  setIsProcessing,
  error,
  setError,
  trimState,
  recordingData,
  getAudioForTrim,
  getVideoForTrim,
  hasVideo,
  coverImageUrl,
  onSuccess,
}: RemixStepConfirmProps) {
  const { suiAddress, authType, activePersona } = useAuth();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Prepare payment on mount (fetch recipients)
  useEffect(() => {
    if (paymentData || isProcessing) return;

    const preparePayment = async () => {
      try {
        const bars = trimState.endBars - trimState.startBars;
        const sourceTrackIds = loadedTracks.map(t => t.id);

        const response = await fetch('/api/recording/prepare-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bars,
            sourceTrackIds,
            payerSuiAddress: activePersona?.sui_address || suiAddress,
            payerPersonaId: activePersona?.id || null,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to prepare payment');
          return;
        }

        onPaymentPrepared(data.payment);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to prepare payment');
      }
    };

    preparePayment();
  }, [paymentData, isProcessing, trimState, loadedTracks, activePersona, suiAddress, onPaymentPrepared, setError]);

  // Execute payment and save
  const handleConfirmAndPay = useCallback(async () => {
    if (!paymentData) return;

    if (!suiAddress) {
      setError('Please sign in to save your recording');
      return;
    }

    if (authType !== 'zklogin') {
      setError('Recording purchase requires zkLogin authentication');
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      setStatusMessage('Building transaction...');

      // Build the split payment transaction
      const recipients = paymentData.recipients.map((r: PaymentRecipient) => ({
        address: r.sui_address,
        amountUsdc: r.amount,
        label: r.payment_type,
      }));

      let kindBytes: Uint8Array;
      try {
        const result = await buildSplitPaymentForSponsorship({
          senderAddress: suiAddress,
          recipients,
        });
        kindBytes = result.kindBytes;
      } catch (buildError) {
        throw new Error(buildError instanceof Error ? buildError.message : 'Failed to build transaction');
      }

      // Send to sponsor endpoint
      setStatusMessage('Getting transaction sponsored...');
      const kindBytesBase64 = btoa(String.fromCharCode(...kindBytes));

      const sponsorResponse = await fetch('/api/sui/sponsor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kindBytes: kindBytesBase64,
          senderAddress: suiAddress,
        }),
      });

      const sponsorData = await sponsorResponse.json();

      if (!sponsorResponse.ok) {
        throw new Error(sponsorData.error || 'Failed to sponsor transaction');
      }

      const { txBytes, sponsorSignature } = sponsorData;

      // Sign with zkLogin
      setStatusMessage('Signing transaction...');
      const zkSession = getZkLoginSession();

      if (!zkSession) {
        throw new Error('zkLogin session expired. Please sign in again.');
      }

      const keypair = zkSession.ephemeralKeyPair;
      const txBytesArray = Uint8Array.from(atob(txBytes), c => c.charCodeAt(0));
      const { signature: ephemeralSignature } = await keypair.signTransaction(txBytesArray);

      // Decode JWT for address seed
      const [, payload] = zkSession.jwt.split('.');
      if (!payload) {
        throw new Error('Invalid JWT format');
      }

      const jwtPayload = JSON.parse(safeBase64Decode(payload));
      const aud = Array.isArray(jwtPayload.aud) ? jwtPayload.aud[0] : jwtPayload.aud;

      const addressSeed = genAddressSeed(
        BigInt(zkSession.salt),
        'sub',
        jwtPayload.sub,
        aud
      ).toString();

      const zkLoginSignature = getZkLoginSignature({
        inputs: {
          ...zkSession.zkProof,
          addressSeed,
        },
        maxEpoch: zkSession.maxEpoch,
        userSignature: ephemeralSignature,
      });

      // Execute the transaction
      setStatusMessage('Processing payment...');

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

      // Upload audio
      setStatusMessage('Uploading audio...');

      const audioBlob = await getAudioForTrim();
      if (!audioBlob) {
        throw new Error('Failed to create trimmed audio');
      }

      // Get upload URL
      const uploadUrlResponse = await fetch('/api/recording/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentData.id,
          walletAddress: suiAddress,
        }),
      });

      const uploadUrlData = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok) {
        throw new Error(uploadUrlData.error || 'Failed to get upload URL');
      }

      // Upload audio
      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: audioBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload audio file');
      }

      // Upload video if available
      let videoUrl: string | null = null;
      if (hasVideo && getVideoForTrim) {
        setStatusMessage('Uploading video...');
        const videoBlob = await getVideoForTrim();
        if (videoBlob) {
          const videoUploadUrlResponse = await fetch('/api/recording/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId: paymentData.id,
              walletAddress: suiAddress,
              fileType: 'video',
            }),
          });

          const videoUploadUrlData = await videoUploadUrlResponse.json();
          if (videoUploadUrlResponse.ok) {
            const videoUploadResponse = await fetch(videoUploadUrlData.uploadUrl, {
              method: 'PUT',
              headers: { 'Content-Type': 'video/webm' },
              body: videoBlob,
            });

            if (videoUploadResponse.ok) {
              videoUrl = videoUploadUrlData.publicUrl;
            }
          }
        }
      }

      // Save the remix (not as draft anymore - direct to published!)
      setStatusMessage('Publishing your remix...');
      const bars = trimState.endBars - trimState.startBars;

      const saveResponse = await fetch('/api/recording/confirm-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentData.id,
          txHash: executeData.txHash,
          audioUrl: uploadUrlData.publicUrl,
          videoUrl,
          title: remixDetails.name,
          bpm: recordingData.bpm,
          bars,
          creatorWallet: activePersona?.wallet_address || '',
          creatorSuiAddress: activePersona?.sui_address || suiAddress,
          sourceTracksMetadata: paymentData.sourceTracksMetadata,
          // New fields for direct publish
          tags: remixDetails.tags,
          notes: remixDetails.notes,
          locations: remixDetails.locations,
          coverImageUrl: coverImageUrl,
          isDraft: false, // Direct to published!
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(saveData.error || 'Failed to save recording');
      }

      // Success!
      onSuccess(executeData.txHash, saveData.draft.id);

    } catch (err) {
      console.error('Payment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process payment');
      setIsProcessing(false);
      setStatusMessage(null);
    }
  }, [
    paymentData,
    suiAddress,
    authType,
    activePersona,
    trimState,
    recordingData,
    remixDetails,
    coverImageUrl,
    hasVideo,
    getAudioForTrim,
    getVideoForTrim,
    setError,
    setIsProcessing,
    onSuccess,
  ]);

  // Group recipients by type for display
  const platformPayment = paymentData?.recipients.find(r => r.payment_type === 'platform');
  const creatorPayments = paymentData?.recipients.filter(r => r.payment_type !== 'platform') || [];

  // Calculate totals for display
  const creatorTotal = creatorPayments.reduce((sum, r) => sum + r.amount, 0);
  const remixerStake = costInfo.totalCost * (PRICING.remix.remixerStakePercent / 100);

  return (
    <div className="remix-step-confirm p-4 space-y-4">
      {/* Summary Header */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-white mb-1">{remixDetails.name}</h3>
        <div className="text-3xl font-bold text-green-400">
          ${costInfo.totalCost.toFixed(2)} <span className="text-lg text-slate-400">USDC</span>
        </div>
      </div>

      {/* Payment Split Visualization */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        {/* Top Row: Platform & Your Stake */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-slate-400" />
            <span className="text-sm text-slate-400">Platform 5%</span>
            <span className="text-sm font-bold text-white">
              ${platformPayment?.amount.toFixed(2) || '0.00'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Star size={16} className="text-[#FBBF24]" />
            <span className="text-sm text-slate-400">Your Stake 15%</span>
            <span className="text-sm font-bold text-[#FBBF24]">
              ${remixerStake.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Creator Splits */}
        <div className="text-center mb-3">
          <span className="text-sm text-slate-400">Creator Splits</span>
          <span className="text-sm font-bold text-white ml-2">
            ${creatorTotal.toFixed(2)} · 80%
          </span>
        </div>

        {/* Placeholder for Donut Charts - Phase 3 */}
        <div className="grid grid-cols-2 gap-4">
          {/* Idea (Composition) */}
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase mb-2">💡 Idea</div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              {/* Donut chart placeholder */}
              <div className="w-20 h-20 mx-auto rounded-full border-4 border-[#81E4F2] flex items-center justify-center mb-2">
                <span className="text-xs text-slate-400">50%</span>
              </div>
              {/* Legend */}
              <div className="space-y-1 text-left">
                {creatorPayments
                  .filter(r => r.payment_type === 'composition')
                  .map((r, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-[#81E4F2]" />
                      <span className="text-slate-300 truncate flex-1">
                        {r.display_name || r.source_track_title || 'Creator'}
                      </span>
                      <span className="text-slate-400">{r.percentage}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Implementation (Production) */}
          <div className="text-center">
            <div className="text-xs text-slate-400 uppercase mb-2">🔧 Implementation</div>
            <div className="bg-slate-900/50 rounded-lg p-3">
              {/* Donut chart placeholder */}
              <div className="w-20 h-20 mx-auto rounded-full border-4 border-[#A084F9] flex items-center justify-center mb-2">
                <span className="text-xs text-slate-400">50%</span>
              </div>
              {/* Legend */}
              <div className="space-y-1 text-left">
                {creatorPayments
                  .filter(r => r.payment_type === 'production')
                  .map((r, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px]">
                      <span className="w-2 h-2 rounded-full bg-[#A084F9]" />
                      <span className="text-slate-300 truncate flex-1">
                        {r.display_name || r.source_track_title || 'Creator'}
                      </span>
                      <span className="text-slate-400">{r.percentage}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 text-center mt-3">
          Your 15% stake accumulates as others remix your remix
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Status Display */}
      {isProcessing && statusMessage && (
        <div className="flex items-center justify-center gap-2 py-2 text-[#81E4F2]">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{statusMessage}</span>
        </div>
      )}

      {/* Auth Warning */}
      {!suiAddress && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 text-amber-300 text-sm text-center">
          Please sign in with Google to publish your remix
        </div>
      )}

      {/* Confirm Button */}
      {!isProcessing && (
        <button
          onClick={handleConfirmAndPay}
          disabled={!paymentData || !suiAddress}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold bg-gradient-to-r from-[#81E4F2] to-cyan-400 text-slate-900 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={18} />
          Confirm & Pay ${costInfo.totalCost.toFixed(2)}
        </button>
      )}
    </div>
  );
}
