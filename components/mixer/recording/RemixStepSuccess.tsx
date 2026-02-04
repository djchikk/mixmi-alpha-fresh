"use client";

import React from 'react';
import { PartyPopper, ExternalLink, FolderOpen, Store } from 'lucide-react';
import { RemixDetails } from './RemixCompletionModal';
import { IPTrack } from '@/types';

interface RemixStepSuccessProps {
  remixDetails: RemixDetails;
  txResult: {
    txHash: string;
    draftId: string;
  } | null;
  hasVideo: boolean;
  coverImageUrl: string | null;
  loadedTracks: IPTrack[];
  onClose: () => void;
}

export default function RemixStepSuccess({
  remixDetails,
  txResult,
  hasVideo,
  coverImageUrl,
  loadedTracks,
  onClose,
}: RemixStepSuccessProps) {
  // Get first source track's cover for video remixes (as thumbnail fallback)
  const firstCover = loadedTracks.find(t => t.cover_image_url)?.cover_image_url;

  return (
    <div className="remix-step-success p-6 space-y-6">
      {/* Celebration Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
          <PartyPopper size={32} className="text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Your Remix is Live!
        </h2>
        <p className="text-slate-400">
          {remixDetails.name}
        </p>
      </div>

      {/* Cover Preview */}
      <div className="flex justify-center">
        <div className="relative">
          {/* Shimmer border */}
          <div
            className="absolute -inset-1.5 rounded-xl opacity-75"
            style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #A8E6CF 14%, #FFFFFF 28%, #88D4F2 42%, #FFFFFF 56%, #B8E8D2 70%, #FFFFFF 84%, #7BC8F4 100%)',
              backgroundSize: '400% 400%',
              animation: 'shimmer 6s ease-in-out infinite',
            }}
          />
          <div className="relative w-40 h-40 rounded-lg overflow-hidden bg-slate-800">
            {hasVideo ? (
              // Video remix - show video icon or first frame
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#5BB5F9]/20 to-slate-800">
                {firstCover ? (
                  <img src={firstCover} alt="" className="w-full h-full object-cover opacity-50" />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-4xl">🎬</div>
                </div>
              </div>
            ) : coverImageUrl ? (
              <img src={coverImageUrl} alt="Remix cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">
                🎵
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Where to Find It */}
      <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-white text-center mb-3">
          Where to find your remix:
        </h3>

        <a
          href="/account?tab=mywork"
          className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#81E4F2]/20 flex items-center justify-center">
            <FolderOpen size={20} className="text-[#81E4F2]" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white group-hover:text-[#81E4F2] transition-colors">
              My Work Tab
            </div>
            <div className="text-xs text-slate-400">
              View and edit your remix
            </div>
          </div>
          <ExternalLink size={16} className="text-slate-500 group-hover:text-slate-400" />
        </a>

        <a
          href="/account?tab=store"
          className="flex items-center gap-3 p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-[#A084F9]/20 flex items-center justify-center">
            <Store size={20} className="text-[#A084F9]" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-white group-hover:text-[#A084F9] transition-colors">
              Creator Store
            </div>
            <div className="text-xs text-slate-400">
              Your remix is now available for others to discover
            </div>
          </div>
          <ExternalLink size={16} className="text-slate-500 group-hover:text-slate-400" />
        </a>
      </div>

      {/* Transaction Info */}
      {txResult && (
        <div className="text-center">
          <p className="text-xs text-slate-500">
            Transaction: {txResult.txHash.slice(0, 12)}...{txResult.txHash.slice(-8)}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
        >
          Done
        </button>
        <a
          href={`/account?tab=mywork`}
          className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#81E4F2] to-cyan-400 text-slate-900 font-bold text-center hover:opacity-90 transition-opacity"
        >
          View My Remix
        </a>
      </div>

      {/* Add shimmer keyframes */}
      <style jsx>{`
        @keyframes shimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}
