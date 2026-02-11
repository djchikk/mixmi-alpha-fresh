"use client";

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { RemixDetails, PaymentRecipient } from './RemixCompletionModal';
import { RecordingCostInfo, TrimState, RecordingData } from '@/hooks/useMixerRecording';
import { IPTrack } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
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

  // Download pricing state and calculations
  // Downloads allowed ONLY if ALL source tracks allow downloads
  const allSourcesAllowDownloads = useMemo(() => {
    // Debug: Log what we're checking
    console.log('🔍 [Download Check] loadedTracks:', loadedTracks.map(t => ({
      id: t.id,
      title: t.title,
      allow_downloads: t.allow_downloads,
      download_price_stx: t.download_price_stx,
    })));
    const result = loadedTracks.length > 0 && loadedTracks.every(t => t.allow_downloads === true);
    console.log('🔍 [Download Check] allSourcesAllowDownloads:', result);
    return result;
  }, [loadedTracks]);

  // Price floor = MAX of all source track download prices
  const minDownloadPrice = useMemo(() => {
    if (!allSourcesAllowDownloads) return null;
    const prices = loadedTracks.map(t => t.download_price_stx || 0);
    return Math.max(...prices);
  }, [loadedTracks, allSourcesAllowDownloads]);

  // Remixer's chosen download price (default to price floor)
  const [downloadPrice, setDownloadPrice] = useState<number | null>(null);

  // Initialize download price when minDownloadPrice is calculated
  useEffect(() => {
    if (minDownloadPrice !== null && downloadPrice === null) {
      setDownloadPrice(minDownloadPrice);
    }
  }, [minDownloadPrice, downloadPrice]);

  // Prepare payment on mount (fetch recipients)
  useEffect(() => {
    if (paymentData || isProcessing) return;

    const preparePayment = async () => {
      try {
        const bars = trimState.endBars - trimState.startBars;
        const sourceTrackIds = loadedTracks.map(t => t.id);

        // Debug: Log which wallet is being used
        // Priority: persona's SUI wallet > persona's linked wallet > zkLogin manager wallet
        const payerWallet = activePersona?.sui_address || activePersona?.wallet_address || suiAddress;
        console.log('💰 [Remix Payment] Wallet debug:', {
          activePersona: activePersona ? {
            id: activePersona.id,
            username: activePersona.username,
            wallet_address: activePersona.wallet_address,
            sui_address: activePersona.sui_address,
          } : null,
          suiAddress,
          payerWallet,
          usingPersonaWallet: !!activePersona?.sui_address,
        });

        const response = await fetch('/api/recording/prepare-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bars,
            sourceTrackIds,
            payerSuiAddress: payerWallet,
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

    if (!activePersona) {
      setError('Please select a persona to save your recording');
      return;
    }

    if (!activePersona.sui_address) {
      setError('Your persona does not have a wallet. Please contact support.');
      return;
    }

    if (authType !== 'zklogin') {
      setError('Recording purchase requires zkLogin authentication');
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      setStatusMessage('Processing payment...');

      // Build recipient list for payment
      const recipients = paymentData.recipients.map((r: PaymentRecipient) => ({
        address: r.sui_address,
        amountUsdc: r.amount,
        label: r.payment_type,
      }));

      console.log('💰 [Remix Payment] Calling purchase-with-persona:', {
        personaId: activePersona.id,
        accountId: activePersona.account_id,
        recipientCount: recipients.length,
        totalAmount: recipients.reduce((sum, r) => sum + r.amountUsdc, 0),
      });

      // Use the persona wallet for payment (not the zkLogin manager wallet)
      const paymentResponse = await fetch('/api/sui/purchase-with-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: activePersona.id,
          accountId: activePersona.account_id,
          recipients,
          // No cartItems needed for remix - we'll record separately
        }),
      });

      const paymentResult = await paymentResponse.json();
      console.log('💰 [Remix Payment] Response:', paymentResult);

      if (!paymentResponse.ok) {
        // Show details if available for debugging
        const errorMsg = paymentResult.details
          ? `${paymentResult.error}: ${paymentResult.details}`
          : paymentResult.error || 'Payment failed';
        throw new Error(errorMsg);
      }

      const txHash = paymentResult.txHash;
      console.log('💰 [Remix Payment] Transaction successful:', txHash);

      // Upload audio
      setStatusMessage('Uploading audio...');

      const audioBlob = await getAudioForTrim();
      if (!audioBlob) {
        throw new Error('Failed to create trimmed audio');
      }

      // Get upload URL (use persona wallet address)
      const personaWallet = activePersona.sui_address;
      const uploadUrlResponse = await fetch('/api/recording/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentData.id,
          walletAddress: personaWallet,
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
              walletAddress: personaWallet,
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

      console.log('🎵 [Remix] Saving with:', {
        creatorWallet: activePersona?.wallet_address || '',
        creatorSuiAddress: activePersona?.sui_address || suiAddress,
        isDraft: false,
        tags: remixDetails.tags,
        locations: remixDetails.locations,
      });

      const saveResponse = await fetch('/api/recording/confirm-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: paymentData.id,
          txHash: txHash,
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
          // Download pricing
          allowDownloads: allSourcesAllowDownloads,
          downloadPrice: allSourcesAllowDownloads ? downloadPrice : null,
          minDownloadPrice: minDownloadPrice,
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(saveData.error || 'Failed to save recording');
      }

      // Success!
      setIsProcessing(false);
      setStatusMessage(null);
      onSuccess(txHash, saveData.draft.id);

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

  // Calculate amounts
  const platformAmount = costInfo.totalCost * (PRICING.remix.platformCutPercent / 100);
  const remixerStake = costInfo.totalCost * (PRICING.remix.remixerStakePercent / 100);
  const creatorsAmount = costInfo.totalCost * (PRICING.remix.creatorsCutPercent / 100);

  // Merge creator payments by TRACK (combine composition + production for same track)
  // This shows which tracks you're paying for, not which wallets
  const mergedCreators = useMemo(() => {
    if (!paymentData?.recipients) return [];

    const creatorPayments = paymentData.recipients.filter(r => r.payment_type !== 'platform');
    const merged = new Map<string, { name: string; amount: number; trackId: string }>();

    for (const r of creatorPayments) {
      // Key by track ID so each track appears separately
      const key = r.source_track_id || r.source_track_title || 'Unknown';
      const existing = merged.get(key);
      if (existing) {
        existing.amount += r.amount;
      } else {
        merged.set(key, {
          name: r.source_track_title || r.display_name || 'Track',
          amount: r.amount,
          trackId: r.source_track_id || '',
        });
      }
    }

    return Array.from(merged.values()).sort((a, b) => b.amount - a.amount);
  }, [paymentData?.recipients]);

  // Colors for donut chart slices
  const SLICE_COLORS = [
    '#6B7280', // Platform - gray
    '#FBBF24', // Your stake - gold
    '#81E4F2', // Creator 1 - cyan
    '#A084F9', // Creator 2 - purple
    '#A8E66B', // Creator 3 - green
    '#F472B6', // Creator 4 - pink
    '#FB923C', // Creator 5 - orange
    '#38BDF8', // Creator 6 - sky
    '#C084FC', // Creator 7 - violet
  ];

  // Build donut segments (stake + creators + platform at bottom)
  const donutSegments = useMemo(() => {
    const segments: { label: string; amount: number; percentage: number; color: string }[] = [];
    const total = costInfo.totalCost;

    // Your stake (gold - first/top)
    segments.push({
      label: 'Your remix stake',
      amount: remixerStake,
      percentage: (remixerStake / total) * 100,
      color: SLICE_COLORS[1],
    });

    // Creators (various colors)
    mergedCreators.forEach((creator, i) => {
      segments.push({
        label: creator.name,
        amount: creator.amount,
        percentage: (creator.amount / total) * 100,
        color: SLICE_COLORS[(i + 2) % SLICE_COLORS.length],
      });
    });

    // Platform (gray - last/bottom)
    segments.push({
      label: 'Platform fee',
      amount: platformAmount,
      percentage: (platformAmount / total) * 100,
      color: SLICE_COLORS[0],
    });

    return segments;
  }, [costInfo.totalCost, platformAmount, remixerStake, mergedCreators]);

  // Calculate SVG donut path segments
  const donutPaths = useMemo(() => {
    const paths: { d: string; color: string }[] = [];
    let currentAngle = -90; // Start from top
    const cx = 50, cy = 50, r = 40;

    for (const segment of donutSegments) {
      const angle = (segment.percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;

      // Convert to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Calculate arc points
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      // Large arc flag (1 if angle > 180)
      const largeArc = angle > 180 ? 1 : 0;

      // Create arc path
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      paths.push({ d, color: segment.color });

      currentAngle = endAngle;
    }

    return paths;
  }, [donutSegments]);

  return (
    <div className="remix-step-confirm p-4 space-y-4">
      {/* Summary Header */}
      <div className="text-center">
        <h3 className="text-lg font-bold text-white mb-1">{remixDetails.name}</h3>
        <div className="text-3xl font-bold text-green-400">
          ${costInfo.totalCost.toFixed(2)} <span className="text-lg text-slate-400">USDC</span>
        </div>
      </div>

      {/* Payment Split Visualization - Single Donut */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="text-center text-sm text-slate-400 mb-3">Where your payment goes</div>

        <div className="flex gap-4 items-start">
          {/* Donut Chart */}
          <div className="flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-28 h-28">
              {donutPaths.map((path, i) => (
                <path key={i} d={path.d} fill={path.color} className="transition-opacity hover:opacity-80" />
              ))}
              {/* Center hole */}
              <circle cx="50" cy="50" r="25" fill="#1e293b" />
              {/* Center text */}
              <text x="50" y="47" textAnchor="middle" className="fill-white text-[8px] font-bold">
                ${costInfo.totalCost.toFixed(2)}
              </text>
              <text x="50" y="57" textAnchor="middle" className="fill-slate-400 text-[5px]">
                USDC
              </text>
            </svg>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5 max-h-[120px] overflow-y-auto">
            {donutSegments.map((segment, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-slate-300 truncate flex-1">{segment.label}</span>
                <span className="text-slate-400 flex-shrink-0">
                  ${segment.amount.toFixed(2)}
                </span>
                <span className="text-slate-500 text-[10px] w-8 text-right flex-shrink-0">
                  {segment.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-slate-500 text-center mt-3">
          Your 15% stake accumulates as others remix your remix
        </p>
      </div>

      {/* Download Pricing Section */}
      {allSourcesAllowDownloads && minDownloadPrice !== null ? (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="text-sm text-slate-300 font-medium mb-3">Download Pricing</div>
          <p className="text-xs text-slate-400 mb-3">
            All source tracks allow downloads. Set your download price (minimum ${minDownloadPrice.toFixed(2)} USDC based on source prices).
          </p>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm">$</span>
            <input
              type="number"
              min={minDownloadPrice}
              step="0.50"
              value={downloadPrice ?? minDownloadPrice}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val >= minDownloadPrice) {
                  setDownloadPrice(val);
                }
              }}
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#81E4F2]"
            />
            <span className="text-slate-400 text-sm">USDC</span>
          </div>
          {downloadPrice !== null && downloadPrice < minDownloadPrice && (
            <p className="text-xs text-red-400 mt-2">
              Price must be at least ${minDownloadPrice.toFixed(2)} USDC
            </p>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="text-sm text-slate-300 font-medium mb-2">Download Availability</div>
          <p className="text-xs text-amber-400">
            ⚠️ Downloads not available. One or more source tracks are Platform Remix Only.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Your remix can still be streamed and remixed on the platform.
          </p>
        </div>
      )}

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
      {!activePersona?.sui_address && (
        <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 text-amber-300 text-sm text-center">
          {!suiAddress ? 'Please sign in with Google to publish your remix' : 'Your persona needs a wallet to publish. Please contact support.'}
        </div>
      )}

      {/* Confirm Button */}
      {!isProcessing && (
        <button
          onClick={handleConfirmAndPay}
          disabled={!paymentData || !activePersona?.sui_address}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold bg-gradient-to-r from-[#81E4F2] to-cyan-400 text-slate-900 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={18} />
          Confirm & Pay ${costInfo.totalCost.toFixed(2)}
        </button>
      )}
    </div>
  );
}
