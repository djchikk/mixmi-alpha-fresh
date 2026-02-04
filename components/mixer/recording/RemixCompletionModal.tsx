"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import RemixStepTrim from './RemixStepTrim';
import RemixStepDetails from './RemixStepDetails';
import RemixStepCover from './RemixStepCover';
import RemixStepConfirm from './RemixStepConfirm';
import RemixStepSuccess from './RemixStepSuccess';
import { RecordingData, TrimState, RecordingCostInfo } from '@/hooks/useMixerRecording';
import { IPTrack } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// Step definitions
const STEPS = [
  { id: 'trim', label: 'Trim', number: 1 },
  { id: 'details', label: 'Details', number: 2 },
  { id: 'cover', label: 'Cover', number: 3 },
  { id: 'confirm', label: 'Confirm', number: 4 },
  { id: 'success', label: 'Done', number: 5 },
] as const;

type StepId = typeof STEPS[number]['id'];

// Location with coordinates
export interface RemixLocation {
  name: string;
  lat: number;
  lng: number;
}

// Remix details form state
export interface RemixDetails {
  name: string;
  tags: string[];
  notes: string;
  locations: RemixLocation[];
}

// Payment recipient info (from prepare-payment API)
export interface PaymentRecipient {
  sui_address: string;
  amount: number;
  payment_type: 'platform' | 'composition' | 'production';
  source_track_id?: string;
  source_track_title?: string;
  percentage: number;
  display_name?: string;
}

export interface RemixCompletionModalProps {
  isOpen: boolean;
  recordingData: RecordingData;
  trimState: TrimState;
  costInfo: RecordingCostInfo;
  loadedTracks: IPTrack[];
  onClose: () => void;
  onTrimStartChange: (bars: number) => void;
  onTrimEndChange: (bars: number) => void;
  onNudge: (point: 'start' | 'end', direction: 'left' | 'right', resolution: number) => void;
  getAudioForTrim: () => Promise<Blob | null>;
  getVideoForTrim?: () => Promise<Blob | null>;
  hasVideo?: boolean;
}

export default function RemixCompletionModal({
  isOpen,
  recordingData,
  trimState,
  costInfo,
  loadedTracks,
  onClose,
  onTrimStartChange,
  onTrimEndChange,
  onNudge,
  getAudioForTrim,
  getVideoForTrim,
  hasVideo = false,
}: RemixCompletionModalProps) {
  const { suiAddress, authType, activePersona } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState<StepId>('trim');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remix details state (populated in Step 2)
  const [remixDetails, setRemixDetails] = useState<RemixDetails>({
    name: `Recording ${new Date().toLocaleDateString()}`,
    tags: [],
    notes: '',
    locations: [],
  });

  // Payment state (set after Step 4 prepares payment)
  const [paymentData, setPaymentData] = useState<{
    id: string;
    recipients: PaymentRecipient[];
    totalCost: number;
    sourceTracksMetadata: any[];
  } | null>(null);

  // Cover image state (generated in Step 3 for audio-only)
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);

  // Transaction result (set after successful payment)
  const [txResult, setTxResult] = useState<{
    txHash: string;
    draftId: string;
  } | null>(null);

  // Track if we've already done initial aggregation (to avoid overwriting user edits)
  const hasAggregatedRef = useRef(false);

  // Ensure we're on client side for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-aggregate tags, notes, locations from source tracks (ONCE only)
  useEffect(() => {
    // Only aggregate once on initial load, not on every loadedTracks change
    if (loadedTracks.length > 0 && !hasAggregatedRef.current) {
      hasAggregatedRef.current = true;
      // Aggregate tags from all source tracks
      const allTags = new Set<string>();
      loadedTracks.forEach(track => {
        if (track.tags && Array.isArray(track.tags)) {
          track.tags.forEach(tag => allTags.add(tag));
        }
      });
      // Add 'remix' tag
      allTags.add('remix');

      // Aggregate notes with attribution
      const notesArray = loadedTracks
        .filter(track => track.notes)
        .map(track => `[${track.title}]: ${track.notes}`);

      // Aggregate locations with coordinates
      const locationMap = new Map<string, RemixLocation>();
      loadedTracks.forEach(track => {
        // Add from locations array (has full coordinates)
        if (track.locations && Array.isArray(track.locations)) {
          track.locations.forEach(loc => {
            if (loc.name && !locationMap.has(loc.name)) {
              locationMap.set(loc.name, {
                name: loc.name,
                lat: loc.lat || 0,
                lng: loc.lng || 0,
              });
            }
          });
        }
        // Add primary_location if it has coordinates
        if (track.primary_location && !locationMap.has(track.primary_location)) {
          locationMap.set(track.primary_location, {
            name: track.primary_location,
            lat: track.location_lat || 0,
            lng: track.location_lng || 0,
          });
        }
      });

      setRemixDetails(prev => ({
        ...prev,
        tags: Array.from(allTags),
        notes: notesArray.join('\n\n'),
        locations: Array.from(locationMap.values()),
      }));
    }
  }, [loadedTracks]);

  // Get current step index
  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Navigation handlers
  const goToNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex].id);
      setError(null);
    }
  }, [currentStepIndex]);

  const goToPrevStep = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex].id);
      setError(null);
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((stepId: StepId) => {
    // Don't allow jumping to success step directly
    if (stepId === 'success' && !txResult) return;
    // Don't allow going back from success
    if (currentStep === 'success') return;
    setCurrentStep(stepId);
    setError(null);
  }, [currentStep, txResult]);

  // Handle close - don't allow during processing
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    // Reset state
    setCurrentStep('trim');
    setError(null);
    setPaymentData(null);
    setCoverImageUrl(null);
    setTxResult(null);
    hasAggregatedRef.current = false; // Allow re-aggregation on next open
    onClose();
  }, [isProcessing, onClose]);

  // Skip cover step for video remixes
  const getNextStep = useCallback((fromStep: StepId): StepId => {
    if (fromStep === 'details' && hasVideo) {
      return 'confirm'; // Skip cover step for video
    }
    const currentIndex = STEPS.findIndex(s => s.id === fromStep);
    return STEPS[currentIndex + 1]?.id || 'success';
  }, [hasVideo]);

  const getPrevStep = useCallback((fromStep: StepId): StepId => {
    if (fromStep === 'confirm' && hasVideo) {
      return 'details'; // Skip cover step going back for video
    }
    const currentIndex = STEPS.findIndex(s => s.id === fromStep);
    return STEPS[currentIndex - 1]?.id || 'trim';
  }, [hasVideo]);

  if (!isOpen || !mounted) return null;

  // Determine which steps to show in progress indicator
  const visibleSteps = hasVideo
    ? STEPS.filter(s => s.id !== 'cover')
    : STEPS;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="remix-completion-modal bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 32px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">
              {currentStep === 'success' ? 'Remix Complete!' : 'Complete Your Remix'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Indicator */}
        {currentStep !== 'success' && (
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800/30 border-b border-slate-700/50">
            {visibleSteps.slice(0, -1).map((step, index) => {
              const stepIndex = STEPS.findIndex(s => s.id === step.id);
              const isActive = step.id === currentStep;
              const isCompleted = currentStepIndex > stepIndex;
              const isClickable = isCompleted && !isProcessing;

              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => isClickable && goToStep(step.id)}
                    disabled={!isClickable}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#81E4F2] text-slate-900'
                        : isCompleted
                        ? 'bg-slate-700 text-slate-300 hover:bg-slate-600 cursor-pointer'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isActive ? 'bg-slate-900/20' : isCompleted ? 'bg-slate-600' : 'bg-slate-700'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {index < visibleSteps.length - 2 && (
                    <ChevronRight size={14} className="text-slate-600" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {currentStep === 'trim' && (
            <RemixStepTrim
              recordingData={recordingData}
              trimState={trimState}
              costInfo={costInfo}
              loadedTracks={loadedTracks}
              onTrimStartChange={onTrimStartChange}
              onTrimEndChange={onTrimEndChange}
              onNudge={onNudge}
            />
          )}

          {currentStep === 'details' && (
            <RemixStepDetails
              remixDetails={remixDetails}
              onDetailsChange={setRemixDetails}
              loadedTracks={loadedTracks}
            />
          )}

          {currentStep === 'cover' && !hasVideo && (
            <RemixStepCover
              loadedTracks={loadedTracks}
              coverImageUrl={coverImageUrl}
              onCoverGenerated={setCoverImageUrl}
            />
          )}

          {currentStep === 'confirm' && (
            <RemixStepConfirm
              remixDetails={remixDetails}
              costInfo={costInfo}
              loadedTracks={loadedTracks}
              paymentData={paymentData}
              onPaymentPrepared={setPaymentData}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              error={error}
              setError={setError}
              trimState={trimState}
              recordingData={recordingData}
              getAudioForTrim={getAudioForTrim}
              getVideoForTrim={getVideoForTrim}
              hasVideo={hasVideo}
              coverImageUrl={coverImageUrl}
              onSuccess={(txHash, draftId) => {
                setTxResult({ txHash, draftId });
                setCurrentStep('success');
              }}
            />
          )}

          {currentStep === 'success' && (
            <RemixStepSuccess
              remixDetails={remixDetails}
              txResult={txResult}
              hasVideo={hasVideo}
              coverImageUrl={coverImageUrl}
              loadedTracks={loadedTracks}
              onClose={handleClose}
            />
          )}
        </div>

        {/* Footer Navigation */}
        {currentStep !== 'success' && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 bg-slate-800/50">
            <button
              onClick={() => {
                if (currentStep === 'trim') {
                  handleClose();
                } else {
                  setCurrentStep(getPrevStep(currentStep));
                }
              }}
              disabled={isProcessing}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              {currentStep === 'trim' ? 'Cancel' : 'Back'}
            </button>

            {/* Error display */}
            {error && (
              <div className="flex-1 mx-4 text-center text-red-400 text-sm truncate">
                {error}
              </div>
            )}

            {currentStep !== 'confirm' && (
              <button
                onClick={() => setCurrentStep(getNextStep(currentStep))}
                disabled={isProcessing}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[#81E4F2] text-slate-900 font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}

            {/* Confirm step has its own button inside the step component */}
            {currentStep === 'confirm' && !isProcessing && (
              <div /> // Placeholder for layout
            )}

            {currentStep === 'confirm' && isProcessing && (
              <div className="flex items-center gap-2 text-[#81E4F2]">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Processing...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
