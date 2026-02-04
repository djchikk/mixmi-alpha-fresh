"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, AlertCircle } from 'lucide-react';
import RecordingWaveform from './RecordingWaveform';
import TrimControls from './TrimControls';
import BlockAudition from './BlockAudition';
import CostDisplay from './CostDisplay';
import { RecordingData, TrimState, RecordingCostInfo } from '@/hooks/useMixerRecording';
import { IPTrack } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getZkLoginSession } from '@/lib/zklogin/session';
import { getZkLoginSignature, genAddressSeed } from '@mysten/sui/zklogin';
import { buildSplitPaymentForSponsorship } from '@/lib/sui/payment-splitter';

/**
 * Safely decode base64 or base64url string
 * JWT uses base64url which has different characters than standard base64
 */
function safeBase64Decode(str: string): string {
  // Convert base64url to base64 by replacing characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

interface RecordingWidgetProps {
  isOpen: boolean;
  recordingData: RecordingData;
  trimState: TrimState;
  costInfo: RecordingCostInfo;
  loadedTracks: IPTrack[];
  onClose: () => void;
  onTrimStartChange: (bars: number) => void;
  onTrimEndChange: (bars: number) => void;
  onNudge: (point: 'start' | 'end', direction: 'left' | 'right', resolution: number) => void;
  onConfirm: () => Promise<void>;
  getAudioForTrim: () => Promise<Blob | null>;
  getVideoForTrim?: () => Promise<Blob | null>;
  hasVideo?: boolean;
}

type PurchaseState = 'idle' | 'preparing' | 'signing' | 'executing' | 'saving' | 'success' | 'error';

export default function RecordingWidget({
  isOpen,
  recordingData,
  trimState,
  costInfo,
  loadedTracks,
  onClose,
  onTrimStartChange,
  onTrimEndChange,
  onNudge,
  onConfirm,
  getAudioForTrim,
  getVideoForTrim,
  hasVideo = false,
}: RecordingWidgetProps) {
  const { suiAddress, authType, activePersona } = useAuth();
  const [purchaseState, setPurchaseState] = useState<PurchaseState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure we're on client side for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConfirm = useCallback(async () => {
    // Check authentication
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
      setPurchaseState('preparing');

      const bars = trimState.endBars - trimState.startBars;
      const sourceTrackIds = loadedTracks.map(t => t.id);

      // Step 1: Prepare payment - get recipients and create pending record
      console.log('🎵 [Recording] Preparing payment...');
      const prepareResponse = await fetch('/api/recording/prepare-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bars,
          sourceTrackIds,
          payerSuiAddress: activePersona?.sui_address || suiAddress,
          payerPersonaId: activePersona?.id || null,
        }),
      });

      const prepareData = await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(prepareData.error || 'Failed to prepare payment');
      }

      const { payment } = prepareData;
      console.log('🎵 [Recording] Payment prepared:', {
        paymentId: payment.id,
        totalCost: payment.totalCost,
        recipients: payment.recipients.length,
      });

      // Step 2: Get zkLogin session
      setPurchaseState('signing');
      const zkSession = getZkLoginSession();

      if (!zkSession) {
        throw new Error('zkLogin session expired. Please sign in again.');
      }

      // Step 3: Build the split payment transaction
      console.log('🎵 [Recording] Building payment transaction...');
      const recipients = payment.recipients.map((r: any) => ({
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
        console.log('🎵 [Recording] Got kindBytes, length:', kindBytes.length);
      } catch (buildError) {
        console.error('🎵 [Recording] Failed to build transaction:', buildError);
        throw new Error(buildError instanceof Error ? buildError.message : 'Failed to build payment transaction');
      }

      // Step 4: Send to sponsor endpoint
      const kindBytesBase64 = btoa(String.fromCharCode(...kindBytes));
      console.log('🎵 [Recording] Sending to sponsor...');

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

      if (!txBytes || typeof txBytes !== 'string') {
        console.error('🎵 [Recording] Invalid txBytes from sponsor:', txBytes);
        throw new Error('Invalid transaction data from sponsor');
      }

      // Step 5: Sign with zkLogin
      const keypair = zkSession.ephemeralKeyPair;

      // Decode txBytes (standard base64 from our API)
      let txBytesArray: Uint8Array;
      try {
        txBytesArray = Uint8Array.from(atob(txBytes), c => c.charCodeAt(0));
      } catch (decodeError) {
        console.error('🎵 [Recording] Failed to decode txBytes:', txBytes.substring(0, 50) + '...');
        throw new Error('Failed to decode transaction bytes');
      }

      const { signature: ephemeralSignature } = await keypair.signTransaction(txBytesArray);

      // Decode JWT for address seed (JWT uses base64url encoding)
      console.log('🎵 [Recording] JWT check:', {
        hasJwt: !!zkSession.jwt,
        jwtType: typeof zkSession.jwt,
        jwtLength: zkSession.jwt?.length,
        jwtParts: zkSession.jwt?.split('.').length,
        jwtPreview: zkSession.jwt?.substring(0, 50) + '...'
      });

      if (!zkSession.jwt || typeof zkSession.jwt !== 'string') {
        throw new Error('JWT is missing from session');
      }

      const [, payload] = zkSession.jwt.split('.');
      if (!payload) {
        throw new Error('Invalid JWT format - missing payload');
      }

      let jwtPayload: any;
      try {
        jwtPayload = JSON.parse(safeBase64Decode(payload));
      } catch (jwtError) {
        console.error('🎵 [Recording] Failed to decode JWT payload');
        throw new Error('Failed to decode authentication token');
      }
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

      // Step 6: Execute the transaction
      setPurchaseState('executing');
      console.log('🎵 [Recording] Executing transaction...');

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

      console.log('🎵 [Recording] Transaction executed:', executeData.txHash);

      // Step 7: Get trimmed audio and upload directly to Supabase
      setPurchaseState('saving');
      console.log('🎵 [Recording] Getting trimmed audio...');

      const audioBlob = await getAudioForTrim();
      if (!audioBlob) {
        throw new Error('Failed to create trimmed audio');
      }

      console.log(`🎵 [Recording] Audio blob size: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB`);

      // Step 7a: Get signed upload URL
      console.log('🎵 [Recording] Getting upload URL...');
      const uploadUrlResponse = await fetch('/api/recording/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          walletAddress: suiAddress,
        }),
      });

      const uploadUrlData = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok) {
        throw new Error(uploadUrlData.error || 'Failed to get upload URL');
      }

      // Step 7b: Upload directly to Supabase Storage
      console.log('🎵 [Recording] Uploading audio to Supabase...');
      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'audio/wav',
        },
        body: audioBlob,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('🎵 [Recording] Upload failed:', errorText);
        throw new Error('Failed to upload audio file');
      }

      console.log('🎵 [Recording] Audio uploaded, saving draft...');

      // Step 7c: Upload video if available
      let videoUrl: string | null = null;
      if (hasVideo && getVideoForTrim) {
        console.log('🎬 [Recording] Getting trimmed video...');
        const videoBlob = await getVideoForTrim();
        if (videoBlob) {
          console.log(`🎬 [Recording] Video blob size: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

          // Get signed upload URL for video
          const videoUploadUrlResponse = await fetch('/api/recording/get-upload-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId: payment.id,
              walletAddress: suiAddress,
              fileType: 'video',
            }),
          });

          const videoUploadUrlData = await videoUploadUrlResponse.json();
          if (videoUploadUrlResponse.ok) {
            // Upload video directly to Supabase Storage
            console.log('🎬 [Recording] Uploading video to Supabase...');
            const videoUploadResponse = await fetch(videoUploadUrlData.uploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'video/webm',
              },
              body: videoBlob,
            });

            if (videoUploadResponse.ok) {
              videoUrl = videoUploadUrlData.publicUrl;
              console.log('🎬 [Recording] Video uploaded:', videoUrl);
            } else {
              console.warn('🎬 [Recording] Video upload failed, continuing with audio only');
            }
          } else {
            console.warn('🎬 [Recording] Failed to get video upload URL, continuing with audio only');
          }
        }
      }

      // Step 7d: Save the draft with the audio URL (and video URL if available)
      const saveResponse = await fetch('/api/recording/confirm-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payment.id,
          txHash: executeData.txHash,
          audioUrl: uploadUrlData.publicUrl,
          videoUrl, // Will be null if no video
          title: `Recording ${new Date().toLocaleDateString()}`,
          bpm: recordingData.bpm,
          bars,
          creatorWallet: activePersona?.wallet_address || '',
          creatorSuiAddress: activePersona?.sui_address || suiAddress,
          sourceTracksMetadata: payment.sourceTracksMetadata,
        }),
      });

      const saveData = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(saveData.error || 'Failed to save recording');
      }

      console.log('🎵 [Recording] Draft saved:', saveData.draft.id);

      // Step 8: Success!
      setPurchaseState('success');

      // Close after brief delay
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      console.error('🎵 [Recording] Error:', err);
      setPurchaseState('error');
      setError(err instanceof Error ? err.message : 'Failed to process recording');
    }
  }, [
    suiAddress,
    authType,
    activePersona,
    trimState,
    loadedTracks,
    recordingData,
    getAudioForTrim,
    getVideoForTrim,
    hasVideo,
    onClose,
  ]);

  const handleClose = () => {
    // Don't allow closing during transaction
    if (['preparing', 'signing', 'executing', 'saving'].includes(purchaseState)) {
      return;
    }
    setPurchaseState('idle');
    setError(null);
    onClose();
  };

  if (!isOpen || !mounted) return null;

  const { waveformData, bpm, audioBuffer } = recordingData;
  const { startBars: trimStartBars, endBars: trimEndBars, totalBars } = trimState;

  // Calculate normalized playback position within selection
  const selectionStart = trimStartBars / totalBars;
  const selectionEnd = trimEndBars / totalBars;
  const selectionDuration = selectionEnd - selectionStart;
  const normalizedPosition = selectionStart + playbackPosition * selectionDuration;

  const isProcessing = ['preparing', 'signing', 'executing', 'saving'].includes(purchaseState);

  const getStatusMessage = () => {
    switch (purchaseState) {
      case 'preparing':
        return 'Preparing payment...';
      case 'signing':
        return 'Please approve the transaction...';
      case 'executing':
        return 'Processing payment...';
      case 'saving':
        return 'Saving your recording...';
      case 'success':
        return 'Recording saved successfully!';
      default:
        return null;
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50"
    >
      <div className="recording-widget bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-3xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 32px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Trim & Save Recording</h2>
            <p className="text-xs text-slate-400">
              Drag handles to select 8-bar blocks, then confirm to save
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Cancel"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* BPM and Duration Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-400">
              <span className="font-bold text-[#81E4F2]">{bpm}</span> BPM
            </div>
            <div className="text-slate-400">
              Total: <span className="font-bold">{totalBars.toFixed(1)}</span> bars
            </div>
          </div>

          {/* Waveform */}
          <RecordingWaveform
            waveformData={waveformData}
            bpm={bpm}
            totalBars={totalBars}
            trimStartBars={trimStartBars}
            trimEndBars={trimEndBars}
            onTrimStartChange={onTrimStartChange}
            onTrimEndChange={onTrimEndChange}
            playbackPosition={normalizedPosition}
            isPlaying={isPlaying}
          />

          {/* Trim Controls */}
          <TrimControls
            trimStartBars={trimStartBars}
            trimEndBars={trimEndBars}
            totalBars={totalBars}
            onNudge={onNudge}
          />

          {/* Block Audition */}
          <BlockAudition
            audioBuffer={audioBuffer}
            bpm={bpm}
            trimStartBars={trimStartBars}
            trimEndBars={trimEndBars}
            onPlaybackPositionChange={setPlaybackPosition}
            onPlayingChange={setIsPlaying}
          />

          {/* Source Tracks */}
          {loadedTracks.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">
                Source Tracks ({loadedTracks.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {loadedTracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-2 py-1"
                  >
                    {track.cover_image_url && (
                      <img
                        src={track.cover_image_url}
                        alt=""
                        className="w-6 h-6 rounded object-cover"
                      />
                    )}
                    <span className="text-xs text-slate-300 max-w-[120px] truncate">
                      {track.title}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {track.bpm || '?'} BPM
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost Display */}
          <CostDisplay costInfo={costInfo} />

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-red-300">
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Status Display */}
          {getStatusMessage() && !error && (
            <div className={`flex items-center justify-center gap-2 py-2 text-sm ${
              purchaseState === 'success' ? 'text-green-400' : 'text-[#81E4F2]'
            }`}>
              {isProcessing && <Loader2 size={16} className="animate-spin" />}
              {purchaseState === 'success' && <Check size={16} />}
              {getStatusMessage()}
            </div>
          )}

          {/* Auth Warning */}
          {!suiAddress && (
            <div className="bg-amber-500/20 border border-amber-500/50 rounded-lg p-3 text-amber-300 text-sm text-center">
              Please sign in with Google to save your recording
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            onClick={handleConfirm}
            disabled={isProcessing || !suiAddress || purchaseState === 'success'}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              purchaseState === 'success'
                ? 'bg-green-500 text-white'
                : 'bg-gradient-to-r from-[#81E4F2] to-cyan-400 text-slate-900 hover:opacity-90'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Processing...
              </>
            ) : purchaseState === 'success' ? (
              <>
                <Check size={16} />
                Saved!
              </>
            ) : (
              <>
                <Check size={16} />
                Confirm & Pay ${costInfo.totalCost.toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
