"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '@/components/layout/Header';
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
  accentGold: '#FFE4B5',
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
            opacity: 0.20,
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
          <h1 className="text-5xl md:text-6xl mb-4 bg-gradient-to-r from-[#e1e5f0] to-[#81E4F2] bg-clip-text text-transparent font-semibold"
              style={{
                fontSize: '3.5rem', // 56px
                fontWeight: '600',  // semibold
                lineHeight: '1.2'
              }}>
            Welcome to Mixmi Alpha
            <span className="ml-3 text-3xl">🌍</span>
          </h1>
          <p className="text-[#a8b2c3] text-lg max-w-2xl mx-auto">
            Hey friends! You're the first to populate a world of infinite remix, 
            where you own your distribution and every collaboration gets proper credit.
          </p>
        </div>

        {/* What's Live + CTA Combined Section */}
        <div className="section-card mb-16" style={{
          background: 'rgba(20, 25, 39, 0.6)',
          border: '1px solid rgba(129, 228, 242, 0.1)',
          borderRadius: '16px',
          padding: '40px',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 1
        }}>
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-3" style={{ fontSize: '2rem', fontWeight: '600', marginBottom: '12px', color: '#e1e5f0' }}>
              What's Live
            </h2>
            <p className="text-[#a8b2c3] mb-8">
              The globe uploader is ready. Pin your sounds anywhere on Earth.
            </p>
            
            <Link href="/">
              <button className="bg-gradient-to-r from-[#81E4F2] to-[#5ac8d8] text-[#0a0e1a] px-10 py-3 rounded-lg font-semibold hover:-translate-y-0.5 transition-transform">
                Start Uploading
              </button>
            </Link>
          </div>
        </div>

        {/* How It Works - Content Type Grid (Exact match to form) */}
        <div className="section-card mb-16" style={{
          background: 'rgba(20, 25, 39, 0.6)',
          border: '1px solid rgba(129, 228, 242, 0.1)',
          borderRadius: '16px',
          padding: '40px',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 1
        }}>
          <h2 className="text-2xl font-semibold mb-3" style={{ fontSize: '2rem', fontWeight: '600' }}>How It Works</h2>
          <p className="text-[#81E4F2] mb-6">
            Alpha perk: Made a mistake? Everything can be changed or deleted - just message me!
          </p>

          {/* Wallet Verification Step */}
          <div className="mb-6 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-xl">
            <h3 className="text-[#e1e5f0] text-base mb-2">First: Verify Your Access</h3>
            <p className="text-[#a8b2c3] text-sm">
              Enter the wallet address from your alpha invite
            </p>
          </div>

          {/* Step 2: Mode Selection */}
          <h3 className="text-center text-[#a8b2c3] mb-4">Second: Choose Your Upload Mode</h3>
          <div className="flex gap-5 mb-6">
            <div className="flex-1 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-xl">
              <h3 className="text-[#a8b2c3] text-center text-base mb-3" style={{ fontSize: '15px' }}>
                <span>⚡</span> Quick Upload
              </h3>
              <p className="text-[#a8b2c3] text-sm text-center">
                Solo creators: Auto-assigns 100% rights to you
              </p>
            </div>
            <div className="flex-1 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-xl">
              <h3 className="text-[#a8b2c3] text-center text-base mb-3" style={{ fontSize: '15px' }}>
                <span>⚙️</span> Advanced Options
              </h3>
              <p className="text-[#a8b2c3] text-sm text-center">
                Split rights between up to 3 creators. Add ISRC codes
              </p>
            </div>
          </div>

          <p className="text-[#6b7489] text-center mb-6" style={{ 
            fontSize: '16px',
            margin: '20px auto',
            display: 'block'
          }}>
            💡 Switch between Quick/Advanced anytime - your data is saved
          </p>
          
          {/* Step 3: Content Type Selection */}
          <h3 className="text-center text-[#a8b2c3] mb-4">Third: Select Content Type</h3>
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              {/* Top left: 8-Bar Loop - Thin purple border */}
              <div 
                className="p-4 rounded-xl border backdrop-blur-sm"
                style={{
                  background: designVars.cardBg,
                  borderColor: '#9772F4',
                  boxShadow: `0 0 20px #9772F420`,
                }}
              >
                <div className="text-center">
                  <div className="font-semibold text-lg" style={{ color: designVars.textPrimary }}>
                    8-Bar Loop
                  </div>
                  <div className="text-xs mt-2" style={{ color: designVars.textMuted }}>
                    Quick creative building blocks
                  </div>
                </div>
              </div>
              
              {/* Top right: Loop Pack - Thick purple border */}
              <div 
                className="p-4 rounded-xl border-4 backdrop-blur-sm"
                style={{
                  background: designVars.cardBg,
                  borderColor: '#9772F4',
                  boxShadow: `0 0 20px #9772F420`,
                }}
              >
                <div className="text-center">
                  <div className="font-semibold text-lg" style={{ color: designVars.textPrimary }}>
                    Loop Pack
                  </div>
                  <div className="text-xs mt-2" style={{ color: designVars.textMuted }}>
                    2-5 loops working together
                  </div>
                </div>
              </div>
              
              {/* Bottom left: Song - Thin gold border */}
              <div 
                className="p-4 rounded-xl border backdrop-blur-sm"
                style={{
                  background: designVars.cardBg,
                  borderColor: '#FFE4B5',
                  boxShadow: `0 0 20px #FFE4B520`,
                }}
              >
                <div className="text-center">
                  <div className="font-semibold text-lg" style={{ color: designVars.textPrimary }}>
                    Song
                  </div>
                  <div className="text-xs mt-2" style={{ color: designVars.textMuted }}>
                    Complete musical piece
                  </div>
                </div>
              </div>
              
              {/* Bottom right: EP - Thick gold border */}
              <div 
                className="p-4 rounded-xl border-4 backdrop-blur-sm"
                style={{
                  background: designVars.cardBg,
                  borderColor: '#FFE4B5',
                  boxShadow: `0 0 20px #FFE4B520`,
                }}
              >
                <div className="text-center">
                  <div className="font-semibold text-lg" style={{ color: designVars.textPrimary }}>
                    EP
                  </div>
                  <div className="text-xs mt-2" style={{ color: designVars.textMuted }}>
                    2-5 songs collection
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4: Form Details */}
          <div className="bg-[rgba(10,14,26,0.4)] rounded-xl p-6 mb-6" style={{ marginTop: '20px' }}>
            <h3 className="text-center text-[#a8b2c3] mb-4">Fourth: Fill In Your Details</h3>
            <div className="text-center">
              <div className="text-[#6b7489] text-sm space-y-1" style={{ lineHeight: '1.6' }}>
              <div>• Artist Name & Title</div>
              <div>• Description</div>
              <div>• BPM (required for loops)</div>
              <div>• Key (optional)</div>
              <div>• Tags (important for discovery!)</div>
              <div>• Location (your creative spot)</div>
              <div>• Liner Notes / Credits</div>
                <div>• Cover Art & Audio Files</div>
              </div>
            </div>
          </div>

          {/* 4-Step Process Icons */}
          <div className="flex justify-center">
            <div className="w-30 text-center" style={{ width: '120px' }}>
              <div className="w-10 h-10 bg-[rgba(129,228,242,0.2)] border border-[rgba(129,228,242,0.4)] rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-[#81E4F2]">✓</span>
              </div>
              <p className="text-[#a8b2c3] text-sm">Review</p>
            </div>
            
            <div className="w-30 text-center" style={{ width: '120px' }}>
              <div className="w-10 h-10 bg-[rgba(129,228,242,0.2)] border border-[rgba(129,228,242,0.4)] rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-[#81E4F2]">→</span>
              </div>
              <p className="text-[#a8b2c3] text-sm">Submit</p>
            </div>
            
            <div className="w-30 text-center" style={{ width: '120px' }}>
              <div className="w-10 h-10 bg-[rgba(129,228,242,0.2)] border border-[rgba(129,228,242,0.4)] rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-[#81E4F2]">🔄</span>
              </div>
              <p className="text-[#a8b2c3] text-sm">Refresh</p>
            </div>
            
            <div className="w-30 text-center" style={{ width: '120px' }}>
              <div className="w-10 h-10 bg-[rgba(129,228,242,0.2)] border border-[rgba(129,228,242,0.4)] rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-[#81E4F2]">🌍</span>
              </div>
              <p className="text-[#a8b2c3] text-sm">View</p>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="section-card mb-16" style={{
          background: 'rgba(20, 25, 39, 0.6)',
          border: '1px solid rgba(129, 228, 242, 0.1)',
          borderRadius: '16px',
          padding: '40px',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 1
        }}>
          <h2 className="text-2xl font-semibold mb-3" style={{ fontSize: '2rem', fontWeight: '600' }}>
            Coming Soon
          </h2>
          <p className="text-center text-[#a8b2c3] mb-8">
            Within 3 weeks
          </p>
          
          {/* Coming Soon - 2-column layout for wider aspect ratio */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            
            {/* Globe + Tiny Mixer */}
            <div className="rounded-xl overflow-hidden border transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                 style={{ background: 'rgba(20, 25, 39, 0.6)', border: '1px solid rgba(129, 228, 242, 0.1)' }}>
              <div className="aspect-video bg-gray-800 relative">
                <Image src="/welcome-images/globe-tiny-mixer.png" alt="Globe with Tiny Mixer" fill className="object-cover" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2 text-[#e1e5f0]">Globe + Mixer</h3>
                <p className="text-sm text-[#6b7489]">Discover and mix in real-time</p>
              </div>
            </div>
            
            {/* Professional Mixer */}
            <div className="rounded-xl overflow-hidden border transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                 style={{ background: 'rgba(20, 25, 39, 0.6)', border: '1px solid rgba(129, 228, 242, 0.1)' }}>
              <div className="aspect-video bg-gray-800 relative">
                <Image src="/welcome-images/professional-mixer.png" alt="Professional Mixer Interface" fill className="object-cover" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2 text-[#e1e5f0]">Professional Mixer</h3>
                <p className="text-sm text-[#6b7489]">Dual decks with waveforms</p>
              </div>
            </div>
            
            {/* Creator Store */}
            <div className="rounded-xl overflow-hidden border transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                 style={{ background: 'rgba(20, 25, 39, 0.6)', border: '1px solid rgba(129, 228, 242, 0.1)' }}>
              <div className="aspect-video bg-gray-800 relative">
                <Image src="/welcome-images/creator-store.png" alt="Creator Store Interface" fill className="object-cover" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2 text-[#e1e5f0]">Creator Stores</h3>
                <p className="text-sm text-[#6b7489]">Your own music marketplace</p>
              </div>
            </div>
            
            {/* Artist Profiles */}
            <div className="rounded-xl overflow-hidden border transition-all duration-300 hover:scale-105 backdrop-blur-sm"
                 style={{ background: 'rgba(20, 25, 39, 0.6)', border: '1px solid rgba(129, 228, 242, 0.1)' }}>
              <div className="aspect-video bg-gray-800 relative">
                <Image src="/welcome-images/profile-showcase.gif" alt="Artist Profile Showcase" fill className="object-cover" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2 text-[#e1e5f0]">Artist Profiles</h3>
                <p className="text-sm text-[#6b7489]">Rich creator showcases</p>
              </div>
            </div>
            
          </div>
        </div>

        {/* Real Money Moment - Standalone */}
        <div className="bg-[rgba(255,228,181,0.1)] border border-[rgba(255,228,181,0.3)] rounded-xl p-6 text-center mb-16">
          <h3 className="text-xl text-[#FFE4B5] mb-3">💰 Real Money Moment</h3>
          <p className="text-[#a8b2c3]">
            Your content uploaded today will be ready to sell when payments launch. 
            Build your catalog now, earn from day one when we go live.
          </p>
        </div>

        {/* Simple Closing */}
        <div className="text-center text-[#6b7489]">
          Ready to light up the planet? 🚀✨
        </div>
      </div>
    </div>
  );
}