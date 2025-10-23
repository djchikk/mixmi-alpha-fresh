"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import ShippedStamp from '@/components/shared/ShippedStamp';
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

        {/* What's Live Section */}
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
            <h2 className="text-2xl font-semibold mb-6" style={{ fontSize: '2rem', fontWeight: '600', color: '#e1e5f0' }}>
              What's Live
            </h2>

            <div className="text-left max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">🌍</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Globe Browser with Tiny Mixer</h3>
                    <p className="text-[#a8b2c3]">Discover sounds pinned anywhere on Earth and mix loops in the tiny dj mixer</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">🎚️</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Big Mixer</h3>
                    <p className="text-[#a8b2c3]">Dual decks with waveform displays, BPM sync, crossfader, EQ, FX, keyboard shortcuts, and rock-solid stability for extended sessions</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">💰</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">STX Payments & Smart Contracts</h3>
                    <p className="text-[#a8b2c3]">Buy and sell with real on-chain transactions - automatic payment splits for all collaborators</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">🔗</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Remix Tracking & Lineage</h3>
                    <p className="text-[#a8b2c3]">Every remix traces its parent loops - Gen 0 loops and Gen 1 remixes with full attribution</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">🏪</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Creator Stores</h3>
                    <p className="text-[#a8b2c3]">Your own music marketplace for loops, loop packs, songs, EPs, and remixes</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">👤</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Artist Profiles</h3>
                    <p className="text-[#a8b2c3]">Customizable showcases for creators with social links and bio</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg md:col-span-2">
                  <span className="text-[#81E4F2] text-lg mt-0.5">📻</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Playlist Streaming & Radio</h3>
                    <p className="text-[#a8b2c3]">Curate and broadcast continuous mixes from any creator's store</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Invitation Section */}
        <div className="section-card mb-16" style={{
          background: 'rgba(20, 25, 39, 0.6)',
          border: '1px solid rgba(129, 228, 242, 0.1)',
          borderRadius: '16px',
          padding: '48px 40px',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          zIndex: 1
        }}>
          <div className="text-center max-w-2xl mx-auto">
            <div className="text-6xl mb-6">🎵</div>
            <h2 className="text-3xl font-semibold mb-4" style={{ color: '#e1e5f0' }}>
              Ready to Share Your Sound?
            </h2>
            <p className="text-[#a8b2c3] text-lg mb-8">
              Upload loops, loop packs, songs, or EPs. Pin your content anywhere on Earth.
              Start earning with every track you share.
            </p>

            <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-6">
              <div className="flex items-center gap-2 text-[#a8b2c3] text-sm">
                <span className="text-[#81E4F2]">✓</span>
                <span>Quick or Advanced modes</span>
              </div>
              <div className="flex items-center gap-2 text-[#a8b2c3] text-sm">
                <span className="text-[#81E4F2]">✓</span>
                <span>Split rights up to 3 creators</span>
              </div>
              <div className="flex items-center gap-2 text-[#a8b2c3] text-sm">
                <span className="text-[#81E4F2]">✓</span>
                <span>Everything is editable</span>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setUploadModalOpen(true)}
                className="flex items-center gap-3 px-8 py-4 bg-transparent text-white font-mono text-lg rounded-xl border-2 border-[#81E4F2] hover:bg-[#81E4F2]/10 hover:shadow-[0_0_20px_rgba(129,228,242,0.4)] transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span>sign in and upload</span>
              </button>
            </div>

            <p className="text-[#6b7489] text-sm mt-6">
              💡 Alpha perk: Made a mistake? Everything can be changed or deleted - just message me!
            </p>
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
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-6" style={{ fontSize: '2rem', fontWeight: '600', color: '#e1e5f0' }}>
              Coming Soon
            </h2>

            <div className="max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#9772F4] text-lg mt-0.5">⏺️</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Remix Recording</h3>
                    <p className="text-[#a8b2c3]">Record your live mixes directly in the mixer and save remixes to your store</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#9772F4] text-lg mt-0.5">🎖️</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">On-Chain Certification</h3>
                    <p className="text-[#a8b2c3]">Downloadable certificates with permanent proof of ownership and splits</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#9772F4] text-lg mt-0.5">🎵</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Gen 2 Remixes</h3>
                    <p className="text-[#a8b2c3]">Remix the remixes - deeper collaboration trees with managed attribution</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#9772F4] text-lg mt-0.5">🎧</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Live Radio Integrations</h3>
                    <p className="text-[#a8b2c3]">Partner stations streaming directly through the globe</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#9772F4] text-lg mt-0.5">🌟</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Production Content Migration</h3>
                    <p className="text-[#a8b2c3]">Test content will be replaced with curated professional loops and tracks</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Closing */}
        <div className="text-center mt-8 mb-12">
          <p className="text-[#a8b2c3] text-xl font-medium">
            Ready to light up the planet? 🚀✨
          </p>
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