"use client";

import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
// Removed profile dependency for alpha version
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/Button";
// SyncStatus not needed for alpha version
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isGlobePage = pathname === '/';
  const isWelcomePage = pathname === '/welcome';
  
  // Use auth on all pages for global wallet connection
  const { isAuthenticated, connectWallet, disconnectWallet, walletAddress } = useAuth();
  
  // Alpha version - no profile sync status needed
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="bg-background py-4 px-6 flex items-center fixed top-0 left-0 right-0 z-50 border-b border-border">
      {/* Left: Logo */}
      <div className="flex-1">
        <Link href="/" className="flex items-center">
          <Image 
            src="/logos/logotype-mixmi.svg" 
            alt="Mixmi Logo" 
            width={100} 
            height={32} 
            priority
          />
        </Link>
      </div>

      {/* Center: Navigation */}
      <nav className="hidden md:flex items-center gap-8 font-mono">
        <Link 
          href="/" 
          className={`transition-all duration-300 tracking-wide ${
            isGlobePage 
              ? 'text-white font-bold transform scale-105' 
              : 'text-gray-300 hover:text-white hover:scale-105 font-medium active:scale-95'
          }`}
        >
          upload
        </Link>
        <Link 
          href="/welcome" 
          className={`transition-all duration-300 tracking-wide ${
            isWelcomePage 
              ? 'text-white font-bold transform scale-105' 
              : 'text-gray-300 hover:text-white hover:scale-105 font-medium active:scale-95'
          }`}
        >
          welcome
        </Link>
      </nav>

      {/* Right: Wallet Connection */}
      <div className="flex-1 flex justify-end items-center gap-4">
        {/* Wallet Connection Buttons - Show on all pages */}
        <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && walletAddress ? (
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-300 font-mono">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </div>
                <button
                  onClick={disconnectWallet}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={connectWallet}
                className="px-4 py-2 text-sm text-gray-300 font-medium rounded-md border border-white/20 hover:border-white/30 transition-all"
                style={{ backgroundColor: '#061F3C' }}
              >
                Connect Wallet
              </button>
            )}
        </div>
        
        {/* Alpha label - smaller, less prominent */}
        <div className="text-xs text-gray-500 hidden lg:block">
          Alpha
        </div>
        
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden text-gray-300 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-background border-b border-border shadow-lg z-50">
          <nav className="flex flex-col py-4 px-6 space-y-4">
            <Link 
              href="/welcome" 
              className={`transition-all duration-300 ${
                isWelcomePage 
                  ? 'text-white font-bold' 
                  : 'text-gray-300 hover:text-white font-medium active:scale-95'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Welcome
            </Link>
            
            <Link 
              href="/" 
              className={`transition-all duration-300 ${
                isGlobePage 
                  ? 'text-white font-bold' 
                  : 'text-gray-300 hover:text-white font-medium active:scale-95'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Globe
            </Link>
            
            {/* Mobile Wallet Connection */}
            <div className="pt-2 border-t border-gray-700">
                {isAuthenticated && walletAddress ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-300 font-mono">
                      {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
                    </div>
                    <button
                      onClick={() => {
                        disconnectWallet?.();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      connectWallet?.();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-sm text-gray-200 font-medium rounded-md border border-white/20 hover:border-white/30 transition-all"
                    style={{ backgroundColor: '#061F3C' }}
                  >
                    Connect Wallet
                  </button>
                )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
} 