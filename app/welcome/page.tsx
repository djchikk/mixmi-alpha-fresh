"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/layout/Header';
import ShippedStamp from '@/components/shared/ShippedStamp';
import dynamic from 'next/dynamic';

// Dynamically import Globe for breathing background effect
const Globe = dynamic(() => import('@/components/globe/Globe'), {
  ssr: false,
  loading: () => null
});

// Design variables from Desktop Claude specification
const designVars = {
  welcomeBgGradient: 'linear-gradient(135deg, #0a0e1a 0%, #141927 50%, #0a0e1a 100%)',
  cardBg: 'rgba(20, 25, 39, 0.6)',
  cardBorder: 'rgba(129, 228, 242, 0.1)',
  cardBorderHover: 'rgba(129, 228, 242, 0.3)',
  textPrimary: '#e1e5f0',
  textSecondary: '#a8b2c3',
  textMuted: '#6b7489',
  accentCyan: '#81E4F2',
  accentGold: '#D4AF37',
  accentPurple: '#9772F4',
};

export default function Welcome() {
  return (
    <div 
      className="min-h-screen relative"
      style={{ 
        background: 'linear-gradient(135deg, rgba(10,14,26,0.95) 0%, rgba(20,25,39,0.98) 50%, rgba(10,14,26,0.95) 100%)',
        color: designVars.textPrimary
      }}
    >
      <Header />
      
      <div 
        className="max-w-6xl mx-auto px-6 py-16 relative" 
        style={{ 
          paddingTop: '120px'
        }}
      >
        {/* Breathing Globe Background - Whisper of life */}
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100vw',
            height: '100vh',
            opacity: 0.15,
            pointerEvents: 'none',
            zIndex: 0
          }}
        >
          <Globe 
            nodes={[]} 
            onNodeClick={() => {}}
            onNodeHover={() => {}}
            selectedNode={null}
            hoveredNode={null}
            backgroundMode={true}
          />
        </div>

        {/* Hero Section - Desktop Claude specification */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl mb-4 text-white font-semibold"
              style={{
                fontSize: '3.5rem', // 56px
                fontWeight: '600',  // semibold
                lineHeight: '1.2'
              }}>
            welcome to mixmi alpha
          </h1>
          <p className="text-[#a8b2c3] text-lg max-w-2xl mx-auto">
            Hey friends! You're the first to populate a world of infinite remix,
            where you own your distribution and every collaboration gets proper credit.
          </p>
        </div>

        {/* Feature Overview - Clean & Minimal */}
        <div className="max-w-2xl mx-auto mb-16" style={{
          position: 'relative',
          zIndex: 1
        }}>
          {/* Globe Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              The Globe
            </h2>
            <p className="text-[#a8b2c3] text-sm leading-relaxed" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Discover music from creators worldwide. Browse sounds pinned to Earth's surface, preview tracks instantly, and add them to your crate. The globe is your gateway to the mixmi community.
            </p>
          </div>

          {/* Universal Mixer Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Universal Mixer
            </h2>
            <p className="text-[#a8b2c3] text-sm leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Mix loops in real-time with the compact mixer below the globe. Dual decks, crossfader, and EQ controls. Drop tracks from the crate, blend seamlessly, and create something new.
            </p>

            {/* Content Types */}
            <div className="mt-4 space-y-2">
              <p className="text-[#a8b2c3] text-xs mb-2" style={{ fontFamily: 'var(--font-geist-mono)' }}>
                Mix any combination of content types:
              </p>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#9772F4' }}></div>
                  <span className="text-[#a8b2c3] text-xs" style={{ fontFamily: 'var(--font-geist-mono)' }}>Loops</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF6B4A' }}></div>
                  <span className="text-[#a8b2c3] text-xs" style={{ fontFamily: 'var(--font-geist-mono)' }}>Radio Stations</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#D4AF37' }}></div>
                  <span className="text-[#a8b2c3] text-xs" style={{ fontFamily: 'var(--font-geist-mono)' }}>Songs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2792F5' }}></div>
                  <span className="text-[#a8b2c3] text-xs" style={{ fontFamily: 'var(--font-geist-mono)' }}>Videos</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="max-w-2xl mx-auto mb-16" style={{
          position: 'relative',
          zIndex: 1
        }}>
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-3" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Coming Soon
            </h2>
            <p className="text-[#a8b2c3] text-sm leading-relaxed" style={{ fontFamily: 'var(--font-geist-mono)' }}>
              Quick video guides dropping soon to help you upload, mix, and vibe with the community. Stay tuned!
            </p>
          </div>
        </div>

        {/* Closing */}
        <div className="text-center mt-8 mb-12">
          <p className="text-[#a8b2c3] text-xl font-medium">
            Ready to light up the planet? 🚀✨
          </p>
        </div>
      </div>
    </div>
  );
}