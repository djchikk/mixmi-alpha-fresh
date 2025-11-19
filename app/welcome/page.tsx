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
            opacity: 0.40,
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
                    <p className="text-[#a8b2c3]">Discover sounds pinned anywhere on Earth and mix loops in the tiny DJ mixer. Launch playlist and radio widgets, search content, and fully functional shopping cart</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">🎛️</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Big Mixer with Recording</h3>
                    <p className="text-[#a8b2c3]">Dual decks with waveform displays, BPM sync, crossfader, EQ, FX, gate effects, keyboard shortcuts, and live mix recording - built for extended sessions</p>
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

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">⚙️</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Account Management</h3>
                    <p className="text-[#a8b2c3]">View and edit all your uploads, access certificates, and manage account settings</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">⏺️</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Mix Recording</h3>
                    <p className="text-[#a8b2c3]">Record your live DJ mixes in the Big Mixer and download them as audio files</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg md:col-span-2">
                  <span className="text-[#81E4F2] text-lg mt-0.5">📻</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Playlist Streaming & Radio</h3>
                    <p className="text-[#a8b2c3]">Compile playlists and stream previews in the player widget. Radio mode continuously plays random content from the database</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">📻</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Live Radio Integrations</h3>
                    <p className="text-[#a8b2c3]">Partner stations streaming directly through the globe</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#81E4F2] text-lg mt-0.5">📻</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Simplified Radio Player</h3>
                    <p className="text-[#a8b2c3]">Persistent radio player with drag & drop support for stations and packs - auto-unpacks station packs to your crate</p>
                  </div>
                </div>
              </div>
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
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-6" style={{ fontSize: '2rem', fontWeight: '600', color: '#e1e5f0' }}>
              Coming Soon
            </h2>

            <div className="max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
                  <span className="text-[#9772F4] text-lg mt-0.5">🌟</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Production Content Migration</h3>
                    <p className="text-[#a8b2c3]">Test content will be replaced with curated professional loops and tracks</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#9772F4] text-lg mt-0.5">💎</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Playlist Curation Earnings</h3>
                    <p className="text-[#a8b2c3]">Earn through curation - create and share playlists that connect listeners with great music</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#9772F4] text-lg mt-0.5">💰</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Streaming Earnings</h3>
                    <p className="text-[#a8b2c3]">Monetized streaming for full tracks and playlists - artists earn when listeners stream their complete works</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-[rgba(20,25,39,0.4)] border border-[rgba(129,228,242,0.2)] rounded-lg">
                  <span className="text-[#9772F4] text-lg mt-0.5">🎵</span>
                  <div>
                    <h3 className="text-[#e1e5f0] font-semibold mb-1">Full Song Playback in Mixer</h3>
                    <p className="text-[#a8b2c3]">Mix complete songs and EPs in the DJ decks - currently supports 8-bar loops and radio stations</p>
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
    </div>
  );
}