"use client";

import React, { useState } from 'react';
import PortalCard, { Portal } from '@/components/cards/PortalCard';

// Test data - using a placeholder image
const testPortal: Portal = {
  id: 'test-portal-felix',
  name: 'Felix',
  description: 'Dance music curator. EDM.NYC and live streaming.',
  imageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&h=400&fit=crop',
  profileUrl: '/profile/felix',
  content_type: 'portal',
  coordinates: {
    lat: 40.7128,
    lng: -74.0060
  },
  location: 'New York City'
};

// Another test portal with longer description
const testPortal2: Portal = {
  id: 'test-portal-maya',
  name: 'Maya Chen',
  description: 'Lo-fi beats curator. Midnight Sessions collective founder.',
  imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
  profileUrl: '/profile/maya',
  content_type: 'portal',
  coordinates: {
    lat: 35.6762,
    lng: 139.6503
  },
  location: 'Tokyo'
};

export default function PortalPreviewPage() {
  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white mb-2">Portal Card Preview</h1>
          <p className="text-gray-400">Development preview for Portal Keeper cards</p>
          <p className="text-gray-500 text-sm mt-1">This page is hidden from navigation</p>
        </div>

        {/* Section: Globe Node Appearance */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-4">1. Globe Node Appearance</h2>
          <p className="text-gray-400 text-sm mb-4">How portals appear as nodes on the globe (white/silver dot)</p>

          <div className="bg-slate-900 rounded-xl p-8 flex items-center justify-center gap-8">
            {/* Simulated globe node */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {/* Outer glow */}
                <div className="absolute inset-0 w-8 h-8 rounded-full bg-white/20 blur-md" />
                {/* Core node */}
                <div className="relative w-4 h-4 rounded-full bg-white shadow-lg shadow-white/30" />
              </div>
              <span className="text-gray-500 text-xs">Portal node</span>
            </div>

            {/* Comparison with content nodes */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#A084F9] shadow-lg shadow-[#A084F9]/30" />
              <span className="text-gray-500 text-xs">Loop</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#A8E66B] shadow-lg shadow-[#A8E66B]/30" />
              <span className="text-gray-500 text-xs">Song</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#FFC044] shadow-lg shadow-[#FFC044]/30" />
              <span className="text-gray-500 text-xs">Radio</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-[#5BB5F9] shadow-lg shadow-[#5BB5F9]/30" />
              <span className="text-gray-500 text-xs">Video</span>
            </div>
          </div>
        </section>

        {/* Section: Card States */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-4">2. Card States</h2>
          <p className="text-gray-400 text-sm mb-4">Hover over the cards to see the interactive state</p>

          <div className="bg-slate-900 rounded-xl p-8">
            <div className="flex flex-wrap gap-8 justify-center">
              {/* Test Portal 1 */}
              <div className="flex flex-col items-center gap-3">
                <PortalCard portal={testPortal} />
                <span className="text-gray-400 text-sm">{testPortal.name}</span>
                <span className="text-gray-500 text-xs">{testPortal.location}</span>
              </div>

              {/* Test Portal 2 */}
              <div className="flex flex-col items-center gap-3">
                <PortalCard portal={testPortal2} />
                <span className="text-gray-400 text-sm">{testPortal2.name}</span>
                <span className="text-gray-500 text-xs">{testPortal2.location}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Comparison with Content Cards */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-4">3. Visual Comparison</h2>
          <p className="text-gray-400 text-sm mb-4">Portal cards vs standard content cards</p>

          <div className="bg-slate-900 rounded-xl p-8">
            <div className="flex flex-wrap gap-8 justify-center items-start">
              {/* Portal Card */}
              <div className="flex flex-col items-center gap-3">
                <PortalCard portal={testPortal} />
                <span className="text-white text-sm font-medium">Portal Card</span>
                <span className="text-gray-500 text-xs">Circular, iridescent border</span>
              </div>

              {/* Placeholder for content card comparison */}
              <div className="flex flex-col items-center gap-3">
                <div className="w-[160px] h-[160px] rounded-lg border-2 border-[#A084F9] bg-slate-800 flex items-center justify-center">
                  <span className="text-gray-500 text-xs text-center px-4">Content Card<br />(square shape)</span>
                </div>
                <span className="text-white text-sm font-medium">Content Card</span>
                <span className="text-gray-500 text-xs">Square, solid color border</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Technical Notes */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-white mb-4">4. Technical Notes</h2>

          <div className="bg-slate-900 rounded-xl p-6 text-sm">
            <ul className="space-y-2 text-gray-400">
              <li><span className="text-[#81E4F2]">content_type:</span> &apos;portal&apos;</li>
              <li><span className="text-[#81E4F2]">Border:</span> 4px iridescent shimmer (8s animation cycle)</li>
              <li><span className="text-[#81E4F2]">Shape:</span> 152px circle within 160px container</li>
              <li><span className="text-[#81E4F2]">Drag type:</span> PORTAL_CARD (rejected by mixer/crate)</li>
              <li><span className="text-[#81E4F2]">Hover:</span> Name (clickable) + Description (not clickable)</li>
              <li><span className="text-[#81E4F2]">Globe node:</span> White (#FFFFFF)</li>
            </ul>
          </div>
        </section>

        {/* Back link */}
        <div className="text-center">
          <a href="/" className="text-[#81E4F2] hover:underline text-sm">
            Back to Globe
          </a>
        </div>
      </div>
    </div>
  );
}
