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
        {/* Hero Section - Exact Desktop Claude specification */}
        <div className="text-center mb-20">
          <h1 className="text-5xl mb-5 bg-gradient-to-r from-[#e1e5f0] to-[#81E4F2] bg-clip-text text-transparent">
            Welcome to Mixmi Alpha
            <span className="ml-3 text-3xl">🌍</span>
          </h1>
          <div className="text-2xl text-[#81E4F2] mb-4 font-light">
            Infinite remix. Global scale.
          </div>
          <p className="text-[#a8b2c3] text-lg max-w-2xl mx-auto leading-relaxed">
            Your music traveling the world while you sleep.<br/>
            Every loop tells a story. Every collaboration breaks down walls.
          </p>
        </div>

        {/* What's Live Section */}
        <div className="mb-20 text-center">
          <h2 className="text-3xl font-semibold mb-6" style={{ color: designVars.textPrimary }}>
            What's Live
          </h2>
          <p className="text-xl max-w-2xl mx-auto" style={{ color: designVars.textSecondary }}>
            The globe uploader is ready. Pin your sounds anywhere on Earth.
          </p>
        </div>

        {/* How It Works - Content Type Grid (Exact match to form) */}
        <div className="mb-20">
          <h2 className="text-3xl font-semibold mb-8 text-center" style={{ color: designVars.textPrimary }}>
            How It Works
          </h2>
          <p className="text-lg mb-12 text-center max-w-3xl mx-auto" style={{ color: designVars.textSecondary }}>
            Choose your content type and watch it appear on our 3D globe in real-time.
          </p>
          
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
                  <div className="text-2xl mb-2">⚡</div>
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
                  <div className="text-2xl mb-2">🎛️</div>
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
                  <div className="text-2xl mb-2">🎵</div>
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
                  <div className="text-2xl mb-2">💰</div>
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
        </div>

        {/* Coming Soon Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-semibold mb-8 text-center" style={{ color: designVars.textPrimary }}>
            Coming Soon
          </h2>
          
          {/* 4-column feature grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

          {/* Real Money Moment - Gold highlight box */}
          <div 
            className="text-center p-8 rounded-xl border-2 backdrop-blur-sm"
            style={{
              background: `linear-gradient(135deg, ${designVars.accentGold}08 0%, ${designVars.accentGold}03 100%)`,
              borderColor: designVars.accentGold,
              boxShadow: `0 0 30px ${designVars.accentGold}20`,
            }}
          >
            <div className="text-2xl mb-4">💰</div>
            <h3 className="text-2xl font-bold mb-4" style={{ color: designVars.accentGold }}>
              Real Money Moment
            </h3>
            <p className="text-lg max-w-3xl mx-auto" style={{ color: designVars.textSecondary }}>
              Your content uploaded today will be ready to sell when payments launch. 
              Build your catalog now, earn from day one when we go live.
            </p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold mb-6" style={{ color: designVars.textPrimary }}>
            Ready to light up the planet? 🚀✨
          </h2>
          <p className="text-lg mb-8 max-w-3xl mx-auto" style={{ color: designVars.textSecondary }}>
            You're not just uploading tracks - you're creating the world's music discovery map.
          </p>
          
          <Link href="/">
            <button 
              className="px-8 py-4 text-lg font-semibold rounded-xl transition-all duration-300 hover:scale-105 hover:shadow-xl"
              style={{
                background: `linear-gradient(135deg, ${designVars.accentCyan} 0%, ${designVars.accentPurple} 100%)`,
                color: '#0a0e1a',
                boxShadow: `0 0 30px ${designVars.accentCyan}30`,
              }}
            >
              Start Uploading
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}