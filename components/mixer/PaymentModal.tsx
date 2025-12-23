"use client";

import React, { useState, useEffect } from 'react';
import { X, Download, Music, FileText, Check } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { generateMixCoverImage } from '@/lib/generateMixCoverImage';
import { useMixer } from '@/contexts/MixerContext';
import { supabase } from '@/lib/supabase';
import { CertificateService } from '@/lib/certificate-service';
import { openContractCall } from '@stacks/connect';
import { uintCV, listCV, tupleCV, standardPrincipalCV, PostConditionMode } from '@stacks/transactions';
import { calculateRemixSplits } from '@/lib/calculateRemixSplits';
import { SupabaseAuthBridge } from '@/lib/auth/supabase-auth-bridge';
import { toast } from 'sonner';

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
  downloadDeckA: boolean;
  downloadDeckB: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaymentModal({
  selectedSegment,
  recordingUrl,
  deckATrack,
  deckBTrack,
  bpm,
  downloadDeckA,
  downloadDeckB,
  onClose,
  onSuccess
}: PaymentModalProps) {
  const { isAuthenticated, connectWallet, walletAddress } = useAuth();
  const { addToCart } = useCart();
  const { loadedTracks } = useMixer();
  const [selectedOption, setSelectedOption] = useState<'loop-only' | 'loop-plus-sources'>('loop-only');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sourceLoopsAvailable, setSourceLoopsAvailable] = useState(false);
  const [mixCoverImageUrl, setMixCoverImageUrl] = useState<string | null>(null);
  const [mixTitle, setMixTitle] = useState(`${deckATrack?.title || 'Track A'} x ${deckBTrack?.title || 'Track B'} Mix`);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [artistName, setArtistName] = useState<string>('');

  // Fetch user's profile data (image and name)
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!walletAddress) return;

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('avatar_url, display_name, username')
          .eq('wallet_address', walletAddress)
          .single();

        if (!error && data) {
          // Set profile image if available
          if (data.avatar_url) {
            setProfileImageUrl(data.avatar_url);
          }

          // Set artist name - priority: display_name > username > wallet address
          let name = walletAddress;
          if (data.display_name && data.display_name !== 'New User') {
            name = data.display_name;
          } else if (data.username) {
            name = data.username;
          }

          setArtistName(name);
        } else {
          // Fallback to wallet address if no profile found
          setArtistName(walletAddress);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
        // Fallback to wallet address on error
        if (walletAddress) {
          setArtistName(walletAddress);
        }
      }
    };

    fetchProfileData();
  }, [walletAddress]);

  // Check if source loops are available for offline use
  useEffect(() => {
    const deckAAllows = deckATrack?.allowOfflineUse ?? false;
    const deckBAllows = deckBTrack?.allowOfflineUse ?? false;
    setSourceLoopsAvailable(deckAAllows && deckBAllows);
  }, [deckATrack, deckBTrack]);

  // Generate mix cover image (regenerate when profile image is loaded)
  useEffect(() => {
    const generateCoverImage = async () => {
      if (!deckATrack?.imageUrl || !deckBTrack?.imageUrl) return;

      try {
        const blob = await generateMixCoverImage(
          deckATrack.imageUrl,
          deckBTrack.imageUrl,
          profileImageUrl || undefined // Pass profile image if available
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
  }, [deckATrack?.imageUrl, deckBTrack?.imageUrl, profileImageUrl]);

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

  // Helper function to convert blob URL to File object
  const blobUrlToFile = async (blobUrl: string, filename: string): Promise<File> => {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new File([blob], filename, { type: blob.type });
  };

  // Helper function to upload remix audio to Supabase storage
  const uploadRemixAudio = async (blobUrl: string): Promise<string> => {
    try {
      // Convert blob URL to File
      const timestamp = Date.now();
      const filename = `remix_${timestamp}.webm`;
      const audioFile = await blobUrlToFile(blobUrl, filename);

      if (!walletAddress) {
        throw new Error('Wallet address is required for upload');
      }

      // Create authenticated session
      const authSession = await SupabaseAuthBridge.createWalletSession(walletAddress);

      if (!authSession?.supabase) {
        throw new Error('Failed to create authenticated session for upload');
      }

      // Generate storage path
      const audioPath = `${walletAddress}/audio/remixes/${timestamp}_${filename}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await authSession.supabase.storage
        .from('user-content')
        .upload(audioPath, audioFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: audioFile.type
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = authSession.supabase.storage
        .from('user-content')
        .getPublicUrl(audioPath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload remix audio:', error);
      throw new Error('Failed to upload remix audio to storage');
    }
  };

  // Helper function to upload cover image to Supabase storage
  const uploadCoverImage = async (blobUrl: string): Promise<string> => {
    try {
      // Convert blob URL to File
      const timestamp = Date.now();
      const filename = `remix_cover_${timestamp}.png`;
      const imageFile = await blobUrlToFile(blobUrl, filename);

      if (!walletAddress) {
        throw new Error('Wallet address is required for upload');
      }

      // Create authenticated session
      const authSession = await SupabaseAuthBridge.createWalletSession(walletAddress);

      if (!authSession?.supabase) {
        throw new Error('Failed to create authenticated session for upload');
      }

      // Generate storage path
      const imagePath = `${walletAddress}/images/remixes/${timestamp}_${filename}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await authSession.supabase.storage
        .from('user-content')
        .upload(imagePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: imageFile.type
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = authSession.supabase.storage
        .from('user-content')
        .getPublicUrl(imagePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload cover image:', error);
      throw new Error('Failed to upload cover image to storage');
    }
  };

  const handlePayment = async () => {
    if (!agreedToTerms) {
      toast.error('Please agree to the licensing terms');
      return;
    }

    if (!isAuthenticated || !walletAddress) {
      await connectWallet();
      return;
    }

    setIsProcessing(true);

    try {
      // Upload audio to storage before payment
      const permanentAudioUrl = await uploadRemixAudio(recordingUrl);

      // Upload cover image to storage
      let permanentCoverUrl = mixCoverImageUrl;
      if (mixCoverImageUrl) {
        permanentCoverUrl = await uploadCoverImage(mixCoverImageUrl);
      }

      // Calculate the total price in microSTX (always 2 STX for remix payment)
      const totalPriceSTX = 2; // 1 STX per source loop
      const totalPriceMicroSTX = Math.floor(totalPriceSTX * 1_000_000);

      // Calculate remix splits (80/20 formula)
      // We need to use loadedTracks instead of deckATrack/deckBTrack because
      // deckATrack/deckBTrack only have basic info, not the full attribution splits
      const loop1 = loadedTracks[0] || {};
      const loop2 = loadedTracks[1] || {};

      const remixSplits = calculateRemixSplits(
        loop1,
        loop2,
        walletAddress!
      );

      // Consolidate duplicate wallets in splits
      const consolidateSplits = (splits: Array<{ wallet: string; percentage: number }>) => {
        const walletMap = new Map<string, number>();
        splits.forEach(split => {
          const current = walletMap.get(split.wallet) || 0;
          walletMap.set(split.wallet, current + split.percentage);
        });
        return Array.from(walletMap.entries()).map(([wallet, percentage]) => ({
          wallet,
          percentage
        }));
      };

      const consolidatedComposition = consolidateSplits(remixSplits.composition);
      const consolidatedProduction = consolidateSplits(remixSplits.production);

      // Convert CONSOLIDATED splits to Clarity values
      const compositionCV = listCV(
        consolidatedComposition.map(split =>
          tupleCV({
            wallet: standardPrincipalCV(split.wallet),
            percentage: uintCV(split.percentage)
          })
        )
      );

      const productionCV = listCV(
        consolidatedProduction.map(split =>
          tupleCV({
            wallet: standardPrincipalCV(split.wallet),
            percentage: uintCV(split.percentage)
          })
        )
      );

      // Call smart contract for payment
      let stacksTxId: string | null = null;

      await new Promise<void>((resolve, reject) => {
        try {
          openContractCall({
            network: process.env.NEXT_PUBLIC_STACKS_NETWORK as 'mainnet' | 'testnet' || 'mainnet',
            contractAddress: process.env.NEXT_PUBLIC_PAYMENT_SPLITTER_CONTRACT || 'SP1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMZXNCTN',
            contractName: 'music-payment-splitter-v3',
            functionName: 'split-track-payment',
            functionArgs: [
              uintCV(totalPriceMicroSTX),
              compositionCV,
              productionCV
            ],
            postConditionMode: PostConditionMode.Allow,
            onFinish: (data) => {
              stacksTxId = data.txId;
              resolve();
            },
            onCancel: () => {
              reject(new Error('Payment cancelled'));
            }
          });
        } catch (error) {
          console.error('Contract call error:', error);
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

      // LIMIT: Maximum remix depth of 2 to prevent contributor explosion
      if (newRemixDepth > 2) {
        throw new Error('Cannot remix this content - maximum remix depth (2 generations) exceeded. This prevents contributor lists from becoming unmanageable.');
      }

      // Calculate download pricing for Gen 1 remix
      // Gen 1 remixes can be downloaded IF both source loops allow downloads
      // Minimum download price = sum of both loop download prices
      const loop1AllowsDownloads = loop1.allow_downloads === true;
      const loop2AllowsDownloads = loop2.allow_downloads === true;
      const bothLoopsAllowDownloads = loop1AllowsDownloads && loop2AllowsDownloads;

      let remixDownloadPrice = null;
      if (bothLoopsAllowDownloads) {
        const loop1DownloadPrice = loop1.download_price_stx || 0;
        const loop2DownloadPrice = loop2.download_price_stx || 0;
        remixDownloadPrice = loop1DownloadPrice + loop2DownloadPrice;
      }

      // Prepare the new remix track data with full split attribution
      // NOTE: Use remixSplits.composition/production directly (NOT consolidated)
      // to preserve remixer as separate entry even if same wallet appears in originals
      const newRemixData = {
        id: crypto.randomUUID(),
        title: mixTitle,
        artist: artistName || walletAddress, // Use fetched artist name or wallet as fallback
        primary_uploader_wallet: walletAddress, // The wallet that owns this track in their store
        uploader_address: walletAddress, // Legacy field - required by database

        // Gen 1 lineage tracking (new fields from migration)
        generation: 1, // This is a first-generation remix
        parent_track_1_id: sourceTrackIds[0] || null, // First source loop
        parent_track_2_id: sourceTrackIds[1] || null, // Second source loop

        // Legacy remix depth tracking (keep for backward compatibility)
        remix_depth: newRemixDepth,
        source_track_ids: sourceTrackIds,

        // Mix metadata
        bpm: bpm,
        content_type: 'loop',
        loop_category: 'remix',
        sample_type: 'instrumentals',

        // Recording data
        audio_url: permanentAudioUrl, // Uploaded to Supabase storage
        cover_image_url: permanentCoverUrl, // Uploaded to Supabase storage

        // Stacks transaction
        stacks_tx_id: stacksTxId,

        // Payment tracking - mark as pending until verified on-chain
        payment_status: 'pending',
        payment_checked_at: null,

        // IP Attribution - Composition (expanded to 7 splits, uses UNCONSOLIDATED splits)
        composition_split_1_wallet: remixSplits.composition[0]?.wallet,
        composition_split_1_percentage: remixSplits.composition[0]?.percentage,
        composition_split_2_wallet: remixSplits.composition[1]?.wallet,
        composition_split_2_percentage: remixSplits.composition[1]?.percentage,
        composition_split_3_wallet: remixSplits.composition[2]?.wallet,
        composition_split_3_percentage: remixSplits.composition[2]?.percentage,
        composition_split_4_wallet: remixSplits.composition[3]?.wallet,
        composition_split_4_percentage: remixSplits.composition[3]?.percentage,
        composition_split_5_wallet: remixSplits.composition[4]?.wallet,
        composition_split_5_percentage: remixSplits.composition[4]?.percentage,
        composition_split_6_wallet: remixSplits.composition[5]?.wallet,
        composition_split_6_percentage: remixSplits.composition[5]?.percentage,
        composition_split_7_wallet: remixSplits.composition[6]?.wallet,
        composition_split_7_percentage: remixSplits.composition[6]?.percentage,

        // IP Attribution - Production (expanded to 7 splits, uses UNCONSOLIDATED splits)
        production_split_1_wallet: remixSplits.production[0]?.wallet,
        production_split_1_percentage: remixSplits.production[0]?.percentage,
        production_split_2_wallet: remixSplits.production[1]?.wallet,
        production_split_2_percentage: remixSplits.production[1]?.percentage,
        production_split_3_wallet: remixSplits.production[2]?.wallet,
        production_split_3_percentage: remixSplits.production[2]?.percentage,
        production_split_4_wallet: remixSplits.production[3]?.wallet,
        production_split_4_percentage: remixSplits.production[3]?.percentage,
        production_split_5_wallet: remixSplits.production[4]?.wallet,
        production_split_5_percentage: remixSplits.production[4]?.percentage,
        production_split_6_wallet: remixSplits.production[5]?.wallet,
        production_split_6_percentage: remixSplits.production[5]?.percentage,
        production_split_7_wallet: remixSplits.production[6]?.wallet,
        production_split_7_percentage: remixSplits.production[6]?.percentage,

        // New pricing model (from migration)
        // Gen 1 remixes can be downloaded IF both source loops allow downloads
        // Download price = sum of both loop download prices (minimum)
        remix_price_stx: 1.0, // Fixed 1 STX per remix usage
        allow_downloads: bothLoopsAllowDownloads, // Only if BOTH loops allow downloads
        download_price_stx: remixDownloadPrice, // Sum of both loop prices, or null if not downloadable
        price_stx: remixDownloadPrice || 1.0, // Legacy field - use download price if available, otherwise remix price

        // Additional metadata
        tags: ['remix', '8-bar', 'mixer'],
        description: `8-bar remix created in mixmi Mixer from bars ${selectedSegment.start + 1} to ${selectedSegment.end}`,
        license_type: bothLoopsAllowDownloads ? 'remix_external' : 'remix_only', // remix_external if downloadable, remix_only if not
        allow_remixing: true,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Save to database
      const { data, error } = await supabase
        .from('ip_tracks')
        .insert([newRemixData])
        .select()
        .single();

      if (error) {
        console.error('Database save error:', error);
        throw new Error(`Failed to save remix to database: ${error.message || 'Unknown error'}`);
      }

      // Generate certificate for the remix

      const certificateData = {
        id: data.id,
        title: data.title,
        artist: data.artist || 'You',
        duration: undefined, // TODO: Calculate from segment duration
        bpm: data.bpm,
        key: undefined,
        tags: data.tags || [],
        description: data.description,
        composition_splits: consolidatedComposition.map((split, index) => ({
          name: index === 0 ? 'Remixer' : `Contributor ${index}`,
          wallet: split.wallet,
          percentage: split.percentage
        })),
        production_splits: consolidatedProduction.map((split, index) => ({
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
        .catch(error => {
          console.error('Certificate generation failed:', error);
          // Don't block on certificate failure
        });

      // Add selected tracks to shopping cart
      let addedToCart = 0;
      if (downloadDeckA && deckATrack && (deckATrack as any).allow_downloads) {
        addToCart(deckATrack);
        addedToCart++;
      }
      if (downloadDeckB && deckBTrack && (deckBTrack as any).allow_downloads) {
        addToCart(deckBTrack);
        addedToCart++;
      }

      // Show success message with cart info if applicable
      if (addedToCart > 0) {
        toast.success(`Remix saved! ${addedToCart} ${addedToCart === 1 ? 'track' : 'tracks'} added to cart for download.`);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Payment/save failed:', error);

      // Provide specific error messages
      let errorMessage = 'Failed to save your remix. Please try again.';

      if (error.message === 'Payment cancelled') {
        errorMessage = 'Payment was cancelled. Your remix was not saved.';
      } else if (error.message?.includes('transaction')) {
        errorMessage = 'Payment transaction failed. Please check your wallet and try again.';
      } else if (error.message?.includes('database')) {
        errorMessage = 'Database error. Please contact support if this persists.';
      }

      toast.error(errorMessage);
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
                  Your selected 8-bar mix for use in the mixmi ecosystem
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
                <li>• I am paying {loopOnlyPrice} STX to license these loops in my remix (1 STX per loop)</li>
                <li>• Original creators receive their designated splits from this licensing fee</li>
                <li>• I can remove the mix from my store at any time</li>
                <li>• <span className="text-gray-500 italic">Future: When customers purchase my remix, I'll earn 20% commission</span></li>
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