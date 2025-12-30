'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Persona } from '@/contexts/AuthContext';
import { DollarSign, ArrowUpRight, Clock, Users, ExternalLink } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'earnings' | 'treasury'>('earnings');

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

      {/* View Toggle */}
      <div className="flex gap-2">
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
      </div>

      {/* Content */}
      {view === 'earnings' ? (
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
      ) : (
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
      )}
    </div>
  );
}
