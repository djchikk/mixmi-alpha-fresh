"use client";

import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabase';
import PortalCard from '@/components/cards/PortalCard';
import { useLocationAutocomplete } from '@/hooks/useLocationAutocomplete';
import TrackCoverUploader from '@/components/shared/TrackCoverUploader';

// Simple access code - change this to something only you know
const ADMIN_CODE = 'mixmi-portal-admin-2024';

interface PortalForm {
  name: string;
  description: string;
  imageUrl: string;
  portalUsername: string;
  walletAddress: string;  // Portal Keeper's wallet - ties ownership
  location: string;
  lat: number | null;
  lng: number | null;
}

interface UserSearchResult {
  walletAddress: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

interface ExistingPortal {
  id: string;
  title: string;
  description: string;
  cover_image_url: string;
  portal_username: string;
  primary_location: string;
  location_lat: number;
  location_lng: number;
  created_at: string;
}

export default function AdminPortalsPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState<PortalForm>({
    name: '',
    description: '',
    imageUrl: '',
    portalUsername: '',
    walletAddress: '',
    location: '',
    lat: null,
    lng: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // User search state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const userSearchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Search for users by name
  const handleUserSearch = (query: string) => {
    setUserSearchQuery(query);

    if (userSearchTimeout.current) {
      clearTimeout(userSearchTimeout.current);
    }

    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setUserSearchLoading(true);
    userSearchTimeout.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/profile/search-users?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        setUserSearchResults(data.users || []);
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);
  };

  const handleUserSelect = (user: UserSearchResult) => {
    setForm({
      ...form,
      portalUsername: user.username,
      walletAddress: user.walletAddress,
      name: form.name || user.displayName, // Pre-fill name if empty
    });
    setUserSearchQuery(user.displayName);
    setShowUserSuggestions(false);
    setUserSearchResults([]);
  };

  // Location autocomplete
  const {
    suggestions: locationSuggestions,
    isLoading: locationLoading,
    handleInputChange: handleLocationSearch,
    clearSuggestions: clearLocationSuggestions,
  } = useLocationAutocomplete({ minCharacters: 2, limit: 6 });

  const handleLocationSelect = (suggestion: { place_name: string; center: [number, number] }) => {
    setForm({
      ...form,
      location: suggestion.place_name,
      lng: suggestion.center[0],
      lat: suggestion.center[1],
    });
    setShowLocationSuggestions(false);
    clearLocationSuggestions();
  };
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [existingPortals, setExistingPortals] = useState<ExistingPortal[]>([]);
  const [loadingPortals, setLoadingPortals] = useState(false);

  // Check if already authorized (stored in sessionStorage)
  useEffect(() => {
    const stored = sessionStorage.getItem('portal-admin-auth');
    if (stored === 'true') {
      setIsAuthorized(true);
    }
  }, []);

  // Load existing portals when authorized
  useEffect(() => {
    if (isAuthorized) {
      loadExistingPortals();
    }
  }, [isAuthorized]);

  const loadExistingPortals = async () => {
    setLoadingPortals(true);
    const { data, error } = await supabase
      .from('ip_tracks')
      .select('*')
      .eq('content_type', 'portal')
      .order('created_at', { ascending: false });

    if (data && !error) {
      setExistingPortals(data);
    }
    setLoadingPortals(false);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput === ADMIN_CODE) {
      setIsAuthorized(true);
      sessionStorage.setItem('portal-admin-auth', 'true');
      setError('');
    } else {
      setError('Invalid code');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Validate required fields
      if (!form.name || !form.portalUsername || !form.walletAddress || form.lat === null || form.lng === null) {
        throw new Error('Portal Keeper, name, and location are required');
      }

      const portalData = {
        id: uuidv4(),
        content_type: 'portal',
        title: form.name,
        artist: form.name, // Use name as artist too for consistency
        description: form.description || null,
        cover_image_url: form.imageUrl || null,
        portal_username: form.portalUsername,
        primary_uploader_wallet: form.walletAddress,  // Ties ownership to the Portal Keeper
        primary_location: form.location || null,
        location_lat: form.lat,
        location_lng: form.lng,
      };

      const { data, error } = await supabase
        .from('ip_tracks')
        .insert(portalData)
        .select()
        .single();

      if (error) throw error;

      // Generate thumbnails if we have an image
      if (data && form.imageUrl) {
        try {
          await fetch('/api/tracks/generate-thumbnails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trackId: data.id,
              coverImageUrl: form.imageUrl
            })
          });
          console.log('✅ Thumbnails generated for portal');
        } catch (thumbError) {
          console.warn('Thumbnail generation failed (non-critical):', thumbError);
        }
      }

      setSubmitStatus({ type: 'success', message: `Portal "${form.name}" created successfully!` });

      // Reset form
      setForm({
        name: '',
        description: '',
        imageUrl: '',
        portalUsername: '',
        walletAddress: '',
        location: '',
        lat: null,
        lng: null,
      });
      setUserSearchQuery('');

      // Reload portals list
      loadExistingPortals();

    } catch (err: any) {
      setSubmitStatus({ type: 'error', message: err.message || 'Failed to create portal' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (portalId: string, portalName: string) => {
    if (!confirm(`Delete portal "${portalName}"? This cannot be undone.`)) return;

    const { error } = await supabase
      .from('ip_tracks')
      .delete()
      .eq('id', portalId);

    if (error) {
      alert('Failed to delete: ' + error.message);
    } else {
      loadExistingPortals();
    }
  };

  // Authorization screen
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-8">
        <form onSubmit={handleCodeSubmit} className="bg-slate-900 rounded-xl p-8 max-w-md w-full">
          <h1 className="text-xl font-bold text-white mb-4">Admin Access</h1>
          <input
            type="password"
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            placeholder="Enter admin code"
            className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            className="w-full bg-[#81E4F2] text-slate-900 font-bold py-3 rounded-lg hover:bg-[#6BC4D2] transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    );
  }

  // Admin panel
  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Portal Admin</h1>
        <p className="text-gray-400 mb-8">Create and manage Portal Keeper cards</p>

        {/* Create Form */}
        <div className="bg-slate-900 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Create New Portal</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Portal Keeper Search */}
            <div className="relative">
              <label className="block text-gray-400 text-sm mb-1">Portal Keeper (search by name) *</label>
              <input
                type="text"
                value={userSearchQuery}
                onChange={(e) => {
                  handleUserSearch(e.target.value);
                  setShowUserSuggestions(true);
                }}
                onFocus={() => setShowUserSuggestions(true)}
                onBlur={() => setTimeout(() => setShowUserSuggestions(false), 200)}
                placeholder="Start typing a user's name..."
                className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
              />

              {/* User suggestions dropdown */}
              {showUserSuggestions && userSearchResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {userSearchResults.map((user) => (
                    <button
                      key={user.walletAddress}
                      type="button"
                      onClick={() => handleUserSelect(user)}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 transition-colors flex items-center gap-3"
                    >
                      {user.avatarUrl && (
                        <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      )}
                      <div>
                        <div className="text-white text-sm font-medium">{user.displayName}</div>
                        <div className="text-gray-400 text-xs">@{user.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {userSearchLoading && (
                <div className="absolute right-3 top-9 text-gray-400 text-xs">Searching...</div>
              )}

              {/* Show selected user info */}
              {form.walletAddress && (
                <p className="text-green-400 text-xs mt-1">
                  Selected: @{form.portalUsername} ({form.walletAddress.slice(0, 8)}...{form.walletAddress.slice(-4)})
                </p>
              )}
            </div>

            {/* Portal Display Name */}
            <div>
              <label className="block text-gray-400 text-sm mb-1">Portal Display Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Felix (can differ from profile name)"
                className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
                required
              />
              <p className="text-gray-500 text-xs mt-1">This is the name shown on the portal card</p>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-1">Description (2 lines max)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g., Dance music curator. EDM.NYC and live streaming."
                className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-1">Profile Image</label>
              <TrackCoverUploader
                walletAddress="admin-portals"
                initialImage={form.imageUrl}
                onImageChange={(url) => setForm({ ...form, imageUrl: url })}
              />
            </div>

            <div className="relative">
              <label className="block text-gray-400 text-sm mb-1">Location *</label>
              <input
                ref={locationInputRef}
                type="text"
                value={form.location}
                onChange={(e) => {
                  setForm({ ...form, location: e.target.value, lat: null, lng: null });
                  handleLocationSearch(e.target.value);
                  setShowLocationSuggestions(true);
                }}
                onFocus={() => setShowLocationSuggestions(true)}
                onBlur={() => {
                  // Delay hiding to allow click on suggestion
                  setTimeout(() => setShowLocationSuggestions(false), 200);
                }}
                placeholder="Start typing a city or place..."
                className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
                required
              />

              {/* Location suggestions dropdown */}
              {showLocationSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {locationSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleLocationSelect(suggestion)}
                      className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 transition-colors text-sm"
                    >
                      {suggestion.place_name}
                    </button>
                  ))}
                </div>
              )}

              {locationLoading && (
                <div className="absolute right-3 top-9 text-gray-400 text-xs">
                  Searching...
                </div>
              )}

              {/* Show selected coordinates */}
              {form.lat !== null && form.lng !== null && (
                <p className="text-green-400 text-xs mt-1">
                  Coordinates: {form.lat.toFixed(4)}, {form.lng.toFixed(4)}
                </p>
              )}
            </div>

            {submitStatus && (
              <div className={`p-3 rounded-lg ${submitStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                {submitStatus.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#81E4F2] text-slate-900 font-bold py-3 rounded-lg hover:bg-[#6BC4D2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Portal'}
            </button>
          </form>
        </div>

        {/* Preview */}
        {(form.name || form.imageUrl) && (
          <div className="bg-slate-900 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Preview</h2>
            <div className="flex justify-center">
              <PortalCard
                portal={{
                  id: 'preview',
                  name: form.name || 'Portal Name',
                  description: form.description || 'Description goes here',
                  imageUrl: form.imageUrl || 'https://via.placeholder.com/200',
                  profileUrl: `/profile/${form.portalUsername || 'username'}`,
                  content_type: 'portal',
                }}
              />
            </div>
          </div>
        )}

        {/* Existing Portals */}
        <div className="bg-slate-900 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Existing Portals</h2>

          {loadingPortals ? (
            <p className="text-gray-400">Loading...</p>
          ) : existingPortals.length === 0 ? (
            <p className="text-gray-400">No portals created yet</p>
          ) : (
            <div className="space-y-4">
              {existingPortals.map((portal) => (
                <div key={portal.id} className="flex items-center justify-between bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-700">
                      {portal.cover_image_url && (
                        <img src={portal.cover_image_url} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{portal.title}</h3>
                      <p className="text-gray-400 text-sm">@{portal.portal_username} • {portal.primary_location}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(portal.id, portal.title)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back link */}
        <div className="text-center mt-8">
          <a href="/" className="text-[#81E4F2] hover:underline text-sm">
            Back to Globe
          </a>
        </div>
      </div>
    </div>
  );
}
