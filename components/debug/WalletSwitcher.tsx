"use client";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

// Test wallets for development
const TEST_WALLETS = [
  { 
    address: 'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7', 
    name: 'Sandy (Creator)',
    role: 'creator'
  },
  { 
    address: 'SP1TEST1BUYER1WALLET1ADDRESS1EXAMPLE111', 
    name: 'Test Buyer 1',
    role: 'buyer'
  },
  { 
    address: 'SP2TEST2BUYER2WALLET2ADDRESS2EXAMPLE222', 
    name: 'Test Buyer 2',
    role: 'buyer'
  },
  { 
    address: 'SPBFSWXMK2PYHNYSF679HTTNQ87CVVN1T55QFYHE', 
    name: 'DJ Chikk (Creator)',
    role: 'creator'
  }
];

export default function WalletSwitcher() {
  const { walletAddress, setWalletAddress } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleSwitch = (address: string) => {
    console.log('🔄 Switching wallet to:', address);
    // This would need setWalletAddress to be exposed in AuthContext
    // For now, you'd need to modify the AuthContext to support this
    localStorage.setItem('mockWalletAddress', address);
    window.location.reload(); // Simple reload to apply change
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-mono"
      >
        🔧 Test Wallet
      </button>

      {/* Wallet List */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-3 min-w-[300px]">
          <div className="text-xs font-mono text-gray-400 mb-2">Test Wallet Switcher</div>
          {TEST_WALLETS.map(wallet => (
            <button
              key={wallet.address}
              onClick={() => handleSwitch(wallet.address)}
              className={`block w-full text-left px-3 py-2 rounded text-xs font-mono hover:bg-slate-700 transition-colors ${
                walletAddress === wallet.address ? 'bg-slate-700 text-cyan-400' : 'text-white'
              }`}
            >
              <div className="font-bold">{wallet.name}</div>
              <div className="text-gray-400 text-[10px] truncate">{wallet.address}</div>
              <div className="text-purple-400 text-[10px]">[{wallet.role}]</div>
            </button>
          ))}
          <div className="mt-2 pt-2 border-t border-slate-600 text-[10px] text-gray-500">
            Current: {walletAddress ? walletAddress.slice(0, 20) + '...' : 'Not connected'}
          </div>
        </div>
      )}
    </div>
  );
}