"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import PortalCard from '@/components/cards/PortalCard';

// Simple access code - change this to something only you know
const ADMIN_CODE = 'mixmi-portal-admin-2024';

interface PortalForm {
  name: string;
  description: string;
  imageUrl: string;
  portalUsername: string;
  location: string;
  lat: string;
  lng: string;
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
    location: '',
    lat: '',
    lng: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
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
      if (!form.name || !form.portalUsername || !form.lat || !form.lng) {
        throw new Error('Name, username, and coordinates are required');
      }

      const portalData = {
        content_type: 'portal',
        title: form.name,
        artist: form.name, // Use name as artist too for consistency
        description: form.description || null,
        cover_image_url: form.imageUrl || null,
        portal_username: form.portalUsername,
        primary_location: form.location || null,
        location_lat: parseFloat(form.lat),
        location_lng: parseFloat(form.lng),
        // Set some defaults
        allow_downloads: false,
        allow_streaming: false,
        allow_remixing: false,
        visible: true,
      };

      const { data, error } = await supabase
        .from('ip_tracks')
        .insert(portalData)
        .select()
        .single();

      if (error) throw error;

      setSubmitStatus({ type: 'success', message: `Portal "${form.name}" created successfully!` });

      // Reset form
      setForm({
        name: '',
        description: '',
        imageUrl: '',
        portalUsername: '',
        location: '',
        lat: '',
        lng: '',
      });

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Portal Keeper Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Felix"
                  className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Profile Username *</label>
                <input
                  type="text"
                  value={form.portalUsername}
                  onChange={(e) => setForm({ ...form, portalUsername: e.target.value })}
                  placeholder="e.g., felix (from /profile/felix)"
                  className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
                  required
                />
              </div>
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
              <label className="block text-gray-400 text-sm mb-1">Profile Image URL</label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="https://..."
                className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-1">Location Name</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g., New York City"
                  className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Latitude *</label>
                <input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  placeholder="e.g., 40.7128"
                  className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Longitude *</label>
                <input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  placeholder="e.g., -74.0060"
                  className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#81E4F2]"
                  required
                />
              </div>
            </div>

            <p className="text-gray-500 text-xs">
              Tip: Get coordinates from Google Maps - right-click any location and copy the lat/lng
            </p>

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
