"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ADMIN_CODE = 'mixmi-admin-2024';

interface Persona {
  id: string;
  username: string;
  display_name: string | null;
  wallet_address: string | null;
  account_id: string;
  is_default: boolean;
}

interface WalletInfo {
  wallet_address: string;
  display_name: string | null;
  username: string | null;
  account_id: string | null;
  track_count: number;
}

export default function AdminUsersPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Data lists
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [wallets, setWallets] = useState<WalletInfo[]>([]);

  // Form 1: Create zkLogin User
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newInviteCode, setNewInviteCode] = useState('');

  // Form 2: Migrate Wallet User
  const [migrateWallet, setMigrateWallet] = useState('');
  const [migrateUsername, setMigrateUsername] = useState('');
  const [migrateInviteCode, setMigrateInviteCode] = useState('');

  // Form 3: Transfer Wallet to Persona
  const [transferWallet, setTransferWallet] = useState('');
  const [transferPersona, setTransferPersona] = useState('');
  const [copyProfileData, setCopyProfileData] = useState(true);

  // Fetch data
  const fetchData = async () => {
    // Fetch personas
    const { data: personasData } = await supabase
      .from('personas')
      .select('id, username, display_name, wallet_address, account_id, is_default')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    setPersonas(personasData || []);

    // Fetch wallets with track counts
    const { data: profilesData } = await supabase
      .from('user_profiles')
      .select('wallet_address, display_name, username, account_id')
      .order('created_at', { ascending: false });

    if (profilesData) {
      // Get track counts for each wallet
      const walletsWithCounts = await Promise.all(
        profilesData.map(async (profile) => {
          const { count } = await supabase
            .from('ip_tracks')
            .select('*', { count: 'exact', head: true })
            .eq('primary_uploader_wallet', profile.wallet_address)
            .is('deleted_at', null);

          return {
            ...profile,
            track_count: count || 0
          };
        })
      );

      setWallets(walletsWithCounts);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchData();
    }
  }, [isAuthorized]);

  const handleAuth = () => {
    if (codeInput === ADMIN_CODE) {
      setIsAuthorized(true);
      setError('');
    } else {
      setError('Invalid access code');
    }
  };

  const showMessage = (msg: string, isError: boolean) => {
    if (isError) {
      setError(msg);
      setSuccess('');
    } else {
      setSuccess(msg);
      setError('');
    }
    setTimeout(() => {
      setError('');
      setSuccess('');
    }, 5000);
  };

  // Form 1: Create zkLogin User
  const handleCreateZkLoginUser = async () => {
    if (!newUsername || !newInviteCode) {
      showMessage('Username and invite code are required', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/create-zklogin-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername.toLowerCase().trim(),
          displayName: newDisplayName.trim() || newUsername,
          inviteCode: newInviteCode.toUpperCase().trim(),
          adminCode: ADMIN_CODE
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Failed to create user', true);
      } else {
        showMessage(data.message, false);
        setNewUsername('');
        setNewDisplayName('');
        setNewInviteCode('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  // Form 2: Migrate Wallet User
  const handleMigrateWalletUser = async () => {
    if (!migrateWallet || !migrateUsername) {
      showMessage('Wallet address and username are required', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/migrate-wallet-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: migrateWallet.trim(),
          personaUsername: migrateUsername.toLowerCase().trim(),
          inviteCode: migrateInviteCode.toUpperCase().trim() || null,
          adminCode: ADMIN_CODE
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Failed to migrate user', true);
      } else {
        showMessage(`${data.message} (${data.data.trackCount} tracks)`, false);
        setMigrateWallet('');
        setMigrateUsername('');
        setMigrateInviteCode('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  // Form 3: Transfer Wallet to Persona
  const handleTransferWallet = async () => {
    if (!transferWallet || !transferPersona) {
      showMessage('Wallet and persona username are required', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/transfer-wallet-to-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWallet: transferWallet.trim(),
          targetPersonaUsername: transferPersona.toLowerCase().trim(),
          copyProfileData,
          adminCode: ADMIN_CODE
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Failed to transfer wallet', true);
      } else {
        showMessage(`${data.message} (${data.data.trackCount} tracks)`, false);
        setTransferWallet('');
        setTransferPersona('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] to-[#1a1f2e] flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-white mb-6">Admin Access</h1>
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            placeholder="Enter access code"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white mb-4"
          />
          {error && <p className="text-red-400 mb-4">{error}</p>}
          <button
            onClick={handleAuth}
            className="w-full py-3 bg-[#81E4F2] text-slate-900 font-semibold rounded-lg hover:bg-[#6dd4e2]"
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1a] to-[#1a1f2e] p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">User Administration</h1>
        <p className="text-gray-400 mb-8">Manage alpha users, personas, and wallet transfers</p>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-900/30 border border-green-500 rounded-lg text-green-300">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Form 1: Create zkLogin User */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#81E4F2] mb-4">1. Create zkLogin User</h2>
            <p className="text-gray-400 text-sm mb-4">
              For new users without a Stacks wallet. Creates account, persona, and invite code.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Username *</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="e.g., radiobundle"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Display Name</label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="e.g., Radio Bundle"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Invite Code *</label>
                <input
                  type="text"
                  value={newInviteCode}
                  onChange={(e) => setNewInviteCode(e.target.value)}
                  placeholder="e.g., RADIO-2024"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm uppercase"
                />
              </div>
              <button
                onClick={handleCreateZkLoginUser}
                disabled={loading}
                className="w-full py-2 bg-[#81E4F2] text-slate-900 font-semibold rounded-lg hover:bg-[#6dd4e2] disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>

          {/* Form 2: Migrate Wallet User */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#A8E66B] mb-4">2. Migrate Wallet User</h2>
            <p className="text-gray-400 text-sm mb-4">
              For existing wallet users. Creates account + persona from their wallet.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Wallet Address *</label>
                <input
                  type="text"
                  value={migrateWallet}
                  onChange={(e) => setMigrateWallet(e.target.value)}
                  placeholder="SP..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Persona Username *</label>
                <input
                  type="text"
                  value={migrateUsername}
                  onChange={(e) => setMigrateUsername(e.target.value)}
                  placeholder="e.g., djcoolname"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Invite Code (optional)</label>
                <input
                  type="text"
                  value={migrateInviteCode}
                  onChange={(e) => setMigrateInviteCode(e.target.value)}
                  placeholder="For zkLogin access later"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm uppercase"
                />
              </div>
              <button
                onClick={handleMigrateWalletUser}
                disabled={loading}
                className="w-full py-2 bg-[#A8E66B] text-slate-900 font-semibold rounded-lg hover:bg-[#98d65b] disabled:opacity-50"
              >
                {loading ? 'Migrating...' : 'Migrate User'}
              </button>
            </div>
          </div>

          {/* Form 3: Transfer Wallet to Persona */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#A084F9] mb-4">3. Transfer Wallet to Persona</h2>
            <p className="text-gray-400 text-sm mb-4">
              Link additional wallet content to an existing persona.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Source Wallet *</label>
                <input
                  type="text"
                  value={transferWallet}
                  onChange={(e) => setTransferWallet(e.target.value)}
                  placeholder="SP..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Target Persona *</label>
                <select
                  value={transferPersona}
                  onChange={(e) => setTransferPersona(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="">Select persona...</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.username}>
                      @{p.username} {p.display_name ? `(${p.display_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="copyProfile"
                  checked={copyProfileData}
                  onChange={(e) => setCopyProfileData(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="copyProfile" className="text-gray-300 text-sm">
                  Copy profile data (name, avatar, bio)
                </label>
              </div>
              <button
                onClick={handleTransferWallet}
                disabled={loading}
                className="w-full py-2 bg-[#A084F9] text-white font-semibold rounded-lg hover:bg-[#9074e9] disabled:opacity-50"
              >
                {loading ? 'Transferring...' : 'Transfer Wallet'}
              </button>
            </div>
          </div>
        </div>

        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personas List */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Personas ({personas.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-slate-700">
                    <th className="text-left py-2">Username</th>
                    <th className="text-left py-2">Display Name</th>
                    <th className="text-left py-2">Wallet</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((p) => (
                    <tr key={p.id} className="border-b border-slate-700/50">
                      <td className="py-2 text-[#81E4F2]">
                        @{p.username}
                        {p.is_default && <span className="ml-1 text-xs text-gray-500">(default)</span>}
                      </td>
                      <td className="py-2 text-white">{p.display_name || '-'}</td>
                      <td className="py-2 text-gray-400 font-mono text-xs">
                        {p.wallet_address ? p.wallet_address.slice(0, 10) + '...' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wallets List */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Wallets ({wallets.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-slate-700">
                    <th className="text-left py-2">Wallet</th>
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Tracks</th>
                    <th className="text-left py-2">Linked</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((w) => (
                    <tr key={w.wallet_address} className="border-b border-slate-700/50">
                      <td className="py-2 text-gray-400 font-mono text-xs">
                        {w.wallet_address.slice(0, 12)}...
                      </td>
                      <td className="py-2 text-white">{w.display_name || w.username || '-'}</td>
                      <td className="py-2 text-[#A8E66B]">{w.track_count}</td>
                      <td className="py-2">
                        {w.account_id ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-yellow-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
