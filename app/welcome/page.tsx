"use client";

import React from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';

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
      className="min-h-screen"
      style={{ 
        background: designVars.welcomeBgGradient,
        color: designVars.textPrimary
      }}
    >
      <Header />
      
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Hero Section - Desktop Claude specification */}
        <div className="text-center mb-16">
          <h1 className="text-5xl mb-4 bg-gradient-to-r from-[#e1e5f0] to-[#81E4F2] bg-clip-text text-transparent">
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
          backdropFilter: 'blur(10px)'
        }}>
          <div className="text-center">
            <h2 className="text-3xl mb-3 text-[#e1e5f0]">
              What's Live
            </h2>
            <p className="text-[#a8b2c3] mb-8">
              The globe uploader is ready. Pin your sounds anywhere on Earth.
            </p>
            
            <Link href="/">
              <button className="bg-gradient-to-r from-[#81E4F2] to-[#5ac8d8] text-[#0a0e1a] px-10 py-4 rounded-lg font-semibold hover:-translate-y-0.5 transition-transform">
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
          backdropFilter: 'blur(10px)'
        }}>
          <h2 className="text-3xl font-semibold mb-6 text-center" style={{ color: designVars.textPrimary }}>
            How It Works
          </h2>
          <p className="text-lg mb-6 text-center max-w-3xl mx-auto" style={{ color: designVars.textSecondary }}>
            Choose your content type and watch it appear on our 3D globe in real-time.
          </p>

          {/* Mode Selection */}
          <div className="flex gap-5 mb-6">
            <div className="flex-1 p-5 bg-[rgba(129,228,242,0.05)] border border-[rgba(129,228,242,0.2)] rounded-xl">
              <h3 className="text-[#81E4F2] text-lg mb-2">Quick Upload</h3>
              <p className="text-[#a8b2c3] text-sm">
                Solo creators: Auto-assigns 100% rights to you. Simple and fast.
              </p>
            </div>
            <div className="flex-1 p-5 bg-[rgba(255,228,181,0.05)] border border-[rgba(255,228,181,0.2)] rounded-xl">
              <h3 className="text-[#FFE4B5] text-lg mb-2">Advanced Options</h3>
              <p className="text-[#a8b2c3] text-sm">
                Teams: Split composition & recording rights between up to 3 creators. Add ISRC codes.
              </p>
            </div>
          </div>
          
          {/* 2x2 Content Type Grid - Matching actual form appearance */}
          <div className="max-w-2xl mx-auto">
            <div className="grid grid-cols-2 gap-4">
              {/* Top left: 8-Bar Loop - Thin purple border */}
              <div 
                className="p-6 rounded-xl border transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer backdrop-blur-sm"
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
                  <div className="text-sm mt-2" style={{ color: designVars.textMuted }}>
                    Quick creative building blocks
                  </div>
                </div>
              </div>
              
              {/* Top right: Loop Pack - Thick purple border */}
              <div 
                className="p-6 rounded-xl border-4 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer backdrop-blur-sm"
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
                  <div className="text-sm mt-2" style={{ color: designVars.textMuted }}>
                    2-5 loops working together
                  </div>
                </div>
              </div>
              
              {/* Bottom left: Song - Thin gold border */}
              <div 
                className="p-6 rounded-xl border transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer backdrop-blur-sm"
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
                  <div className="text-sm mt-2" style={{ color: designVars.textMuted }}>
                    Complete musical piece
                  </div>
                </div>
              </div>
              
              {/* Bottom right: EP - Thick gold border */}
              <div 
                className="p-6 rounded-xl border-4 transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer backdrop-blur-sm"
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
                  <div className="text-sm mt-2" style={{ color: designVars.textMuted }}>
                    2-5 songs collection
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Details */}
          <div className="bg-[rgba(10,14,26,0.4)] rounded-xl p-6 mb-6 max-w-3xl mx-auto">
            <h3 className="text-[#e1e5f0] text-lg mb-4">Fill In Your Details:</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-[#6b7489] text-sm space-y-1">
                <div>• Title & Description</div>
                <div>• BPM (required for loops)</div>
                <div>• Key & Tags (optional)</div>
              </div>
              <div className="text-[#6b7489] text-sm space-y-1">
                <div>• Location (your creative spot)</div>
                <div>• Liner Notes / Credits</div>
                <div>• Cover Art & Audio Files</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[rgba(129,228,242,0.1)]">
              <p className="text-[#81E4F2] text-sm">
                💡 Switch between Quick/Advanced anytime - your data is saved
              </p>
            </div>
          </div>

          {/* Simple Final Steps */}
          <div className="flex justify-center gap-8">
            <div className="text-center">
              <div className="w-10 h-10 bg-[rgba(129,228,242,0.2)] border border-[rgba(129,228,242,0.4)] rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-[#81E4F2]">✓</span>
              </div>
              <p className="text-[#a8b2c3] text-sm">Review</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-[rgba(129,228,242,0.2)] border border-[rgba(129,228,242,0.4)] rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-[#81E4F2]">→</span>
              </div>
              <p className="text-[#a8b2c3] text-sm">Submit</p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-[rgba(129,228,242,0.2)] border border-[rgba(129,228,242,0.4)] rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-[#81E4F2]">🌍</span>
              </div>
              <p className="text-[#a8b2c3] text-sm">See on Globe</p>
            </div>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="section-card mb-16" style={{
          background: 'rgba(20, 25, 39, 0.6)',
          border: '1px solid rgba(129, 228, 242, 0.1)',
          borderRadius: '16px',
          padding: '40px',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 className="text-3xl font-semibold mb-6 text-center" style={{ color: designVars.textPrimary }}>
            Coming Soon
          </h2>
          
          {/* 4-column feature grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Globe + Mixer */}
            <div 
              className="rounded-xl overflow-hidden border transition-all duration-300 hover:scale-105 hover:border-opacity-50 backdrop-blur-sm"
              style={{
                background: designVars.cardBg,
                border: `1px solid ${designVars.cardBorder}`,
              }}
            >
              <div 
                className="h-40 flex items-center justify-center text-sm"
                style={{ 
                  background: 'rgba(10, 14, 26, 0.5)',
                  color: designVars.textMuted 
                }}
              >
                [Globe + Tiny Mixer Screenshot]
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2" style={{ color: designVars.textPrimary }}>
                  Globe + Mixer
                </h3>
                <p className="text-sm" style={{ color: designVars.textMuted }}>
                  Discover and mix in real-time
                </p>
              </div>
            </div>

            {/* Professional Mixer */}
            <div 
              className="rounded-xl overflow-hidden border transition-all duration-300 hover:scale-105 hover:border-opacity-50 backdrop-blur-sm"
              style={{
                background: designVars.cardBg,
                border: `1px solid ${designVars.cardBorder}`,
              }}
            >
              <div 
                className="h-40 flex items-center justify-center text-sm"
                style={{ 
                  background: 'rgba(10, 14, 26, 0.5)',
                  color: designVars.textMuted 
                }}
              >
                [Professional Mixer Screenshot]
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2" style={{ color: designVars.textPrimary }}>
                  Professional Mixer
                </h3>
                <p className="text-sm" style={{ color: designVars.textMuted }}>
                  Dual decks with waveforms
                </p>
              </div>
            </div>

            {/* Creator Store */}
            <div 
              className="rounded-xl overflow-hidden border transition-all duration-300 hover:scale-105 hover:border-opacity-50 backdrop-blur-sm"
              style={{
                background: designVars.cardBg,
                border: `1px solid ${designVars.cardBorder}`,
              }}
            >
              <div 
                className="h-40 flex items-center justify-center text-sm"
                style={{ 
                  background: 'rgba(10, 14, 26, 0.5)',
                  color: designVars.textMuted 
                }}
              >
                [Creator Store Screenshot]
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2" style={{ color: designVars.textPrimary }}>
                  Creator Stores
                </h3>
                <p className="text-sm" style={{ color: designVars.textMuted }}>
                  Your own music marketplace
                </p>
              </div>
            </div>

            {/* Artist Profiles */}
            <div 
              className="rounded-xl overflow-hidden border transition-all duration-300 hover:scale-105 hover:border-opacity-50 backdrop-blur-sm"
              style={{
                background: designVars.cardBg,
                border: `1px solid ${designVars.cardBorder}`,
              }}
            >
              <div 
                className="h-40 flex items-center justify-center text-sm"
                style={{ 
                  background: 'rgba(10, 14, 26, 0.5)',
                  color: designVars.textMuted 
                }}
              >
                [Artist Profile Screenshot]
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2" style={{ color: designVars.textPrimary }}>
                  Artist Profiles
                </h3>
                <p className="text-sm" style={{ color: designVars.textMuted }}>
                  Rich creator showcases
                </p>
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