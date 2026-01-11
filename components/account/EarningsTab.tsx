'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Persona } from '@/contexts/AuthContext';
import { DollarSign, ArrowUpRight, Clock, Users, ExternalLink, Wallet, Send, RefreshCw, Copy, Check, ChevronDown, ChevronUp, QrCode, AlertCircle, UserPlus, Link2, UserCheck, Search } from 'lucide-react';
import QRCodeModal from '@/components/shared/QRCodeModal';

interface Earning {
  id: string;
  amount_usdc: number;
  source_type: string;
  status: 'paid' | 'held_in_treasury' | 'claimed' | 'withdrawn';
  created_at: string;
  tx_hash: string | null;
  track_title?: string;
  track_id?: string;
  held_by_username?: string;
}

interface TreasuryHolding {
  id: string;
  label: string;
  balance_usdc: number;
  track_title?: string;
  track_id?: string;
  created_at: string;
  claimed_at: string | null;
}

interface WalletBalance {
  personaId: string;
  username: string;
  displayName: string | null;
  suiAddress: string;
  balances: {
    usdc: number;
    sui: number;
  };
  error?: string;
}

interface TbdPersona {
  id: string;
  username: string;
  displayName: string;
  suiAddress: string;
  balance: number;
  trackCount: number;
  createdAt: string;
}

interface EarningsTabProps {
  accountId: string | null;
  personas: Persona[];
  activePersona: Persona | null;
  suiAddress: string | null;
}

export default function EarningsTab({
  accountId,
  personas,
  activePersona,
  suiAddress,
}: EarningsTabProps) {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [treasuryHoldings, setTreasuryHoldings] = useState<TreasuryHolding[]>([]);
  const [walletBalances, setWalletBalances] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [view, setView] = useState<'wallets' | 'earnings' | 'treasury' | 'resolve'>('wallets');

  // TBD Persona resolution state
  const [tbdPersonas, setTbdPersonas] = useState<TbdPersona[]>([]);
  const [loadingTbd, setLoadingTbd] = useState(false);
  const [resolveModal, setResolveModal] = useState<{
    persona: TbdPersona;
    action: 'link' | 'merge' | null;
  } | null>(null);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<Array<{ username: string; displayName: string; walletAddress: string; suiAddress: string | null }>>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  // Invite generation state
  const [generatingInvite, setGeneratingInvite] = useState<string | null>(null); // TBD persona ID being processed
  const [inviteCopied, setInviteCopied] = useState<string | null>(null); // TBD persona ID with copied link

  // Withdrawal state
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState<{
    isOpen: boolean;
    personaId: string;
    username: string;
    suiAddress: string;
    maxAmount: number;
  } | null>(null);
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [showAccountsDropdown, setShowAccountsDropdown] = useState(false);
  const [qrModal, setQrModal] = useState<{ address: string; label: string; username?: string } | null>(null);

  // Get personas with wallets
  const personasWithWallets = personas.filter(p => p.sui_address);

  // Calculate totals
  const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount_usdc || 0), 0);
  const totalBalance = personas.reduce((sum, p) => sum + (p.balance_usdc || 0), 0);
  const pendingTreasury = treasuryHoldings
    .filter(t => !t.claimed_at)
    .reduce((sum, t) => sum + (t.balance_usdc || 0), 0);

  useEffect(() => {
    const fetchEarningsData = async () => {
      if (!accountId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch earnings from the v_earnings_detail view
        const personaIds = personas.map(p => p.id);

        if (personaIds.length > 0) {
          const { data: earningsData, error: earningsError } = await supabase
            .from('earnings')
            .select(`
              id,
              amount_usdc,
              source_type,
              status,
              created_at,
              tx_hash,
              source_id
            `)
            .in('persona_id', personaIds)
            .order('created_at', { ascending: false })
            .limit(50);

          if (earningsError) {
            console.error('Error fetching earnings:', earningsError);
          } else if (earningsData) {
            // Fetch track titles for each earning
            const trackIds = earningsData
              .filter(e => e.source_id)
              .map(e => e.source_id);

            let trackTitles: Record<string, string> = {};
            if (trackIds.length > 0) {
              const { data: tracks } = await supabase
                .from('ip_tracks')
                .select('id, title')
                .in('id', trackIds);

              if (tracks) {
                trackTitles = Object.fromEntries(tracks.map(t => [t.id, t.title]));
              }
            }

            setEarnings(earningsData.map(e => ({
              ...e,
              track_title: e.source_id ? trackTitles[e.source_id] : undefined,
              track_id: e.source_id,
            })));
          }
        }

        // Fetch treasury holdings (TBD wallets owned by this account)
        const { data: tbdData, error: tbdError } = await supabase
          .from('tbd_wallets')
          .select(`
            id,
            label,
            balance_usdc,
            track_id,
            created_at,
            claimed_at
          `)
          .eq('owner_account_id', accountId)
          .order('created_at', { ascending: false });

        if (tbdError) {
          console.error('Error fetching treasury holdings:', tbdError);
        } else if (tbdData) {
          // Fetch track titles
          const trackIds = tbdData.filter(t => t.track_id).map(t => t.track_id);
          let trackTitles: Record<string, string> = {};

          if (trackIds.length > 0) {
            const { data: tracks } = await supabase
              .from('ip_tracks')
              .select('id, title')
              .in('id', trackIds);

            if (tracks) {
              trackTitles = Object.fromEntries(tracks.map(t => [t.id, t.title]));
            }
          }

          setTreasuryHoldings(tbdData.map(t => ({
            ...t,
            track_title: t.track_id ? trackTitles[t.track_id] : undefined,
          })));
        }
      } catch (error) {
        console.error('Error fetching earnings data:', error);
      }
      setLoading(false);
    };

    fetchEarningsData();
  }, [accountId, personas]);

  // Fetch on-chain wallet balances
  const fetchWalletBalances = async () => {
    if (!accountId) return;

    setLoadingBalances(true);
    try {
      const response = await fetch(`/api/personas/balances?accountId=${accountId}`);
      const data = await response.json();

      if (data.success) {
        setWalletBalances(data.balances);
      }
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
    }
    setLoadingBalances(false);
  };

  // Fetch balances on mount and when view changes to wallets
  useEffect(() => {
    if (view === 'wallets' && accountId) {
      fetchWalletBalances();
    }
  }, [view, accountId]);

  // Fetch TBD personas (those with -tbd suffix)
  const fetchTbdPersonas = async () => {
    if (!accountId) return;

    setLoadingTbd(true);
    try {
      // Get TBD personas for this account
      const { data: tbdData, error } = await supabase
        .from('personas')
        .select('id, username, display_name, sui_address, balance_usdc, created_at')
        .eq('account_id', accountId)
        .eq('is_active', true)
        .like('username', '%-tbd%');

      if (error) {
        console.error('Error fetching TBD personas:', error);
        return;
      }

      if (!tbdData || tbdData.length === 0) {
        setTbdPersonas([]);
        return;
      }

      // For each TBD persona, count tracks where their wallet appears in splits
      const tbdWithCounts = await Promise.all(
        tbdData.map(async (p) => {
          // Count tracks where this wallet appears in any split field
          const { count } = await supabase
            .from('ip_tracks')
            .select('id', { count: 'exact', head: true })
            .or(`composition_split_1_wallet.eq.${p.sui_address},composition_split_2_wallet.eq.${p.sui_address},composition_split_3_wallet.eq.${p.sui_address},production_split_1_wallet.eq.${p.sui_address},production_split_2_wallet.eq.${p.sui_address},production_split_3_wallet.eq.${p.sui_address}`);

          return {
            id: p.id,
            username: p.username,
            displayName: p.display_name,
            suiAddress: p.sui_address,
            balance: p.balance_usdc || 0,
            trackCount: count || 0,
            createdAt: p.created_at,
          };
        })
      );

      setTbdPersonas(tbdWithCounts);
    } catch (error) {
      console.error('Error fetching TBD personas:', error);
    }
    setLoadingTbd(false);
  };

  // Fetch TBD personas when view changes to resolve
  useEffect(() => {
    if (view === 'resolve' && accountId) {
      fetchTbdPersonas();
    }
  }, [view, accountId]);

  // Search for users to link
  const searchUsersForLink = async (query: string) => {
    if (query.length < 2) {
      setLinkSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const response = await fetch(`/api/profile/search-users?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const { users } = await response.json();
        // Filter out TBD personas from results
        const filtered = users.filter((u: any) => !u.username?.includes('-tbd'));
        setLinkSearchResults(filtered);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    }
    setSearchingUsers(false);
  };

  // Generate invite link for TBD persona
  const generateInviteLink = async (tbdPersona: TbdPersona) => {
    if (!accountId) return;

    setGeneratingInvite(tbdPersona.id);
    try {
      const response = await fetch('/api/personas/generate-claim-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tbdPersonaId: tbdPersona.id,
          accountId,
          recipientName: tbdPersona.displayName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to generate invite:', data.error);
        alert('Failed to generate invite link: ' + data.error);
        return;
      }

      // Copy to clipboard
      await navigator.clipboard.writeText(data.claimUrl);
      setInviteCopied(tbdPersona.id);

      // Reset copied state after 3 seconds
      setTimeout(() => setInviteCopied(null), 3000);
    } catch (error) {
      console.error('Error generating invite:', error);
      alert('Failed to generate invite link');
    } finally {
      setGeneratingInvite(null);
    }
  };

  // Handle withdrawal
  const handleWithdraw = async () => {
    if (!withdrawModal || !accountId) return;

    setWithdrawError('');
    setWithdrawSuccess('');

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError('Please enter a valid amount');
      return;
    }

    if (amount > withdrawModal.maxAmount) {
      setWithdrawError(`Maximum available: $${withdrawModal.maxAmount.toFixed(2)}`);
      return;
    }

    if (!withdrawAddress || !withdrawAddress.startsWith('0x')) {
      setWithdrawError('Please enter a valid SUI address');
      return;
    }

    setWithdrawing(true);
    try {
      const response = await fetch('/api/personas/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: withdrawModal.personaId,
          destinationAddress: withdrawAddress,
          amountUsdc: amount,
          accountId: accountId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setWithdrawError(data.error || 'Withdrawal failed');
      } else {
        setWithdrawSuccess(`Successfully withdrew $${amount.toFixed(2)} USDC!`);
        // Refresh balances
        await fetchWalletBalances();
        // Close modal after a delay
        setTimeout(() => {
          setWithdrawModal(null);
          setWithdrawAddress('');
          setWithdrawAmount('');
          setWithdrawSuccess('');
        }, 2000);
      }
    } catch (error) {
      setWithdrawError('Network error. Please try again.');
    }
    setWithdrawing(false);
  };

  // Copy address to clipboard
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="px-2 py-0.5 bg-green-900/50 text-green-300 text-xs rounded">Paid</span>;
      case 'held_in_treasury':
        return <span className="px-2 py-0.5 bg-amber-900/50 text-amber-300 text-xs rounded">Held</span>;
      case 'claimed':
        return <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded">Claimed</span>;
      case 'withdrawn':
        return <span className="px-2 py-0.5 bg-purple-900/50 text-purple-300 text-xs rounded">Withdrawn</span>;
      default:
        return null;
    }
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'download_sale':
        return 'Download Sale';
      case 'remix_royalty_gen1':
        return 'Gen 1 Royalty';
      case 'remix_royalty_gen2':
        return 'Gen 2 Royalty';
      case 'seed_royalty':
        return 'Seed Royalty';
      case 'mixer_fee':
        return 'Mixer Fee';
      default:
        return sourceType;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Balance */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-[#81E4F2]/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-[#81E4F2]" />
            </div>
            <div>
              <div className="text-sm text-gray-400">Available Balance</div>
              <div className="text-2xl font-bold text-[#81E4F2]">
                ${totalBalance.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Across {personas.length} account{personas.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Total Earned */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-sm text-gray-400">Total Earned</div>
              <div className="text-2xl font-bold text-green-400">
                ${totalEarnings.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            From {earnings.length} transaction{earnings.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Treasury Holdings */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="text-sm text-gray-400">Held for Collaborators</div>
              <div className="text-2xl font-bold text-amber-400">
                ${pendingTreasury.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {treasuryHoldings.filter(t => !t.claimed_at).length} pending claim{treasuryHoldings.filter(t => !t.claimed_at).length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Managed Accounts Dropdown */}
      {personasWithWallets.length > 0 && (
        <div className="bg-[#101726] border border-[#1E293B] rounded-lg overflow-hidden">
          <button
            onClick={() => setShowAccountsDropdown(!showAccountsDropdown)}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#0a0f1a]/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-[#A8E66B]" />
              <span className="text-white font-medium">Managed Accounts</span>
              <span className="text-xs px-2 py-0.5 bg-[#A8E66B]/20 text-[#A8E66B] rounded-full">
                {personasWithWallets.length} wallet{personasWithWallets.length !== 1 ? 's' : ''}
              </span>
            </div>
            {showAccountsDropdown ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {showAccountsDropdown && (
            <div className="border-t border-[#1E293B] divide-y divide-[#1E293B]">
              {personasWithWallets.map((persona) => (
                <div
                  key={persona.id}
                  className="px-4 py-3 flex items-center gap-4 hover:bg-[#0a0f1a]/30"
                >
                  {/* Avatar placeholder */}
                  <div className="w-8 h-8 rounded-full bg-[#1E293B] flex items-center justify-center text-xs text-[#A8E66B] font-bold flex-shrink-0">
                    {(persona.display_name || persona.username || '?').charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">
                        {persona.display_name || persona.username}
                      </span>
                      <span className="text-xs text-gray-500">@{persona.username}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-gray-400 font-mono">
                        {persona.sui_address?.slice(0, 10)}...{persona.sui_address?.slice(-6)}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyAddress(persona.sui_address!);
                        }}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        {copiedAddress === persona.sui_address ? (
                          <Check className="w-3 h-3 text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <a
                        href={`https://suiscan.xyz/testnet/address/${persona.sui_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-[#81E4F2] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQrModal({
                            address: persona.sui_address!,
                            label: 'Payment Wallet',
                            username: persona.username
                          });
                        }}
                        className="text-gray-500 hover:text-[#A8E66B] transition-colors"
                      >
                        <QrCode className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Balance (from persona record) */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-mono text-[#A8E66B]">
                      ${(persona.balance_usdc || 0).toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">USDC</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('wallets')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            view === 'wallets'
              ? 'bg-[#A8E66B] text-slate-900 font-medium'
              : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Wallets
          </span>
        </button>
        <button
          onClick={() => setView('earnings')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            view === 'earnings'
              ? 'bg-[#81E4F2] text-slate-900 font-medium'
              : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
          }`}
        >
          Earnings History
        </button>
        <button
          onClick={() => setView('treasury')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            view === 'treasury'
              ? 'bg-[#81E4F2] text-slate-900 font-medium'
              : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
          }`}
        >
          Treasury Holdings
        </button>
        <button
          onClick={() => setView('resolve')}
          className={`px-4 py-2 rounded-lg text-sm transition-colors ${
            view === 'resolve'
              ? 'bg-amber-500 text-slate-900 font-medium'
              : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Resolve
            {tbdPersonas.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-600 text-white text-xs rounded-full">
                {tbdPersonas.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Content */}
      {view === 'wallets' ? (
        <div className="space-y-4">
          {/* Refresh Button */}
          <div className="flex justify-end">
            <button
              onClick={fetchWalletBalances}
              disabled={loadingBalances}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 text-gray-300 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingBalances ? 'animate-spin' : ''}`} />
              Refresh Balances
            </button>
          </div>

          {/* Wallet Cards */}
          {loadingBalances && walletBalances.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#A8E66B]"></div>
            </div>
          ) : walletBalances.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No wallets found</p>
              <p className="text-sm text-gray-600 mt-2">
                Persona wallets are generated when you create new personas
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {walletBalances.map((wallet) => (
                <div
                  key={wallet.personaId}
                  className="p-5 bg-[#101726] border border-[#1E293B] rounded-lg"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg font-semibold text-white">
                          {wallet.displayName || wallet.username}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-[#A8E66B]/20 text-[#A8E66B] rounded">
                          @{wallet.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-gray-400 font-mono">
                          {wallet.suiAddress.slice(0, 10)}...{wallet.suiAddress.slice(-8)}
                        </code>
                        <button
                          onClick={() => copyAddress(wallet.suiAddress)}
                          className="text-gray-500 hover:text-white transition-colors"
                        >
                          {copiedAddress === wallet.suiAddress ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={`https://suiscan.xyz/testnet/address/${wallet.suiAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-[#81E4F2] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => setQrModal({
                            address: wallet.suiAddress,
                            label: 'Payment Wallet',
                            username: wallet.username
                          })}
                          className="text-gray-500 hover:text-[#A8E66B] transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Balances */}
                  <div className="flex gap-6 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">USDC Balance</div>
                      <div className="text-xl font-bold text-[#A8E66B]">
                        ${wallet.balances.usdc.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">SUI (for gas)</div>
                      <div className="text-xl font-bold text-[#81E4F2]">
                        {wallet.balances.sui.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  {/* Error message if any */}
                  {wallet.error && (
                    <div className="text-xs text-red-400 mb-3">
                      {wallet.error}
                    </div>
                  )}

                  {/* Withdraw Button */}
                  <button
                    onClick={() => setWithdrawModal({
                      isOpen: true,
                      personaId: wallet.personaId,
                      username: wallet.username,
                      suiAddress: wallet.suiAddress,
                      maxAmount: wallet.balances.usdc,
                    })}
                    disabled={wallet.balances.usdc <= 0}
                    className="flex items-center gap-2 px-4 py-2 bg-[#A8E66B] hover:bg-[#96d45f] text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                    Withdraw USDC
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Wallet Info */}
          <div className="p-4 bg-[#A8E66B]/10 border border-[#A8E66B]/30 rounded-lg text-sm text-[#A8E66B]/80">
            <p className="font-medium mb-1">About Persona Wallets</p>
            <p className="text-[#A8E66B]/60">
              Each persona has its own SUI wallet for receiving payments. As the account manager,
              you can withdraw from any persona wallet to an external address.
            </p>
          </div>
        </div>
      ) : view === 'earnings' ? (
        <div className="space-y-2">
          {earnings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No earnings yet</p>
              <p className="text-sm text-gray-600 mt-2">
                Earnings from downloads and royalties will appear here
              </p>
            </div>
          ) : (
            <div className="bg-[#101726] border border-[#1E293B] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0a0f1a]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Track</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {earnings.map((earning) => (
                    <tr key={earning.id} className="hover:bg-[#0a0f1a]/50">
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {formatDate(earning.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {getSourceLabel(earning.source_type)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white truncate max-w-[200px]">
                        {earning.track_title || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(earning.status)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-green-400">
                        +${earning.amount_usdc.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {earning.tx_hash ? (
                          <a
                            href={`https://suiscan.xyz/mainnet/tx/${earning.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#81E4F2] hover:underline"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : view === 'treasury' ? (
        <div className="space-y-2">
          {treasuryHoldings.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No treasury holdings</p>
              <p className="text-sm text-gray-600 mt-2">
                Funds held for unnamed collaborators will appear here
              </p>
            </div>
          ) : (
            <div className="bg-[#101726] border border-[#1E293B] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#0a0f1a]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Collaborator</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Track</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E293B]">
                  {treasuryHoldings.map((holding) => (
                    <tr key={holding.id} className="hover:bg-[#0a0f1a]/50">
                      <td className="px-4 py-3 text-sm text-white">
                        {holding.label || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300 truncate max-w-[200px]">
                        {holding.track_title || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {holding.claimed_at ? (
                          <span className="px-2 py-0.5 bg-green-900/50 text-green-300 text-xs rounded">
                            Claimed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-900/50 text-amber-300 text-xs rounded flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-amber-400">
                        ${holding.balance_usdc.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-400">
                        {formatDate(holding.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Treasury Info */}
          <div className="p-4 bg-amber-900/10 border border-amber-900/30 rounded-lg text-sm text-amber-200/80">
            <p className="font-medium mb-1">About Treasury Holdings</p>
            <p className="text-amber-200/60">
              When you add collaborators by name only (without a wallet address), their earnings
              are held in your SUI wallet. When they create a mixmi account and claim their earnings,
              the funds will transfer to their address.
            </p>
          </div>
        </div>
      ) : view === 'resolve' ? (
        /* Resolve View - TBD Personas */
        <div className="space-y-4">
          {loadingTbd ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : tbdPersonas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-50 text-green-500" />
              <p className="text-green-400 font-medium">All caught up!</p>
              <p className="text-sm text-gray-600 mt-2">
                No TBD collaborators to resolve
              </p>
            </div>
          ) : (
            <>
              {/* TBD Personas List */}
              <div className="space-y-3">
                {tbdPersonas.map((tbd) => (
                  <div
                    key={tbd.id}
                    className="p-4 bg-[#101726] border border-amber-900/30 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {/* Avatar placeholder */}
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                          {tbd.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{tbd.displayName}</span>
                            <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                              @{tbd.username}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {tbd.trackCount} track{tbd.trackCount !== 1 ? 's' : ''} · Created {formatDate(tbd.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-amber-400">
                          ${tbd.balance.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">held</div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => generateInviteLink(tbd)}
                        disabled={generatingInvite === tbd.id}
                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                          inviteCopied === tbd.id
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-gray-300'
                        } disabled:opacity-50`}
                      >
                        {generatingInvite === tbd.id ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Generating...
                          </>
                        ) : inviteCopied === tbd.id ? (
                          <>
                            <Check className="w-4 h-4" />
                            Link Copied!
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            Invite
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setResolveModal({ persona: tbd, action: 'link' });
                          setLinkSearchQuery('');
                          setLinkSearchResults([]);
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30 text-[#81E4F2] rounded-lg transition-colors text-sm"
                      >
                        <Link2 className="w-4 h-4" />
                        Link to User
                      </button>
                      <button
                        onClick={() => setResolveModal({ persona: tbd, action: 'merge' })}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#A8E66B]/20 hover:bg-[#A8E66B]/30 text-[#A8E66B] rounded-lg transition-colors text-sm"
                      >
                        <UserCheck className="w-4 h-4" />
                        This is Me
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Resolve Info */}
              <div className="p-4 bg-amber-900/10 border border-amber-900/30 rounded-lg text-sm text-amber-200/80">
                <p className="font-medium mb-1">About TBD Collaborators</p>
                <p className="text-amber-200/60">
                  These are placeholder accounts created for collaborators who weren't on mixmi when you uploaded.
                  Their earnings are held safely until you resolve them:
                </p>
                <ul className="text-amber-200/60 mt-2 space-y-1 text-xs">
                  <li>• <strong>Invite</strong> - Send them a link to join mixmi and claim their earnings</li>
                  <li>• <strong>Link to User</strong> - Connect to an existing mixmi user</li>
                  <li>• <strong>This is Me</strong> - Merge into one of your own personas</li>
                </ul>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Resolve Modal - Link to User */}
      {resolveModal && resolveModal.action === 'link' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#151C2A] border border-[#1E293B] rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Link to User</h3>
              <button
                onClick={() => setResolveModal(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-[#0a0f1a] rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Linking earnings from</div>
                <div className="text-white font-medium">{resolveModal.persona.displayName}</div>
                <div className="text-xs text-gray-400">@{resolveModal.persona.username}</div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Search for user</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={linkSearchQuery}
                    onChange={(e) => {
                      setLinkSearchQuery(e.target.value);
                      searchUsersForLink(e.target.value);
                    }}
                    placeholder="Search by name or username..."
                    className="w-full pl-10 pr-4 py-3 bg-[#0a0f1a] border border-[#1E293B] rounded-lg text-white focus:border-[#81E4F2] focus:outline-none"
                  />
                </div>
              </div>

              {/* Search Results */}
              {searchingUsers ? (
                <div className="text-center py-4 text-gray-500">Searching...</div>
              ) : linkSearchResults.length > 0 ? (
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {linkSearchResults.map((user) => (
                    <button
                      key={user.walletAddress || user.username}
                      onClick={() => {
                        // TODO: Implement actual linking
                        alert(`Link to @${user.username} - Feature coming soon!`);
                        setResolveModal(null);
                      }}
                      className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left transition-colors"
                    >
                      <div className="text-white font-medium">{user.displayName || user.username}</div>
                      <div className="text-xs text-gray-400">@{user.username}</div>
                    </button>
                  ))}
                </div>
              ) : linkSearchQuery.length >= 2 ? (
                <div className="text-center py-4 text-gray-500">No users found</div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal - This is Me */}
      {resolveModal && resolveModal.action === 'merge' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#151C2A] border border-[#1E293B] rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Merge into Your Account</h3>
              <button
                onClick={() => setResolveModal(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-[#0a0f1a] rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Merging</div>
                <div className="text-white font-medium">{resolveModal.persona.displayName}</div>
                <div className="text-xs text-amber-400">${resolveModal.persona.balance.toFixed(2)} held</div>
              </div>

              <p className="text-sm text-gray-400">
                Select which of your personas to merge this into. The TBD wallet will be replaced
                with your persona's wallet on all associated tracks.
              </p>

              <div className="space-y-2">
                {personas.filter(p => !p.username.includes('-tbd')).map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => {
                      // TODO: Implement actual merge
                      alert(`Merge into @${persona.username} - Feature coming soon!`);
                      setResolveModal(null);
                    }}
                    className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-lg text-left transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="text-white font-medium">{persona.display_name || persona.username}</div>
                      <div className="text-xs text-gray-400">@{persona.username}</div>
                    </div>
                    <UserCheck className="w-5 h-5 text-[#A8E66B]" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {withdrawModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#151C2A] border border-[#1E293B] rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Withdraw USDC</h3>
              <button
                onClick={() => {
                  setWithdrawModal(null);
                  setWithdrawAddress('');
                  setWithdrawAmount('');
                  setWithdrawError('');
                  setWithdrawSuccess('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* From wallet info */}
              <div className="p-3 bg-[#0a0f1a] rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Withdrawing from</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">@{withdrawModal.username}</span>
                  <code className="text-xs text-gray-400 font-mono">
                    {withdrawModal.suiAddress.slice(0, 8)}...{withdrawModal.suiAddress.slice(-6)}
                  </code>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Available: <span className="text-[#A8E66B]">${withdrawModal.maxAmount.toFixed(2)} USDC</span>
                </div>
              </div>

              {/* Destination address */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Destination SUI Address
                </label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-3 bg-[#0a0f1a] border border-[#1E293B] rounded-lg text-white font-mono text-sm focus:border-[#A8E66B] focus:outline-none"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Amount (USDC)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    max={withdrawModal.maxAmount}
                    className="w-full pl-8 pr-20 py-3 bg-[#0a0f1a] border border-[#1E293B] rounded-lg text-white font-mono focus:border-[#A8E66B] focus:outline-none"
                  />
                  <button
                    onClick={() => setWithdrawAmount(withdrawModal.maxAmount.toString())}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-[#A8E66B]/20 text-[#A8E66B] rounded hover:bg-[#A8E66B]/30 transition-colors"
                  >
                    MAX
                  </button>
                </div>
              </div>

              {/* Error/Success Messages */}
              {withdrawError && (
                <div className="p-3 bg-red-900/20 border border-red-900/30 rounded-lg text-sm text-red-400">
                  {withdrawError}
                </div>
              )}
              {withdrawSuccess && (
                <div className="p-3 bg-green-900/20 border border-green-900/30 rounded-lg text-sm text-green-400">
                  {withdrawSuccess}
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !!withdrawSuccess}
                className="w-full py-3 bg-[#A8E66B] hover:bg-[#96d45f] text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {withdrawing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Confirm Withdrawal
                  </>
                )}
              </button>

              {/* Gas fee notice */}
              <p className="text-xs text-gray-500 text-center">
                A small SUI gas fee will be deducted from the persona wallet
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
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
