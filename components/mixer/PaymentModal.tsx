"use client";

import React, { useState, useEffect } from 'react';
import { X, Download, Music, FileText, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { generateMixCoverImage } from '@/lib/generateMixCoverImage';
import { useMixer } from '@/contexts/MixerContext';
import { supabase } from '@/lib/supabase';
import { CertificateService } from '@/lib/certificate-service';
import { openContractCall } from '@stacks/connect';
import { uintCV, listCV, tupleCV, standardPrincipalCV, PostConditionMode } from '@stacks/transactions';
import { calculateRemixSplits } from '@/lib/calculateRemixSplits';

interface TrackInfo {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  imageUrl?: string;
  allowOfflineUse?: boolean;
  licenseTerms?: string;
}

interface PaymentModalProps {
  selectedSegment: { start: number; end: number };
  recordingUrl: string;
  deckATrack: TrackInfo | null;
  deckBTrack: TrackInfo | null;
  bpm: number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({
  selectedSegment,
  recordingUrl,
  deckATrack,
  deckBTrack,
  bpm,
  onClose,
  onSuccess
}: PaymentModalProps) {
  const { isAuthenticated, connectWallet, walletAddress } = useAuth();
  const { loadedTracks } = useMixer();
  const [selectedOption, setSelectedOption] = useState<'loop-only' | 'loop-plus-sources'>('loop-only');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sourceLoopsAvailable, setSourceLoopsAvailable] = useState(false);
  const [mixCoverImageUrl, setMixCoverImageUrl] = useState<string | null>(null);
  const [mixTitle, setMixTitle] = useState(`${deckATrack?.title || 'Track A'} x ${deckBTrack?.title || 'Track B'} Mix`);

  // Check if source loops are available for offline use
  useEffect(() => {
    const deckAAllows = deckATrack?.allowOfflineUse ?? false;
    const deckBAllows = deckBTrack?.allowOfflineUse ?? false;
    setSourceLoopsAvailable(deckAAllows && deckBAllows);
  }, [deckATrack, deckBTrack]);

  // Generate mix cover image
  useEffect(() => {
    const generateCoverImage = async () => {
      if (!deckATrack?.imageUrl || !deckBTrack?.imageUrl) return;
      
      try {
        const blob = await generateMixCoverImage(
          deckATrack.imageUrl,
          deckBTrack.imageUrl
          // TODO: Add profile image URL when available
        );
        
        const url = URL.createObjectURL(blob);
        setMixCoverImageUrl(url);
      } catch (error) {
        console.error('Failed to generate mix cover image:', error);
      }
    };
    
    generateCoverImage();
    
    return () => {
      if (mixCoverImageUrl) {
        URL.revokeObjectURL(mixCoverImageUrl);
      }
    };
  }, [deckATrack?.imageUrl, deckBTrack?.imageUrl]);

  // Calculate pricing based on source track prices
  const calculatePrices = () => {
    // Base price for the 8-bar mix (could be a platform fee or percentage)
    const mixBasePrice = 2; // STX platform fee for creating a mix
    
    // Get source track prices
    const deckAPrice = deckATrack?.price_stx || 5; // Default to 5 STX if not set
    const deckBPrice = deckBTrack?.price_stx || 5; // Default to 5 STX if not set
    
    // Loop only: Just the platform fee for the mix
    const loopOnly = mixBasePrice;
    
    // Loop + sources: Platform fee + both source track prices
    const loopPlusSources = mixBasePrice + deckAPrice + deckBPrice;
    
    return {
      loopOnlyPrice: loopOnly,
      loopPlusSourcesPrice: loopPlusSources
    };
  };
  
  const { loopOnlyPrice, loopPlusSourcesPrice } = calculatePrices();

  const handlePayment = async () => {
    if (!agreedToTerms) {
      alert('Please agree to the licensing terms');
      return;
    }

    if (!isAuthenticated || !walletAddress) {
      await connectWallet();
      return;
    }

    setIsProcessing(true);

    try {
      // Calculate the total price in microSTX
      const totalPriceSTX = selectedOption === 'loop-only' ? loopOnlyPrice : loopPlusSourcesPrice;
      const totalPriceMicroSTX = Math.floor(totalPriceSTX * 1_000_000);

      console.log('💰 Processing payment...', {
        option: selectedOption,
        priceSTX: totalPriceSTX,
        priceMicroSTX: totalPriceMicroSTX,
        segment: selectedSegment,
        deckA: deckATrack?.title,
        deckB: deckBTrack?.title
      });

      // Calculate remix splits (80/20 formula)
      const remixSplits = calculateRemixSplits(
        deckATrack || {},
        deckBTrack || {},
        walletAddress!
      );

      console.log('📊 Remix splits calculated:', {
        composition: remixSplits.composition,
        production: remixSplits.production,
        totalComposition: remixSplits.totalComposition,
        totalProduction: remixSplits.totalProduction
      });

      // Convert splits to Clarity values
      const compositionCV = listCV(
        remixSplits.composition.map(split =>
          tupleCV({
            wallet: standardPrincipalCV(split.wallet),
            percentage: uintCV(split.percentage)
          })
        )
      );

      const productionCV = listCV(
        remixSplits.production.map(split =>
          tupleCV({
            wallet: standardPrincipalCV(split.wallet),
            percentage: uintCV(split.percentage)
          })
        )
      );

      // Call smart contract for payment
      let stacksTxId: string | null = null;

      console.log('🔐 About to call openContractCall...');
      console.log('🔐 openContractCall function exists?', typeof openContractCall);

      await new Promise<void>((resolve, reject) => {
        console.log('🔐 Inside Promise, calling openContractCall now...');
        try {
          openContractCall({
            network: 'mainnet',
            contractAddress: 'SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN',
            contractName: 'music-payment-splitter-v3',
            functionName: 'split-track-payment',
            functionArgs: [
              uintCV(totalPriceMicroSTX),
              compositionCV,
              productionCV
            ],
            postConditionMode: PostConditionMode.Allow,
            onFinish: (data) => {
              console.log('✅ Payment transaction completed:', data.txId);
              console.log('✅ Full transaction data:', data);
              stacksTxId = data.txId;
              resolve();
            },
            onCancel: () => {
              console.log('❌ Payment cancelled by user');
              reject(new Error('Payment cancelled'));
            }
          });
        } catch (error) {
          console.error('❌ openContractCall error:', error);
          reject(error);
        }
      });

      if (!stacksTxId) {
        throw new Error('Payment transaction failed - no transaction ID received');
      }

      // Calculate remix depth from loaded tracks
      const maxDepth = Math.max(...loadedTracks.map(t => t.remix_depth || 0), 0);
      const newRemixDepth = maxDepth + 1;
      const sourceTrackIds = loadedTracks.map(t => t.id);

      console.log('🧬 Calculating remix depth:', {
        loadedTracks: loadedTracks.length,
        maxDepth,
        newRemixDepth,
        sourceTrackIds
      });

      // LIMIT: Maximum remix depth of 2 to prevent contributor explosion
      if (newRemixDepth > 2) {
        throw new Error('Cannot remix this content - maximum remix depth (2 generations) exceeded. This prevents contributor lists from becoming unmanageable.');
      }

      // Prepare the new remix track data with full split attribution
      const newRemixData = {
        id: crypto.randomUUID(),
        title: mixTitle,
        artist: 'You', // TODO: Get from profile
        primary_uploader_wallet: walletAddress, // The wallet that owns this track in their store
        uploader_address: walletAddress, // Legacy field - required by database

        // Remix depth tracking
        remix_depth: newRemixDepth,
        source_track_ids: sourceTrackIds,

        // Mix metadata
        bpm: bpm,
        content_type: 'loop',
        loop_category: 'remix',
        sample_type: 'instrumentals',

        // Recording data
        audio_url: recordingUrl, // TODO: Upload to storage
        cover_image_url: mixCoverImageUrl, // TODO: Upload to storage

        // Stacks transaction
        stacks_tx_id: stacksTxId,

        // IP Attribution - Composition (from calculated splits)
        composition_split_1_wallet: remixSplits.composition[0]?.wallet,
        composition_split_1_percentage: remixSplits.composition[0]?.percentage,
        composition_split_2_wallet: remixSplits.composition[1]?.wallet,
        composition_split_2_percentage: remixSplits.composition[1]?.percentage,
        composition_split_3_wallet: remixSplits.composition[2]?.wallet,
        composition_split_3_percentage: remixSplits.composition[2]?.percentage,

        // IP Attribution - Production (from calculated splits)
        production_split_1_wallet: remixSplits.production[0]?.wallet,
        production_split_1_percentage: remixSplits.production[0]?.percentage,
        production_split_2_wallet: remixSplits.production[1]?.wallet,
        production_split_2_percentage: remixSplits.production[1]?.percentage,
        production_split_3_wallet: remixSplits.production[2]?.wallet,
        production_split_3_percentage: remixSplits.production[2]?.percentage,

        // Additional metadata
        tags: ['remix', '8-bar', 'mixer'],
        description: `8-bar remix created in Mixmi Mixer from bars ${selectedSegment.start + 1} to ${selectedSegment.end}`,
        license_type: 'remix_only', // Must be one of: remix_only, remix_external, custom
        allow_remixing: true,
        price_stx: 1.0, // 1 STX per remix loop (matches source loop pricing)

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('💾 Attempting to save remix data:', JSON.stringify(newRemixData, null, 2));

      // Save to database
      const { data, error } = await supabase
        .from('ip_tracks')
        .insert([newRemixData])
        .select()
        .single();

      if (error) {
        console.error('❌ Database save error:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        });
        throw new Error(`Failed to save remix to database: ${error.message || 'Unknown error'}`);
      }

      console.log('✅ Remix saved successfully:', {
        id: data.id,
        title: data.title,
        remix_depth: data.remix_depth,
        source_track_ids: data.source_track_ids
      });

      // Generate certificate for the remix
      console.log('🎓 Generating certificate for remix...');

      const certificateData = {
        id: data.id,
        title: data.title,
        artist: data.artist || 'You',
        duration: undefined, // TODO: Calculate from segment duration
        bpm: data.bpm,
        key: undefined,
        tags: data.tags || [],
        description: data.description,
        composition_splits: remixSplits.composition.map((split, index) => ({
          name: index === 0 ? 'Remixer' : `Contributor ${index}`,
          wallet: split.wallet,
          percentage: split.percentage
        })),
        production_splits: remixSplits.production.map((split, index) => ({
          name: `Producer ${index + 1}`,
          wallet: split.wallet,
          percentage: split.percentage
        })),
        license_type: data.license_type || 'RMX',
        price_stx: data.price_stx,
        stacksTxId: stacksTxId,
        blockHeight: undefined, // TODO: Get from Stacks
        walletAddress: walletAddress,
        timestamp: new Date()
      };

      // Generate certificate asynchronously
      CertificateService.generateAndStoreCertificate(certificateData)
        .then(result => {
          console.log('✅ Certificate generated for remix:', result);
        })
        .catch(error => {
          console.error('❌ Certificate generation failed:', error);
          // Don't block on certificate failure
        });
      
      onSuccess();
    } catch (error: any) {
      console.error('💥 Payment/save failed:', error);

      // Provide specific error messages
      let errorMessage = 'Failed to save your remix. Please try again.';

      if (error.message === 'Payment cancelled') {
        errorMessage = 'Payment was cancelled. Your remix was not saved.';
      } else if (error.message?.includes('transaction')) {
        errorMessage = 'Payment transaction failed. Please check your wallet and try again.';
      } else if (error.message?.includes('database')) {
        errorMessage = 'Database error. Please contact support if this persists.';
      }

      alert(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000] flex items-center justify-center">
      <div className="bg-slate-900 rounded-lg p-6 max-w-2xl w-full mx-4 border border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Purchase Your Mix</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mix title input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Mix Title
          </label>
          <input
            type="text"
            value={mixTitle}
            onChange={(e) => setMixTitle(e.target.value)}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            placeholder="Enter a title for your remix..."
          />
        </div>

        {/* Selected segment info and preview */}
        <div className="flex gap-4 mb-6">
          {/* Mix cover image preview */}
          {mixCoverImageUrl && (
            <div className="flex-shrink-0">
              <img
                src={mixCoverImageUrl}
                alt="Mix cover"
                className="w-32 h-32 rounded-lg object-cover border border-slate-700"
              />
              <p className="text-xs text-gray-500 mt-1 text-center">Auto-generated</p>
            </div>
          )}

          {/* Segment info */}
          <div className="flex-1 bg-slate-800 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-1">Selected Segment</p>
            <p className="text-white font-semibold mb-2">
              Bars {selectedSegment.start + 1} to {selectedSegment.end}
              ({selectedSegment.end - selectedSegment.start} bars at {bpm} BPM)
            </p>
            <p className="text-xs text-gray-500">
              This image will be used as the cover for your mix in the creator store
            </p>
          </div>
        </div>

        {/* Purchase options */}
        <div className="space-y-4 mb-6">
          {/* Option 1: Loop only */}
          <label className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
            selectedOption === 'loop-only' 
              ? 'border-cyan-500 bg-cyan-500/10' 
              : 'border-slate-600 hover:border-slate-500'
          }`}>
            <input
              type="radio"
              name="purchase-option"
              value="loop-only"
              checked={selectedOption === 'loop-only'}
              onChange={() => setSelectedOption('loop-only')}
              className="sr-only"
            />
            <div className="flex items-start gap-3">
              <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                selectedOption === 'loop-only' ? 'border-cyan-500' : 'border-slate-500'
              }`}>
                {selectedOption === 'loop-only' && (
                  <div className="w-2 h-2 rounded-full bg-cyan-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Music className="w-4 h-4 text-gray-400" />
                  <span className="font-semibold text-white">8-Bar Mix Only</span>
                  <span className="text-cyan-400 font-bold ml-auto">{loopOnlyPrice} STX</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Your selected 8-bar mix for use in the Mixmi ecosystem
                </p>
              </div>
            </div>
          </label>

          {/* Option 2: Loop + sources (if available) */}
          {sourceLoopsAvailable && (
            <label className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
              selectedOption === 'loop-plus-sources' 
                ? 'border-cyan-500 bg-cyan-500/10' 
                : 'border-slate-600 hover:border-slate-500'
            }`}>
              <input
                type="radio"
                name="purchase-option"
                value="loop-plus-sources"
                checked={selectedOption === 'loop-plus-sources'}
                onChange={() => setSelectedOption('loop-plus-sources')}
                className="sr-only"
              />
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  selectedOption === 'loop-plus-sources' ? 'border-cyan-500' : 'border-slate-500'
                }`}>
                  {selectedOption === 'loop-plus-sources' && (
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Download className="w-4 h-4 text-gray-400" />
                    <span className="font-semibold text-white">Mix + Source Loops</span>
                    <span className="text-cyan-400 font-bold ml-auto">{loopPlusSourcesPrice} STX</span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Includes your 8-bar mix plus the original loops for offline production
                  </p>
                  <div className="flex flex-col gap-1 pl-6">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Check className="w-3 h-3" />
                      <span>Deck A: {deckATrack?.title || 'Unknown'} ({deckATrack?.price_stx || 5} STX)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Check className="w-3 h-3" />
                      <span>Deck B: {deckBTrack?.title || 'Unknown'} ({deckBTrack?.price_stx || 5} STX)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Check className="w-3 h-3" />
                      <span>Platform fee: 2 STX</span>
                    </div>
                  </div>
                </div>
              </div>
            </label>
          )}

          {!sourceLoopsAvailable && (
            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
              <p className="text-gray-500 text-sm">
                <span className="text-yellow-500">Note:</span> The source loops are not available for offline use 
                due to creator licensing restrictions.
              </p>
            </div>
          )}
        </div>

        {/* Terms agreement */}
        <div className="mb-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-slate-600 text-cyan-500 focus:ring-cyan-500"
            />
            <div className="flex-1">
              <p className="text-sm text-gray-300">
                I agree to the licensing terms for app and offline use. I understand that:
              </p>
              <ul className="mt-2 text-xs text-gray-400 space-y-1">
                <li>• The 8-bar mix will be added to my creator store with automatic IP attribution</li>
                <li>• Original creators will receive their designated splits</li>
                <li>• I will receive 20% attribution as the remixer</li>
                <li>• I can remove the mix from my store at any time</li>
                {selectedOption === 'loop-plus-sources' && (
                  <li>• Source loops are for offline production use only per creator terms</li>
                )}
              </ul>
            </div>
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={!agreedToTerms || isProcessing}
            className={`px-6 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
              agreedToTerms && !isProcessing
                ? 'bg-cyan-500 hover:bg-cyan-600 text-white' 
                : 'bg-slate-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Pay {selectedOption === 'loop-only' ? loopOnlyPrice : loopPlusSourcesPrice} STX
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}