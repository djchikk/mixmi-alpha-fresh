"use client";

import React from 'react';
import { DollarSign, Users, Building2, Star } from 'lucide-react';
import { PRICING, formatUSDCShort } from '@/config/pricing';
import { RecordingCostInfo } from '@/hooks/useMixerRecording';

interface CostDisplayProps {
  costInfo: RecordingCostInfo;
}

export default function CostDisplay({ costInfo }: CostDisplayProps) {
  const {
    bars,
    blocks,
    trackCount,
    totalCost,
    platformCut,
    creatorsCut,
    remixerStake,
  } = costInfo;

  const pricePerBlock = PRICING.remix.pricePerBlock;

  return (
    <div className="cost-display bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-4 border border-slate-700">
      {/* Main Cost Formula */}
      <div className="text-center mb-4">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">
          Recording Cost
        </div>
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="bg-slate-700 px-2 py-1 rounded font-mono">
            {blocks} block{blocks !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-500">×</span>
          <span className="bg-slate-700 px-2 py-1 rounded font-mono">
            {trackCount} track{trackCount !== 1 ? 's' : ''}
          </span>
          <span className="text-slate-500">×</span>
          <span className="bg-slate-700 px-2 py-1 rounded font-mono">
            {formatUSDCShort(pricePerBlock)}
          </span>
        </div>
        <div className="text-2xl font-bold text-[#81E4F2] mt-2">
          {formatUSDCShort(totalCost)} USDC
        </div>
      </div>

      {/* Split Breakdown */}
      <div className="border-t border-slate-700 pt-3">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 text-center">
          Payment Split
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {/* Platform */}
          <div className="bg-slate-800/50 rounded p-2">
            <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
              <Building2 size={12} />
              <span className="text-[10px] uppercase">Platform</span>
            </div>
            <div className="text-xs text-slate-400">
              {PRICING.remix.platformCutPercent}%
            </div>
            <div className="text-sm font-bold text-slate-300">
              {formatUSDCShort(platformCut)}
            </div>
          </div>

          {/* Creators */}
          <div className="bg-slate-800/50 rounded p-2">
            <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
              <Users size={12} />
              <span className="text-[10px] uppercase">Creators</span>
            </div>
            <div className="text-xs text-green-400">
              {PRICING.remix.creatorsCutPercent}%
            </div>
            <div className="text-sm font-bold text-green-300">
              {formatUSDCShort(creatorsCut)}
            </div>
          </div>

          {/* Your Stake */}
          <div className="bg-slate-800/50 rounded p-2 border border-[#FBBF24]/30">
            <div className="flex items-center justify-center gap-1 text-[#FBBF24] mb-1">
              <Star size={12} />
              <span className="text-[10px] uppercase">Your Stake</span>
            </div>
            <div className="text-xs text-[#FBBF24]">
              {PRICING.remix.remixerStakePercent}%
            </div>
            <div className="text-sm font-bold text-[#FBBF24]">
              {formatUSDCShort(remixerStake)}
            </div>
          </div>
        </div>
      </div>

      {/* Stake Explanation */}
      <div className="mt-3 text-[10px] text-slate-500 text-center">
        Your stake ({formatUSDCShort(remixerStake)}) is earned when others remix your creation
      </div>
    </div>
  );
}
