"use client";

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  label?: string;
  username?: string;
}

export default function QRCodeModal({ isOpen, onClose, address, label, username }: QRCodeModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && address) {
      QRCode.toDataURL(address, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }).then(setQrDataUrl);
    }
  }, [isOpen, address]);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#151C2A] border border-[#1E293B] rounded-xl max-w-sm w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{label || 'Wallet QR Code'}</h3>
            {username && (
              <span className="text-xs text-[#A8E66B]">@{username}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-4">
          <div className="bg-white p-3 rounded-lg">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
            ) : (
              <div className="w-48 h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#81E4F2]"></div>
              </div>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="bg-[#0a0f1a] rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">SUI Address</p>
          <code className="text-xs text-[#81E4F2] font-mono break-all block mb-2">
            {address}
          </code>
          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-2 bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30 text-[#81E4F2] text-sm rounded transition-colors"
          >
            {copied ? (
              <>
                <Check size={14} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy Address
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Scan this QR code to send SUI or USDC to this wallet
        </p>
      </div>
    </div>
  );
}
