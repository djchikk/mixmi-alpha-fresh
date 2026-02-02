"use client";

import React, { useState, useCallback } from 'react';
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
}: RecordingWidgetProps) {
  const { suiAddress, authType, activePersona } = useAuth();
  const [purchaseState, setPurchaseState] = useState<PurchaseState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

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
          payerSuiAddress: suiAddress,
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

      // Step 5: Sign with zkLogin
      const keypair = zkSession.ephemeralKeyPair;
      const txBytesArray = Uint8Array.from(atob(txBytes), c => c.charCodeAt(0));

      const { signature: ephemeralSignature } = await keypair.signTransaction(txBytesArray);

      // Decode JWT for address seed
      const [, payload] = zkSession.jwt.split('.');
      const jwtPayload = JSON.parse(atob(payload));
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

      // Step 7: Get trimmed audio and save
      setPurchaseState('saving');
      console.log('🎵 [Recording] Saving draft...');

      const audioBlob = await getAudioForTrim();
      if (!audioBlob) {
        throw new Error('Failed to create trimmed audio');
      }

      const formData = new FormData();
      formData.append('paymentId', payment.id);
      formData.append('txHash', executeData.txHash);
      formData.append('audioFile', audioBlob, 'recording.wav');
      formData.append('title', `Recording ${new Date().toLocaleDateString()}`);
      formData.append('bpm', recordingData.bpm.toString());
      formData.append('bars', bars.toString());
      formData.append('creatorWallet', activePersona?.wallet_address || '');
      formData.append('creatorSuiAddress', suiAddress);
      formData.append('sourceTracksMetadata', JSON.stringify(payment.sourceTracksMetadata));

      const saveResponse = await fetch('/api/recording/confirm-and-save', {
        method: 'POST',
        body: formData,
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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none">
      <div className="recording-widget bg-slate-900 rounded-xl shadow-2xl border border-slate-700 max-w-2xl w-full max-h-[80vh] overflow-y-auto pointer-events-auto">
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
}
