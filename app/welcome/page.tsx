"use client";

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Welcome() {
  return (
    <div className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, #0a0f1c 0%, #1a1f2e 100%)',
      color: '#ffffff'
    }}>
      {/* Navigation placeholder - matches existing nav */}
      <div className="h-16"></div>
      
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-6" style={{
            background: 'linear-gradient(135deg, #e1e5f0 0%, #a8b2c3 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Welcome to Mixmi Alpha, Fellow Tribe Members 🌍
          </h1>
          
          <div className="text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
            <p className="mb-4">
              Hey friends! Music... It's never just about the final track - it's never really done. 
              And when it's done we're bored with it.
            </p>
            <p className="text-xl font-medium" style={{ color: '#81E4F2' }}>
              So let's surrender and embrace infinite remix. At a global scale.
            </p>
          </div>
        </div>

        {/* What We're Building Together */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-center">Here's What We're Building Together</h2>
          <p className="text-gray-300 text-center max-w-3xl mx-auto leading-relaxed">
            Picture your music traveling the globe. Watch a melody you created in Kenya join a beat in Colombia, 
            then bloom into a full song in Seoul. We're tracking every step, honoring every contributor, 
            making sure everyone benefits.
          </p>
        </div>

        {/* What's Live Now - Hero Image */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-8 text-center">What's Live Right Now</h2>
          
          <div className="rounded-xl overflow-hidden shadow-2xl mb-6" style={{
            background: 'linear-gradient(135deg, rgba(129, 228, 242, 0.1) 0%, rgba(129, 228, 242, 0.05) 100%)',
            border: '1px solid rgba(129, 228, 242, 0.2)'
          }}>
            {/* Globe screenshot will go here */}
            <div className="h-96 bg-gray-800 flex items-center justify-center text-gray-400">
              [Globe with Search - Image #2]
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-xl mb-4">The Alpha Uploader - Pin your tracks anywhere on Earth</p>
            <p className="text-gray-400">8-bar loops, loop packs, full songs and EPs, we got you!</p>
            <p className="text-sm text-gray-500 mt-3 italic">
              Pro tip: Feeling truly borderless? Try our adorable Null Island - the tropical paradise 
              for music that transcends geography! 🏝️
            </p>
          </div>
        </div>

        {/* Coming Soon Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-6 text-center">
            Coming Soon (Q4 2025 - The Real Money Moment)
          </h2>
          
          <div className="text-center mb-8 max-w-3xl mx-auto">
            <p className="text-lg text-gray-300 leading-relaxed">
              Yes, we all want to make money from our music (honestly, who doesn't?!) and that's exactly 
              why we're building this... AND for the pure joy of watching our alpha tribe create magic 
              together across continents.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            {/* Creator Store Preview */}
            <div className="rounded-lg overflow-hidden" style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div className="h-48 bg-gray-800 flex items-center justify-center text-gray-400">
                [Creator Store Screenshot]
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2">Your Creator Store</h3>
                <p className="text-sm text-gray-400">Finally, somewhere to sell your music that isn't terrible</p>
              </div>
            </div>

            {/* Profile Page Preview */}
            <div className="rounded-lg overflow-hidden" style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div className="h-48 bg-gray-800 flex items-center justify-center text-gray-400">
                [Profile GIF/Screenshot]
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2">The Profile Page</h3>
                <p className="text-sm text-gray-400">Built for artists, not corporate headshots</p>
              </div>
            </div>

            {/* Big Mixer Preview */}
            <div className="rounded-lg overflow-hidden" style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div className="h-48 bg-gray-800 flex items-center justify-center text-gray-400">
                [Big Mixer Screenshot]
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2">The Mixer</h3>
                <p className="text-sm text-gray-400">Blend sounds from everywhere</p>
              </div>
            </div>
          </div>

          <div className="text-center p-6 rounded-lg" style={{
            background: 'linear-gradient(135deg, rgba(129, 228, 242, 0.08) 0%, rgba(129, 228, 242, 0.03) 100%)',
            border: '1px solid rgba(129, 228, 242, 0.2)'
          }}>
            <p className="text-lg font-medium mb-2" style={{ color: '#81E4F2' }}>
              Your Content Will Be There Day One!
            </p>
            <p className="text-gray-300">
              While others are just discovering the platform, you'll already have your musical territory staked out across the globe.
            </p>
          </div>
        </div>

        {/* Quick Start Guide */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold mb-8 text-center">Quick Start Guide</h2>
          
          <div className="max-w-2xl mx-auto">
            <ol className="space-y-4">
              {[
                'Click "Upload" (the big obvious button)',
                'Drop in your track or loop',
                'Tell us where you made it (or pick Null Island, we don\'t judge)',
                'Add splits if you\'re feeling generous',
                'Hit save, watch it appear on the globe after refresh',
                'That\'s it'
              ].map((step, index) => (
                <li key={index} className="flex items-center space-x-4">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center font-semibold"
                    style={{ background: '#81E4F2', color: '#0a0f1c' }}
                  >
                    {index + 1}
                  </div>
                  <span className="text-gray-300">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Alpha Tribe Message */}
        <div className="text-center mb-16 p-8 rounded-xl" style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <h2 className="text-2xl font-semibold mb-4">For Our Amazing Alpha Tribe</h2>
          <p className="text-lg text-gray-300 leading-relaxed max-w-3xl mx-auto mb-6">
            You're not just uploading tracks - you're creating the world's music discovery map. 
            When millions of people start exploring this globe, YOUR content will be the first thing they find.
          </p>
          <p className="text-xl font-medium" style={{ color: '#81E4F2' }}>
            Ready to see our tribe light up the planet? 🚀✨
          </p>
        </div>

        {/* Contact */}
        <div className="text-center">
          <p className="text-gray-400">
            Questions? WhatsApp me. You probably have my number.
          </p>
        </div>
      </div>
    </div>
  );
}