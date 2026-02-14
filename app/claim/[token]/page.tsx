'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Gift, Wallet, Music, DollarSign, CheckCircle, AlertCircle, LogIn, UserPlus, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface ClaimInfo {
  displayName: string;
  username: string;
  balance: number;
  trackCount: number;
  expiresAt: string;
  recipientName: string | null;
}

export default function ClaimPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const { isAuthenticated, personas, activePersona, suiAddress, walletAddress } = useAuth();

  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  // Filter out TBD personas - can't claim to another TBD
  const validPersonas = personas.filter(p => !p.username.includes('-tbd') && p.sui_address);

  // Fetch claim info on mount
  useEffect(() => {
    const fetchClaimInfo = async () => {
      try {
        const response = await fetch(`/api/personas/claim-tbd?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invalid claim link');
          return;
        }

        setClaimInfo(data.claimInfo);
      } catch (err) {
        setError('Failed to load claim information');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchClaimInfo();
    }
  }, [token]);

  // Set default selected persona
  useEffect(() => {
    if (validPersonas.length > 0 && !selectedPersonaId) {
      // Prefer the default persona, otherwise first one
      const defaultPersona = validPersonas.find(p => p.is_default) || validPersonas[0];
      setSelectedPersonaId(defaultPersona.id);
    }
  }, [validPersonas, selectedPersonaId]);

  const handleClaim = async () => {
    if (!selectedPersonaId || !claimInfo) return;

    // Find account ID from the selected persona
    const persona = validPersonas.find(p => p.id === selectedPersonaId);
    if (!persona) return;

    setClaiming(true);
    setError(null);

    try {
      const response = await fetch('/api/personas/claim-tbd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          claimingPersonaId: selectedPersonaId,
          claimingAccountId: persona.account_id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to claim');
        return;
      }

      setClaimSuccess(true);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A8E66B]"></div>
      </div>
    );
  }

  // Error state
  if (error && !claimInfo) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#151C2A] border border-red-900/30 rounded-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[#A8E66B] text-slate-900 font-semibold rounded-lg hover:bg-[#96d45f] transition-colors"
          >
            Go to mixmi
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (claimSuccess) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#151C2A] border border-green-900/30 rounded-xl p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Claimed!</h1>
          <p className="text-gray-400 mb-6">
            Your earnings have been transferred to your account. Future royalties from these tracks will go directly to your wallet.
          </p>
          <Link
            href="/account"
            className="inline-block px-6 py-3 bg-[#A8E66B] text-slate-900 font-semibold rounded-lg hover:bg-[#96d45f] transition-colors"
          >
            View Your Earnings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Claim Card */}
        <div className="bg-[#151C2A] border border-[#1E293B] rounded-xl overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-b border-[#1E293B]">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Gift className="w-8 h-8 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Claim Your Earnings</h1>
                <p className="text-amber-200/70">Someone sent you royalties on mixmi</p>
              </div>
            </div>
          </div>

          {/* Claim Details */}
          {claimInfo && (
            <div className="p-6 space-y-4">
              {/* What's being claimed */}
              <div className="p-4 bg-[#0a0f1a] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Credit Name</span>
                  <span className="text-white font-medium">{claimInfo.displayName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Tracks
                  </span>
                  <span className="text-white">{claimInfo.trackCount} track{claimInfo.trackCount !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Balance
                  </span>
                  <span className="text-[#A8E66B] font-bold">${claimInfo.balance.toFixed(2)} USDC</span>
                </div>
              </div>

              {/* Not logged in */}
              {!isAuthenticated && (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm text-center">
                    Sign in or create an account to claim your earnings
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href={`/welcome?redirect=/claim/${token}`}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-[#A8E66B] text-slate-900 font-semibold rounded-lg hover:bg-[#96d45f] transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Sign Up
                    </Link>
                    <Link
                      href={`/welcome?redirect=/claim/${token}`}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-600 transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </Link>
                  </div>
                </div>
              )}

              {/* Logged in - persona selection */}
              {isAuthenticated && validPersonas.length > 0 && (
                <div className="space-y-3">
                  <p className="text-gray-400 text-sm">
                    Select which account to claim to:
                  </p>

                  <div className="space-y-2">
                    {validPersonas.map((persona) => (
                      <button
                        key={persona.id}
                        onClick={() => setSelectedPersonaId(persona.id)}
                        className={`w-full p-3 rounded-lg text-left transition-colors flex items-center justify-between ${
                          selectedPersonaId === persona.id
                            ? 'bg-[#A8E66B]/20 border-2 border-[#A8E66B]'
                            : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            src={null}
                            name={persona.username || persona.display_name || persona.id}
                            size={40}
                          />
                          <div>
                            <div className="text-white font-medium">
                              {persona.display_name || persona.username}
                            </div>
                            <div className="text-xs text-gray-400">@{persona.username}</div>
                          </div>
                        </div>
                        {selectedPersonaId === persona.id && (
                          <CheckCircle className="w-5 h-5 text-[#A8E66B]" />
                        )}
                      </button>
                    ))}
                  </div>

                  {error && (
                    <div className="p-3 bg-red-900/20 border border-red-900/30 rounded-lg text-sm text-red-400">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleClaim}
                    disabled={claiming || !selectedPersonaId}
                    className="w-full py-4 bg-[#A8E66B] hover:bg-[#96d45f] text-slate-900 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {claiming ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></div>
                        Claiming...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-5 h-5" />
                        Claim to My Account
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Logged in but no valid personas */}
              {isAuthenticated && validPersonas.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-400 text-sm mb-4">
                    You need a persona with a wallet to claim earnings.
                  </p>
                  <Link
                    href="/account"
                    className="inline-block px-6 py-3 bg-[#A8E66B] text-slate-900 font-semibold rounded-lg hover:bg-[#96d45f] transition-colors"
                  >
                    Set Up Your Account
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-4">
          By claiming, these tracks' royalty splits will be updated to your wallet address.
        </p>
      </div>
    </div>
  );
}
