"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import dynamic from 'next/dynamic';

// Dynamically import Globe for breathing background effect
const Globe = dynamic(() => import('@/components/globe/Globe'), { 
  ssr: false,
  loading: () => null
});

// Dynamically import Upload Modal
const IPTrackModal = dynamic(() => import('@/components/modals/IPTrackModal'), {
  ssr: false
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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const router = useRouter();

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
            <div className="text-[#a8b2c3] mb-8">
              <p className="mb-4">The globe uploader is ready. Pin your sounds anywhere on Earth.</p>
              
              <div className="text-left max-w-md mx-auto">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-[#81E4F2]">•</span>
                    Compact mixer functioning
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#81E4F2]">•</span>
                    Drag/drop content to mixer and crate
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#81E4F2]">•</span>
                    Search enabled
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#81E4F2]">•</span>
                    Crate and shopping cart working
                  </li>
                </ul>
                
                <hr className="border-white/10 my-4" />
                
                <p className="text-xs text-[#6b7489] mb-2 font-semibold">Next Up:</p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-[#FFE4B5]">•</span>
                    Purchasing enabled
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#FFE4B5]">•</span>
                    Pro mixer live
                  </li>
                </ul>
              </div>
            </div>
            
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
          <h2 className="text-2xl font-semibold mb-3 text-center" style={{ fontSize: '2rem', fontWeight: '600' }}>Upload in Under a Minute</h2>
          <p className="text-[#A1B0C4] mb-6 text-center">
            Alpha perk: Made a mistake? Everything can be changed or deleted - just message me!
          </p>

          {/* Authentication Options - Informational Only */}
          <h3 className="text-center text-[#a8b2c3] mb-4 font-semibold">Connect to Upload</h3>
          
          <div className="mb-6 max-w-2xl mx-auto">
            <div className="p-6 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-xl">
              <div className="flex items-center justify-center gap-8">
                
                {/* LEFT SIDE - Alpha Invite */}
                <div className="flex-1 text-center">
                  <div className="text-2xl mb-2">🔑</div>
                  <h4 className="text-[#a8b2c3] text-sm font-medium">Alpha Invite</h4>
                  <p className="text-[#6b7489] text-xs mt-1">Enter wallet address from invite</p>
                </div>

                {/* CENTER - OR Divider */}
                <div className="flex flex-col items-center justify-center px-4">
                  <div className="text-[#6b7489] text-sm font-medium">OR</div>
                  <div className="w-px h-8 bg-[rgba(255,255,255,0.1)] mt-2"></div>
                </div>

                {/* RIGHT SIDE - Stacks Wallet */}
                <div className="flex-1 text-center">
                  <div className="text-2xl mb-2">⭐</div>
                  <h4 className="text-[#a8b2c3] text-sm font-medium">Stacks Wallet</h4>
                  <p className="text-[#6b7489] text-xs mt-1">Connect via header button</p>
                </div>

              </div>
            </div>
          </div>

          {/* Step 2: Mode Selection */}
          <h3 className="text-center text-[#a8b2c3] mb-4 font-semibold">Choose Your Upload Mode</h3>
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
          <h3 className="text-center text-[#a8b2c3] mb-4 font-semibold">Select Content Type</h3>
          <div className="max-w-2xl mx-auto mb-8">
            <div className="grid grid-cols-2 gap-4">
              {/* Top left: 8-Bar Loop - Simple uniform styling */}
              <div className="p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-xl">
                <div className="text-center">
                  <div className="font-semibold text-lg" style={{ color: designVars.textPrimary }}>
                    8-Bar Loop
                  </div>
                  <div className="text-xs mt-2" style={{ color: designVars.textMuted }}>
                    Quick creative building blocks
                  </div>
                </div>
              </div>
              
              {/* Top right: Loop Pack - Simple uniform styling */}
              <div className="p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-xl">
                <div className="text-center">
                  <div className="font-semibold text-lg" style={{ color: designVars.textPrimary }}>
                    Loop Pack
                  </div>
                  <div className="text-xs mt-2" style={{ color: designVars.textMuted }}>
                    2-5 loops working together
                  </div>
                </div>
              </div>
              
              {/* Bottom left: Song - Simple uniform styling */}
              <div className="p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-xl">
                <div className="text-center">
                  <div className="font-semibold text-lg" style={{ color: designVars.textPrimary }}>
                    Song
                  </div>
                  <div className="text-xs mt-2" style={{ color: designVars.textMuted }}>
                    Complete musical piece
                  </div>
                </div>
              </div>
              
              {/* Bottom right: EP - Simple uniform styling */}
              <div className="p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-xl">
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

          {/* Step 4: Form Details - Compact horizontal flow */}
          <h3 className="text-center text-[#a8b2c3] mb-4 font-semibold">Fill In Your Details</h3>
          <div className="text-center mb-6">
            <p className="text-[#6b7489] text-sm max-w-4xl mx-auto" style={{ lineHeight: '1.6' }}>
              • Artist Name & Title  • Description  • BPM & Key<br />
              • Tags  • Location  • Cover Art & Audio
            </p>
          </div>

          {/* Start Uploading Button - After reading all instructions */}
          <div className="text-center">
            <button 
              onClick={() => setUploadModalOpen(true)}
              className="bg-gray-200 text-[#0a0e1a] px-10 py-3 rounded-lg font-semibold hover:-translate-y-0.5 hover:bg-gray-300 transition-all"
            >
              Start Uploading
            </button>
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
          <h2 className="text-2xl font-semibold mb-3 text-center" style={{ fontSize: '2rem', fontWeight: '600' }}>
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
                <p className="text-sm text-[#6b7489]">Dual decks with sync, loop length controls and FX</p>
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

      {/* Upload Modal */}
      {uploadModalOpen && (
        <IPTrackModal
          isOpen={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onSave={(track) => {
            // After successful upload, close modal and redirect to globe
            setUploadModalOpen(false);
            // Navigate to globe so user sees their uploaded content
            router.push('/');
          }}
        />
      )}
    </div>
  );
}