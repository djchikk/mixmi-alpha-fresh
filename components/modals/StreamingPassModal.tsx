"use client";

import React, { useState } from 'react';
import { X, Music, Zap } from 'lucide-react';
import { createStreamingPass, PASS_PRICE_STX, PASS_DURATION_SECONDS, formatTime } from '@/lib/streamingPass';

interface StreamingPassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete: () => void;
}

const StreamingPassModal: React.FC<StreamingPassModalProps> = ({
  isOpen,
  onClose,
  onPurchaseComplete
}) => {
  const [isPurchasing, setIsPurchasing] = useState(false);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    setIsPurchasing(true);

    try {
      // TODO: Integrate with Stacks wallet for actual payment
      // For now, create pass immediately (development mode)

      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create the streaming pass
      createStreamingPass();

      // Notify parent component
      onPurchaseComplete();
      onClose();

      console.log('✅ Streaming pass purchased!');
    } catch (error) {
      console.error('Failed to purchase streaming pass:', error);
      alert('Purchase failed. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md mx-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
          disabled={isPurchasing}
        >
          <X className="w-5 h-5 text-white/70" />
        </button>

        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#81E4F2]/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#81E4F2]" />
            </div>
            <h2 className="text-2xl font-bold text-white">Streaming Pass</h2>
          </div>
          <p className="text-sm text-gray-400">
            Unlock full-length playback for all tracks in your playlist
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Pricing Card */}
          <div className="bg-[#81E4F2]/10 border border-[#81E4F2]/30 rounded-xl p-5">
            <div className="flex items-baseline justify-center gap-2 mb-3">
              <span className="text-4xl font-bold text-white">{PASS_PRICE_STX}</span>
              <span className="text-xl text-gray-300">STX</span>
            </div>
            <div className="text-center text-gray-300 mb-4">
              {formatTime(PASS_DURATION_SECONDS)} of streaming credits
            </div>

            {/* What you get */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-[#81E4F2]" />
                <span>~60 minutes of loops</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-[#81E4F2]" />
                <span>~15 minutes of full songs</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <div className="w-1.5 h-1.5 rounded-full bg-[#81E4F2]" />
                <span>Mix and match as you like!</span>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wide">How it works</h3>
            <div className="space-y-2 text-sm text-gray-400">
              <p>• Credits are consumed only while tracks are playing</p>
              <p>• Loops use 1x time (1 min played = 1 min used)</p>
              <p>• Songs use 4x time (1 min played = 4 min used)</p>
              <p>• Pause anytime to save your credits</p>
            </div>
          </div>

          {/* Artist support message */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-xs text-amber-200">
              <strong>100x better for artists!</strong> Your streaming supports creators at rates that crush Spotify. 🎵💰
            </p>
          </div>
        </div>

        {/* Footer / CTA */}
        <div className="p-6 border-t border-slate-700">
          <button
            onClick={handlePurchase}
            disabled={isPurchasing}
            className="w-full py-3 px-6 bg-[#81E4F2] hover:bg-[#81E4F2]/90 disabled:bg-gray-600 disabled:cursor-not-allowed text-slate-900 font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {isPurchasing ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Music className="w-5 h-5" />
                Get Streaming Pass
              </>
            )}
          </button>

          <p className="text-xs text-gray-500 text-center mt-3">
            Credits are stored locally and never expire
          </p>
        </div>
      </div>
    </div>
  );
};

export default StreamingPassModal;
