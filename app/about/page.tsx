"use client";

import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import ProfileLayout from "@/components/layout/ProfileLayout";

export default function AboutPage() {
  const { isAuthenticated, connectWallet } = useAuth();

  return (
    <ProfileLayout>
      <div className="pb-8">
        <div className="container mx-auto px-4">
          
          {/* Hero Section */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-[#81E4F2] to-[#9772F4] bg-clip-text text-transparent">
              Mixmi
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
              The future of creative collaboration with IP attribution and value flow
            </p>
            <div className="text-lg text-gray-400 max-w-2xl mx-auto">
              <em>"Infinite remix at a global level with value flow and attribution connected"</em>
            </div>
          </div>

          {/* Vision Section */}
          <div className="grid md:grid-cols-2 gap-12 mb-16">
            <div>
              <h2 className="text-3xl font-bold mb-4 text-[#81E4F2]">Our Vision</h2>
              <p className="text-gray-300 mb-4">
                Mixmi is building the future of creative collaboration where attribution flows 
                seamlessly with creativity, and value follows contribution across a global network of creators.
              </p>
              <p className="text-gray-300 mb-4">
                Through our innovative platform, creators can maintain their creative identities, 
                collaborate across cultures, and ensure proper attribution and compensation for their work.
              </p>
            </div>
            
            <div>
              <h2 className="text-3xl font-bold mb-4 text-[#9772F4]">How It Works</h2>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-start">
                  <span className="text-[#81E4F2] mr-2">•</span>
                  <span>Create your decentralized creative profile</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#81E4F2] mr-2">•</span>
                  <span>Upload content with automatic IP attribution</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#81E4F2] mr-2">•</span>
                  <span>Collaborate with creators worldwide</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#81E4F2] mr-2">•</span>
                  <span>Discover content through our Globe Browser</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#81E4F2] mr-2">•</span>
                  <span>Remix and create with proper attribution</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Features Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">Platform Features</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#81E4F2]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎭</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-[#81E4F2]">Multi-Account System</h3>
                <p className="text-gray-300">
                  Manage multiple creative identities from one wallet - Band, Personal, Creative personas
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-[#9772F4]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">⚖️</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-[#9772F4]">IP Attribution</h3>
                <p className="text-gray-300">
                  Automatic rights management with composition and production splits
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-[#81E4F2]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🏪</span>
                </div>
                <h3 className="text-xl font-semibold mb-2 text-[#81E4F2]">Creator Stores</h3>
                <p className="text-gray-300">
                  Individual creator catalogs with audio previews and professional presentation
                </p>
              </div>
            </div>
          </div>

          {/* Future Section */}
          <div className="mb-16">
            <h2 className="text-3xl font-bold mb-8 text-center">Coming Soon</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-[#81E4F2] to-[#9772F4] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🌍</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Globe Browser</h3>
                <p className="text-gray-300">
                  Discover content geographically with 3D spatial interaction and global collaboration
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-[#9772F4] to-[#81E4F2] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🎚️</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Floating Mixer</h3>
                <p className="text-gray-300">
                  Real-time remix interface with live collaboration and instant attribution
                </p>
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            {!isAuthenticated ? (
              <div>
                <h2 className="text-2xl font-bold mb-4">Ready to Start Creating?</h2>
                <p className="text-gray-300 mb-6">
                  Connect your wallet to begin your creative journey
                </p>
                <Button 
                  onClick={connectWallet}
                  variant="primary"
                  className="text-lg px-8 py-3"
                >
                  Connect Wallet
                </Button>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold mb-4">Welcome to Mixmi!</h2>
                <p className="text-gray-300 mb-6">
                  You're all set up. Start managing your creative profile and upload your content.
                </p>
                <div className="flex gap-4 justify-center">
                  <Link href="/">
                    <Button variant="primary" className="text-lg px-6 py-3">
                      Go to Profile
                    </Button>
                  </Link>
                  <Link href="/store">
                    <Button variant="secondary" className="text-lg px-6 py-3">
                      Visit Store
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProfileLayout>
  );
} 