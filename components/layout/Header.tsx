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
  
  // 🎯 PERFORMANCE FIX: Only use auth on non-globe pages to eliminate JWT overhead
  const auth = isGlobePage ? null : useAuth();
  const { isAuthenticated, connectWallet, disconnectWallet, walletAddress } = auth || {};
  
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

      {/* Right: Alpha System Label */}
      <div className="flex-1 flex justify-end items-center gap-4">
        <div className="text-sm text-gray-400 hidden md:block">
          Alpha Upload System
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
            
            {/* Simplified alpha navigation */}
          </nav>
        </div>
      )}
    </header>
  );
} 