"use client";

import { useState, useEffect } from 'react';
import { Persona } from '@/contexts/AuthContext';
import { Plus, Star, RefreshCw, QrCode, ExternalLink } from 'lucide-react';
import { PRICING } from '@/config/pricing';
import { generateAvatar } from '@/lib/avatarUtils';
import AddPersonaModal from '@/components/modals/AddPersonaModal';
import QRCodeModal from '@/components/shared/QRCodeModal';

interface WalletsTabProps {
  walletAddress: string | null;
  suiAddress: string | null;
  personas: Persona[];
  activePersona: Persona | null;
  setActivePersona: (persona: Persona) => void;
  refreshPersonas: () => Promise<void>;
}

export default function WalletsTab({
  walletAddress,
  suiAddress,
  personas,
  activePersona,
  setActivePersona,
  refreshPersonas,
}: WalletsTabProps) {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrModal, setQrModal] = useState<{ address: string; label: string; username?: string } | null>(null);
  const [isAddPersonaModalOpen, setIsAddPersonaModalOpen] = useState(false);

  // On-chain wallet balances
  const [walletBalances, setWalletBalances] = useState<Record<string, { usdc: number; sui: number }>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Fetch on-chain wallet balances
  const fetchWalletBalances = async () => {
    if (!activePersona?.account_id) return;

    setLoadingBalances(true);
    try {
      const response = await fetch(`/api/personas/balances?accountId=${activePersona.account_id}`);
      const data = await response.json();

      if (data.success && data.balances) {
        const balanceMap: Record<string, { usdc: number; sui: number }> = {};
        data.balances.forEach((b: any) => {
          balanceMap[b.suiAddress] = { usdc: b.balances.usdc, sui: b.balances.sui };
        });
        setWalletBalances(balanceMap);
      }
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
    }
    setLoadingBalances(false);
  };

  // Fetch balances on mount
  useEffect(() => {
    if (activePersona?.account_id) {
      fetchWalletBalances();
    }
  }, [activePersona?.account_id]);

  // Handle zkLogin disconnect
  const handleDisconnectZkLogin = async () => {
    if (!suiAddress) return;

    setDisconnecting(true);
    try {
      const response = await fetch('/api/auth/zklogin/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suiAddress }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.removeItem('zklogin_session');
        localStorage.removeItem('sui_address');
        alert('zkLogin disconnected! You will be redirected to sign in again.');
        window.location.href = '/';
        window.location.reload();
      } else {
        alert('Failed to disconnect: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect. Please try again.');
    }
    setDisconnecting(false);
    setShowDisconnectConfirm(false);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Manager Account - The "Boss" Wallet */}
      {suiAddress && (() => {
        // Find the persona that shares this wallet (manager persona)
        const managerPersona = personas.find(p =>
          p.wallet_address === suiAddress ||
          p.sui_address === suiAddress ||
          (!p.sui_address && !p.wallet_address)
        );
        const managerAvatar = managerPersona?.avatar_url;
        const isVideo = managerAvatar && (managerAvatar.includes('.mp4') || managerAvatar.includes('.webm') || managerAvatar.includes('video/'));

        return (
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              {/* Manager avatar - shows linked persona's avatar */}
              <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1E293B] flex-shrink-0 border-2 border-[#81E4F2]/50">
                {isVideo ? (
                  <video
                    src={managerAvatar}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={managerAvatar || generateAvatar(suiAddress)}
                    alt="Manager"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold">Manager Account</h3>
                <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded">zkLogin</span>
              </div>
            </div>
            {!showDisconnectConfirm ? (
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Disconnect
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Sure?</span>
                <button
                  onClick={handleDisconnectZkLogin}
                  disabled={disconnecting}
                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50"
                >
                  {disconnecting ? '...' : 'Yes'}
                </button>
                <button
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                >
                  No
                </button>
              </div>
            )}
          </div>
          <p className="text-gray-400 text-sm mb-3">
            Your login wallet - manages all your personas below.
          </p>

          {/* Balance Display */}
          <div className="flex gap-6 mb-3">
            <div>
              <span className="text-xs text-gray-500">USDC</span>
              <div className="text-lg font-bold text-[#A8E66B]">
                ${walletBalances[suiAddress]?.usdc?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500">SUI (gas)</span>
              <div className="text-lg font-bold text-[#81E4F2]">
                {walletBalances[suiAddress]?.sui?.toFixed(4) || '0.0000'}
              </div>
            </div>
          </div>

          {/* Full address with copy - smaller font to prevent wrapping */}
          <div className="flex items-center gap-2 bg-[#0a0f1a] rounded p-2">
            <code className="text-[10px] text-[#81E4F2] font-mono break-all flex-1">
              {suiAddress}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(suiAddress);
                alert('Address copied!');
              }}
              className="flex-shrink-0 px-2 py-1 text-xs bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30 text-[#81E4F2] rounded transition-colors"
            >
              Copy
            </button>
          </div>

          {/* Links */}
          <div className="mt-2 flex gap-3">
            <a
              href={`https://suiscan.xyz/testnet/account/${suiAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-[#81E4F2] transition-colors"
            >
              View on Explorer
            </a>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-[#81E4F2] transition-colors"
            >
              Get Testnet USDC
            </a>
            <button
              onClick={() => setQrModal({ address: suiAddress, label: 'Manager Account' })}
              className="text-xs text-gray-400 hover:text-[#81E4F2] transition-colors flex items-center gap-1"
            >
              <QrCode size={12} />
              QR Code
            </button>
          </div>

          {showDisconnectConfirm && (
            <p className="text-xs text-amber-400/80 mt-3">
              This will unlink your Apple/Google login from this account. You'll need to sign in again with a different invite code.
            </p>
          )}
        </div>
        );
      })()}

      {/* Your Personas Section */}
      <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold">Your Personas</h3>
          <button
            onClick={fetchWalletBalances}
            disabled={loadingBalances}
            className="flex items-center gap-1.5 px-2 py-1 text-xs bg-slate-800 text-gray-300 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loadingBalances ? 'animate-spin' : ''} />
            {loadingBalances ? 'Loading...' : 'Refresh Balances'}
          </button>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Each persona has its own wallet for receiving payments.
        </p>

        <div className="space-y-3">
          {personas.length > 0 ? (
            <>
              {personas.map((persona) => {
                const isActive = activePersona?.id === persona.id;
                const balance = persona.sui_address && walletBalances[persona.sui_address];

                return (
                  <div
                    key={persona.id}
                    className={`rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-[#1E293B]/50 border-[#A8E66B]/30'
                        : 'bg-[#0a0f1a] border-[#1E293B] hover:border-gray-600'
                    }`}
                  >
                    {/* Main row - always visible */}
                    <div className="flex items-center gap-4 p-4">
                      {/* Active indicator */}
                      <div className="flex-shrink-0">
                        {isActive ? (
                          <Star className="w-4 h-4 text-[#A8E66B] fill-[#A8E66B]" />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1E293B] flex-shrink-0">
                        {(() => {
                          const avatarSrc = persona.avatar_url;
                          const isVideo = avatarSrc && (avatarSrc.includes('.mp4') || avatarSrc.includes('.webm') || avatarSrc.includes('video/'));

                          if (isVideo) {
                            return (
                              <video
                                src={avatarSrc}
                                className="w-full h-full object-cover"
                                autoPlay
                                loop
                                muted
                                playsInline
                              />
                            );
                          }

                          return (
                            <img
                              src={avatarSrc || generateAvatar(persona.username || persona.id)}
                              alt={persona.display_name || persona.username || 'Persona'}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = generateAvatar(persona.username || persona.id);
                              }}
                            />
                          );
                        })()}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate">
                          {persona.display_name || persona.username || 'Unnamed Persona'}
                        </div>
                        {persona.username && (
                          <div className="text-sm text-gray-400">@{persona.username}</div>
                        )}
                        {/* Show truncated address for non-active personas */}
                        {!isActive && persona.sui_address && (
                          <div className="text-xs text-gray-500 font-mono truncate mt-1">
                            {persona.sui_address.slice(0, 10)}...{persona.sui_address.slice(-6)}
                          </div>
                        )}
                      </div>

                      {/* Balance */}
                      <div className="text-right flex-shrink-0">
                        <div className="text-[#A8E66B] font-mono font-medium">
                          ${(balance?.usdc !== undefined ? balance.usdc : persona.balance_usdc || 0).toFixed(2)} USDC
                        </div>
                        {balance?.sui !== undefined && (
                          <div className="text-xs text-gray-500">
                            {balance.sui.toFixed(4)} SUI
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        {persona.sui_address && (
                          <button
                            onClick={() => setQrModal({
                              address: persona.sui_address!,
                              label: 'Payment Wallet',
                              username: persona.username
                            })}
                            className="p-1.5 text-gray-400 hover:text-[#A8E66B] transition-colors"
                            title="Show QR Code"
                          >
                            <QrCode size={16} />
                          </button>
                        )}
                        {!isActive && (
                          <button
                            onClick={() => setActivePersona(persona)}
                            className="px-3 py-1.5 text-xs text-[#81E4F2] border border-[#81E4F2]/30 rounded hover:bg-[#81E4F2]/10 transition-colors"
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded section for active persona - full wallet address with copy */}
                    {isActive && persona.sui_address && (
                      <div className="px-4 pb-4 pt-0 ml-8 border-t border-[#1E293B]/50">
                        <p className="text-xs text-gray-400 mt-3 mb-2">
                          Payments for @{persona.username} go to this address
                        </p>
                        <div className="flex items-center gap-2 bg-[#0a0f1a] rounded p-2">
                          <code className="text-[10px] text-[#A8E66B] font-mono break-all flex-1">
                            {persona.sui_address}
                          </code>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(persona.sui_address!);
                              alert('Address copied!');
                            }}
                            className="flex-shrink-0 px-2 py-1 text-xs bg-[#A8E66B]/20 hover:bg-[#A8E66B]/30 text-[#A8E66B] rounded transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="mt-2 flex gap-3">
                          <a
                            href={`https://suiscan.xyz/testnet/account/${persona.sui_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-400 hover:text-[#A8E66B] transition-colors"
                          >
                            View on Explorer
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add Persona button */}
              {personas.length < PRICING.account.maxPersonas && (
                <button
                  onClick={() => setIsAddPersonaModalOpen(true)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:border-[#81E4F2]/50 hover:text-[#81E4F2] transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Persona</span>
                  <span className="ml-auto text-xs text-gray-500">
                    ({PRICING.account.maxPersonas - personas.length} slot{PRICING.account.maxPersonas - personas.length !== 1 ? 's' : ''} remaining)
                  </span>
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No personas found</p>
              <button
                onClick={() => setIsAddPersonaModalOpen(true)}
                className="px-4 py-2 text-sm text-[#81E4F2] border border-[#81E4F2]/30 rounded-lg hover:bg-[#81E4F2]/10 transition-colors"
              >
                Create Your First Persona
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddPersonaModal
        isOpen={isAddPersonaModalOpen}
        onClose={() => setIsAddPersonaModalOpen(false)}
        onSuccess={() => {
          refreshPersonas();
          setIsAddPersonaModalOpen(false);
        }}
        accountId={activePersona?.account_id || personas[0]?.account_id || ''}
        currentPersonaCount={personas.length}
        maxPersonas={PRICING.account.maxPersonas}
      />

      <QRCodeModal
        isOpen={!!qrModal}
        onClose={() => setQrModal(null)}
        address={qrModal?.address || ''}
        label={qrModal?.label}
        username={qrModal?.username}
      />
    </div>
  );
}
