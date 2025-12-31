"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ADMIN_CODE = 'mixmi-admin-2024';

interface Persona {
  id: string;
  username: string;
  display_name: string | null;
  wallet_address: string | null;
  sui_address: string | null;
  account_id: string;
  is_default: boolean;
}

interface WalletInfo {
  wallet_address: string;
  display_name: string | null;
  username: string | null;
  account_id: string | null;
  sui_address: string | null;
  track_count: number;
}

interface AccountInfo {
  account_id: string;
  default_username: string;
  display_name: string | null;
  sui_address: string | null;
}

interface AlphaUser {
  invite_code: string;
  wallet_address: string | null;
  sui_migration_notes: string | null;
  created_at: string;
  artist_name: string | null;
  email: string | null;
  notes: string | null;
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
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [alphaUsers, setAlphaUsers] = useState<AlphaUser[]>([]);

  // Alpha Users editing state
  const [editingAlphaInviteCode, setEditingAlphaInviteCode] = useState<string | null>(null);
  const [editingAlphaNotes, setEditingAlphaNotes] = useState('');

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

  // Form 4: Add Persona to Account
  const [addPersonaAccount, setAddPersonaAccount] = useState('');
  const [addPersonaUsername, setAddPersonaUsername] = useState('');
  const [addPersonaDisplayName, setAddPersonaDisplayName] = useState('');
  const [addPersonaWallet, setAddPersonaWallet] = useState('');
  const [addPersonaCopyProfile, setAddPersonaCopyProfile] = useState(true);

  // Form 5: Delete Persona
  const [deletePersonaUsername, setDeletePersonaUsername] = useState('');

  // Form 6: Edit Persona
  const [editPersonaCurrent, setEditPersonaCurrent] = useState('');
  const [editPersonaNewUsername, setEditPersonaNewUsername] = useState('');
  const [editPersonaNewDisplayName, setEditPersonaNewDisplayName] = useState('');

  // Form 7: Generate Wallet
  const [generateWalletPersona, setGenerateWalletPersona] = useState('');

  // Form 8: Link STX Wallet to Persona
  const [linkStxPersona, setLinkStxPersona] = useState('');
  const [linkStxAddress, setLinkStxAddress] = useState('');

  // Fetch data
  const fetchData = async () => {
    // Fetch personas
    const { data: personasData } = await supabase
      .from('personas')
      .select('id, username, display_name, wallet_address, sui_address, account_id, is_default')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    setPersonas(personasData || []);

    // Fetch wallets with track counts and sui_address
    const { data: profilesData } = await supabase
      .from('user_profiles')
      .select('wallet_address, display_name, username, account_id, sui_address')
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
            sui_address: profile.sui_address || null,
            track_count: count || 0
          };
        })
      );

      setWallets(walletsWithCounts);

      // Build accounts list with SUI addresses
      // Group by account_id and find the SUI address for each
      if (personasData) {
        const accountMap = new Map<string, AccountInfo>();

        personasData.forEach((persona) => {
          if (!accountMap.has(persona.account_id)) {
            // Find SUI address for this account from profiles
            const matchingProfile = walletsWithCounts.find(
              w => w.account_id === persona.account_id && w.sui_address
            );

            accountMap.set(persona.account_id, {
              account_id: persona.account_id,
              default_username: persona.is_default ? persona.username : persona.username,
              display_name: persona.display_name,
              sui_address: matchingProfile?.sui_address || null
            });
          }
          // Update with default persona info if this is the default
          if (persona.is_default) {
            const existing = accountMap.get(persona.account_id)!;
            existing.default_username = persona.username;
            existing.display_name = persona.display_name;
          }
        });

        setAccounts(Array.from(accountMap.values()));
      }
    }

    // Fetch alpha_users via API (bypasses RLS)
    try {
      const alphaRes = await fetch('/api/admin/alpha-users', {
        headers: { 'x-admin-code': ADMIN_CODE }
      });
      if (alphaRes.ok) {
        const alphaJson = await alphaRes.json();
        setAlphaUsers(alphaJson.users || []);
      }
    } catch (err) {
      console.error('Error fetching alpha_users:', err);
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

  // Form 4: Add Persona to Account
  const handleAddPersonaToAccount = async () => {
    if (!addPersonaAccount || !addPersonaUsername) {
      showMessage('Account and username are required', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/add-persona-to-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: addPersonaAccount,
          username: addPersonaUsername.toLowerCase().trim(),
          displayName: addPersonaDisplayName.trim() || null,
          walletAddress: addPersonaWallet.trim() || null,
          copyProfileData: addPersonaCopyProfile,
          adminCode: ADMIN_CODE
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Failed to add persona', true);
      } else {
        showMessage(`${data.message}${data.data.trackCount ? ` (${data.data.trackCount} tracks)` : ''}`, false);
        setAddPersonaUsername('');
        setAddPersonaDisplayName('');
        setAddPersonaWallet('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  // Form 5: Delete Persona
  const handleDeletePersona = async () => {
    if (!deletePersonaUsername) {
      showMessage('Username is required', true);
      return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete @${deletePersonaUsername}? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/delete-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: deletePersonaUsername.toLowerCase().trim(),
          adminCode: ADMIN_CODE
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Failed to delete persona', true);
      } else {
        showMessage(data.message, false);
        setDeletePersonaUsername('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  // Form 6: Edit Persona
  const handleEditPersona = async () => {
    if (!editPersonaCurrent) {
      showMessage('Select a persona to edit', true);
      return;
    }

    if (!editPersonaNewUsername && !editPersonaNewDisplayName) {
      showMessage('Enter a new username or display name', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/edit-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUsername: editPersonaCurrent,
          newUsername: editPersonaNewUsername.trim() || null,
          newDisplayName: editPersonaNewDisplayName.trim() || null,
          adminCode: ADMIN_CODE
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Failed to edit persona', true);
      } else {
        showMessage(data.message, false);
        setEditPersonaCurrent('');
        setEditPersonaNewUsername('');
        setEditPersonaNewDisplayName('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  // Form 7: Generate Wallet
  const handleGenerateWallet = async () => {
    if (!generateWalletPersona) {
      showMessage('Select a persona', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/generate-persona-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaUsername: generateWalletPersona,
          adminCode: ADMIN_CODE
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Failed to generate wallet', true);
      } else {
        showMessage(`${data.message}: ${data.data.suiAddress.slice(0, 20)}...`, false);
        setGenerateWalletPersona('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  // Form 8: Link STX Wallet to Persona
  const handleLinkStxToPersona = async () => {
    if (!linkStxPersona || !linkStxAddress) {
      showMessage('Both persona and STX address are required', true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/link-stx-to-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaUsername: linkStxPersona,
          stxAddress: linkStxAddress.trim(),
          adminCode: ADMIN_CODE
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showMessage(data.error || 'Failed to link STX wallet', true);
      } else {
        showMessage(data.message, false);
        setLinkStxPersona('');
        setLinkStxAddress('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  // Alpha Users: Update notes
  const handleUpdateAlphaNotes = async (invite_code: string, notes: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/alpha-users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code, sui_migration_notes: notes, adminCode: ADMIN_CODE })
      });

      if (!res.ok) {
        const data = await res.json();
        showMessage(data.error || 'Failed to update notes', true);
      } else {
        showMessage('Notes updated', false);
        setEditingAlphaInviteCode(null);
        setEditingAlphaNotes('');
        fetchData();
      }
    } catch (err) {
      showMessage('Network error', true);
    }
    setLoading(false);
  };

  // Alpha Users: Delete
  const handleDeleteAlphaUser = async (inviteCode: string) => {
    if (!confirm(`Delete alpha user with invite code "${inviteCode}"? This cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/alpha-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: inviteCode, adminCode: ADMIN_CODE })
      });

      if (!res.ok) {
        const data = await res.json();
        showMessage('Failed to delete: ' + (data.error || 'Unknown error'), true);
      } else {
        showMessage('Alpha user deleted', false);
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

          {/* Form 4: Add Persona to Account */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#FFC044] mb-4">4. Add Persona to Account</h2>
            <p className="text-gray-400 text-sm mb-4">
              Add a new persona to an existing account. Use original usernames!
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Account *</label>
                <select
                  value={addPersonaAccount}
                  onChange={(e) => setAddPersonaAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="">Select account...</option>
                  {accounts.map((acc) => (
                    <option key={acc.account_id} value={acc.account_id}>
                      @{acc.default_username} {acc.sui_address ? `(${acc.sui_address.slice(0, 8)}...${acc.sui_address.slice(-4)})` : '(no SUI wallet)'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Persona Username *</label>
                <input
                  type="text"
                  value={addPersonaUsername}
                  onChange={(e) => setAddPersonaUsername(e.target.value)}
                  placeholder="e.g., radiocity"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Display Name</label>
                <input
                  type="text"
                  value={addPersonaDisplayName}
                  onChange={(e) => setAddPersonaDisplayName(e.target.value)}
                  placeholder="e.g., Radio City"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Wallet Address (optional)</label>
                <input
                  type="text"
                  value={addPersonaWallet}
                  onChange={(e) => setAddPersonaWallet(e.target.value)}
                  placeholder="SP... - links wallet content"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-mono"
                />
              </div>
              {addPersonaWallet && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="addPersonaCopyProfile"
                    checked={addPersonaCopyProfile}
                    onChange={(e) => setAddPersonaCopyProfile(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="addPersonaCopyProfile" className="text-gray-300 text-sm">
                    Copy profile data from wallet
                  </label>
                </div>
              )}
              <button
                onClick={handleAddPersonaToAccount}
                disabled={loading}
                className="w-full py-2 bg-[#FFC044] text-slate-900 font-semibold rounded-lg hover:bg-[#efb034] disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Persona'}
              </button>
            </div>
          </div>
        </div>

        {/* Forms 5, 6 & 7 Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Form 5: Delete Persona */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-red-400 mb-4">5. Delete Persona</h2>
            <p className="text-gray-400 text-sm mb-4">
              Delete a persona. If it's the only persona on an account, deletes the account too.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Username to Delete *</label>
                <select
                  value={deletePersonaUsername}
                  onChange={(e) => setDeletePersonaUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="">Select persona to delete...</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.username}>
                      @{p.username} {p.display_name ? `(${p.display_name})` : ''} {p.is_default ? '⚠️ default' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleDeletePersona}
                disabled={loading || !deletePersonaUsername}
                className="w-full py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete Persona'}
              </button>
            </div>
          </div>

          {/* Form 6: Edit Persona */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#81E4F2] mb-4">6. Edit Persona</h2>
            <p className="text-gray-400 text-sm mb-4">
              Change a persona's username or display name.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Select Persona *</label>
                <select
                  value={editPersonaCurrent}
                  onChange={(e) => setEditPersonaCurrent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="">Select persona to edit...</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.username}>
                      @{p.username} {p.display_name ? `(${p.display_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">New Username</label>
                <input
                  type="text"
                  value={editPersonaNewUsername}
                  onChange={(e) => setEditPersonaNewUsername(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">New Display Name</label>
                <input
                  type="text"
                  value={editPersonaNewDisplayName}
                  onChange={(e) => setEditPersonaNewDisplayName(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                />
              </div>
              <button
                onClick={handleEditPersona}
                disabled={loading || !editPersonaCurrent}
                className="w-full py-2 bg-[#81E4F2] text-slate-900 font-semibold rounded-lg hover:bg-[#6dd4e2] disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Persona'}
              </button>
            </div>
          </div>

          {/* Form 7: Generate Wallet */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-[#A8E66B] mb-4">7. Generate Wallet</h2>
            <p className="text-gray-400 text-sm mb-4">
              Generate a SUI wallet for a persona. Account must have logged in via zkLogin first.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Select Persona *</label>
                <select
                  value={generateWalletPersona}
                  onChange={(e) => setGenerateWalletPersona(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="">Select persona...</option>
                  {personas.filter(p => !p.sui_address).map((p) => (
                    <option key={p.id} value={p.username}>
                      @{p.username} {p.display_name ? `(${p.display_name})` : ''} - no wallet
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-gray-500">
                Showing {personas.filter(p => !p.sui_address).length} personas without wallets
              </div>
              <button
                onClick={handleGenerateWallet}
                disabled={loading || !generateWalletPersona}
                className="w-full py-2 bg-[#A8E66B] text-slate-900 font-semibold rounded-lg hover:bg-[#98d65b] disabled:opacity-50"
              >
                {loading ? 'Generating...' : 'Generate Wallet'}
              </button>
            </div>
          </div>

          {/* Form 8: Link STX Wallet to Persona */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-amber-400 mb-4">8. Link STX Wallet to Persona</h2>
            <p className="text-gray-400 text-sm mb-4">
              Connect an old STX wallet address to an existing persona for split matching.
              This only updates the wallet_address field - nothing else is changed.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Select Persona *</label>
                <select
                  value={linkStxPersona}
                  onChange={(e) => setLinkStxPersona(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                >
                  <option value="">-- Select Persona --</option>
                  {personas.map((p) => (
                    <option key={p.id} value={p.username}>
                      @{p.username} {p.display_name ? `(${p.display_name})` : ''}
                      {p.wallet_address ? ' [has STX]' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">STX Wallet Address *</label>
                <input
                  type="text"
                  value={linkStxAddress}
                  onChange={(e) => setLinkStxAddress(e.target.value)}
                  placeholder="SP... or ST..."
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-mono"
                />
              </div>
              <button
                onClick={handleLinkStxToPersona}
                disabled={loading || !linkStxPersona || !linkStxAddress}
                className="w-full py-2 bg-amber-500 text-slate-900 font-semibold rounded-lg hover:bg-amber-400 disabled:opacity-50"
              >
                {loading ? 'Linking...' : 'Link STX Wallet'}
              </button>
            </div>
          </div>
        </div>

        {/* Data Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personas List */}
          <div className="bg-slate-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Personas ({personas.length})
              <span className="text-sm font-normal text-gray-400 ml-2">
                {personas.filter(p => p.sui_address).length} with wallets
              </span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-slate-700">
                    <th className="text-left py-2">Username</th>
                    <th className="text-left py-2">Display Name</th>
                    <th className="text-left py-2">SUI Wallet</th>
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
                      <td className="py-2 font-mono text-xs">
                        {p.sui_address ? (
                          <span className="text-[#A8E66B]">{p.sui_address.slice(0, 10)}...{p.sui_address.slice(-4)}</span>
                        ) : (
                          <span className="text-yellow-500">No wallet</span>
                        )}
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

        {/* Alpha Users Table - Full Width */}
        <div className="bg-slate-800 rounded-xl p-6 mt-6">
          <h2 className="text-xl font-semibold text-amber-400 mb-4">
            Alpha Users ({alphaUsers.length})
            <span className="text-sm font-normal text-gray-400 ml-2">
              Invite codes & migration tracking
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-slate-700">
                  <th className="text-left py-2">Invite Code</th>
                  <th className="text-left py-2">STX Wallet</th>
                  <th className="text-left py-2">Artist/Email</th>
                  <th className="text-left py-2 min-w-[300px]">Migration Notes</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {alphaUsers.map((au) => (
                  <tr key={au.invite_code} className="border-b border-slate-700/50">
                    <td className="py-2 text-[#81E4F2] font-mono">{au.invite_code}</td>
                    <td className="py-2 text-gray-400 font-mono text-xs">
                      {au.wallet_address ? (
                        <span title={au.wallet_address}>
                          {au.wallet_address.slice(0, 12)}...
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-300 text-xs">
                      {au.artist_name || au.email || '-'}
                    </td>
                    <td className="py-2">
                      {editingAlphaInviteCode === au.invite_code ? (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingAlphaNotes}
                            onChange={(e) => setEditingAlphaNotes(e.target.value)}
                            className="flex-1 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                            placeholder="Add notes..."
                            autoFocus
                          />
                          <button
                            onClick={() => handleUpdateAlphaNotes(au.invite_code, editingAlphaNotes)}
                            disabled={loading}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-500"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingAlphaInviteCode(null);
                              setEditingAlphaNotes('');
                            }}
                            className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingAlphaInviteCode(au.invite_code);
                            setEditingAlphaNotes(au.sui_migration_notes || '');
                          }}
                          className="cursor-pointer hover:bg-slate-700/50 px-2 py-1 rounded min-h-[28px]"
                          title="Click to edit"
                        >
                          {au.sui_migration_notes ? (
                            <span className="text-white">{au.sui_migration_notes}</span>
                          ) : (
                            <span className="text-gray-600 italic">Click to add notes...</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleDeleteAlphaUser(au.invite_code)}
                        disabled={loading}
                        className="px-2 py-1 bg-red-600/20 text-red-400 rounded text-xs hover:bg-red-600/40"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {alphaUsers.length === 0 && (
            <p className="text-gray-500 text-center py-4">No alpha users found</p>
          )}
        </div>
      </div>
    </div>
  );
}
