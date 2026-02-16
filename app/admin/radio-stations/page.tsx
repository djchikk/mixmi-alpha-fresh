"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Radio, Plus, Pencil, Eye, EyeOff, Trash2, ExternalLink } from 'lucide-react';
import RadioStationModal from '@/components/modals/RadioStationModal';

const ADMIN_CODE = 'mixmi-radio-admin-2024';

interface RadioStation {
  id: string;
  title: string;
  description: string;
  stream_url: string;
  metadata_api_url: string | null;
  cover_image_url: string | null;
  content_type: string;
  primary_location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  tags: string[];
  notes: string | null;
  primary_uploader_wallet: string;
  pack_id: string | null;
  pack_position: number | null;
  created_at: string;
  deleted_at: string | null;
  is_live: boolean;
}

export default function AdminRadioStationsPage() {
  // Auth
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [authError, setAuthError] = useState('');

  // Data
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingStation, setEditingStation] = useState<RadioStation | null>(null);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Check sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('radio-admin-auth');
    if (stored === 'true') {
      setIsAuthorized(true);
    }
  }, []);

  // Load stations when authorized
  useEffect(() => {
    if (isAuthorized) {
      loadStations();
    }
  }, [isAuthorized]);

  const loadStations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ip_tracks')
      .select('*')
      .in('content_type', ['radio_station', 'station_pack'])
      .order('created_at', { ascending: false });

    if (data && !error) {
      setStations(data);
    } else if (error) {
      console.error('Error loading stations:', error);
    }
    setLoading(false);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput === ADMIN_CODE) {
      setIsAuthorized(true);
      sessionStorage.setItem('radio-admin-auth', 'true');
      setAuthError('');
    } else {
      setAuthError('Invalid code');
    }
  };

  const handleHide = async (stationId: string) => {
    const { error } = await supabase
      .from('ip_tracks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', stationId);

    if (error) {
      alert('Failed to hide: ' + error.message);
    } else {
      loadStations();
    }
  };

  const handleShow = async (stationId: string) => {
    const { error } = await supabase
      .from('ip_tracks')
      .update({ deleted_at: null })
      .eq('id', stationId);

    if (error) {
      alert('Failed to show: ' + error.message);
    } else {
      loadStations();
    }
  };

  const handleDelete = async (stationId: string) => {
    // If it's a pack, also delete child stations
    const station = stations.find(s => s.id === stationId);

    if (station?.content_type === 'station_pack') {
      // Delete children first
      const { error: childError } = await supabase
        .from('ip_tracks')
        .delete()
        .eq('pack_id', stationId);

      if (childError) {
        alert('Failed to delete pack children: ' + childError.message);
        return;
      }
    }

    const { error } = await supabase
      .from('ip_tracks')
      .delete()
      .eq('id', stationId);

    if (error) {
      alert('Failed to delete: ' + error.message);
    } else {
      setDeleteConfirm(null);
      loadStations();
    }
  };

  const handleEdit = (station: RadioStation) => {
    setEditingStation(station);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingStation(null);
  };

  const handleModalComplete = () => {
    handleModalClose();
    loadStations();
  };

  // Separate containers (packs) from standalone stations
  const containers = stations.filter(s =>
    s.content_type === 'station_pack' ||
    (s.content_type === 'radio_station' && !s.pack_id)
  );

  const getPackChildren = (packId: string) =>
    stations.filter(s => s.pack_id === packId && s.id !== packId);

  // Access code gate
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="bg-[#0f1419] rounded-xl p-8 w-full max-w-md border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-[#FFC044]/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-[#FFC044]" />
            </div>
            <h1 className="text-xl font-bold text-white">Radio Station Admin</h1>
          </div>

          <form onSubmit={handleCodeSubmit}>
            <input
              type="password"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="Enter admin code"
              className="w-full px-4 py-3 bg-[#0a0e1a] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFC044] mb-4"
              autoFocus
            />
            <button
              type="submit"
              className="w-full px-4 py-3 bg-[#FFC044] text-[#0a0e1a] font-semibold rounded-lg hover:bg-[#FFC044]/90 transition-colors"
            >
              Enter
            </button>
            {authError && <p className="text-red-400 text-sm mt-2 text-center">{authError}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      {/* Header */}
      <div className="bg-[#0f1419] border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFC044]/20 flex items-center justify-center">
              <Radio className="w-5 h-5 text-[#FFC044]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Radio Station Admin</h1>
              <p className="text-sm text-gray-400">{containers.length} station{containers.length !== 1 ? 's' : ''} / packs</p>
            </div>
          </div>

          <button
            onClick={() => { setEditingStation(null); setShowModal(true); }}
            className="px-4 py-2 bg-[#FFC044] text-[#0a0e1a] font-semibold rounded-lg hover:bg-[#FFC044]/90 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Add Station
          </button>
        </div>
      </div>

      {/* Station List */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFC044] mx-auto mb-4"></div>
            <p className="text-gray-400">Loading stations...</p>
          </div>
        ) : containers.length === 0 ? (
          <div className="text-center py-12">
            <Radio className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No radio stations yet</p>
            <p className="text-gray-500 text-sm">Click "Add Station" to create your first one</p>
          </div>
        ) : (
          <div className="space-y-4">
            {containers.map(station => {
              const isHidden = !!station.deleted_at;
              const isPack = station.content_type === 'station_pack';
              const children = isPack ? getPackChildren(station.id) : [];

              return (
                <div
                  key={station.id}
                  className={`bg-[#0f1419] rounded-xl border ${isHidden ? 'border-red-500/30 opacity-60' : 'border-white/10'} overflow-hidden`}
                >
                  {/* Station row */}
                  <div className="flex items-center gap-4 p-4">
                    {/* Cover image */}
                    <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#1a2332]">
                      {station.cover_image_url ? (
                        <img
                          src={station.cover_image_url}
                          alt={station.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Radio className="w-6 h-6 text-[#FFC044]/50" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-semibold truncate">{station.title}</h3>
                        {isPack && (
                          <span className="px-2 py-0.5 bg-[#FFC044]/20 text-[#FFC044] text-xs rounded-full flex-shrink-0">
                            Pack ({children.length} stations)
                          </span>
                        )}
                        {isHidden && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full flex-shrink-0">
                            Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm truncate">{station.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {station.primary_location && (
                          <span className="text-gray-500 text-xs">{station.primary_location}</span>
                        )}
                        {station.stream_url && !isPack && (
                          <a
                            href={station.stream_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#FFC044]/60 hover:text-[#FFC044] text-xs flex items-center gap-1"
                          >
                            <ExternalLink size={10} />
                            Stream
                          </a>
                        )}
                        <span className="text-gray-600 text-xs">
                          {new Date(station.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleEdit(station)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>

                      {isHidden ? (
                        <button
                          onClick={() => handleShow(station.id)}
                          className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                          title="Show on globe"
                        >
                          <Eye size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleHide(station.id)}
                          className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                          title="Hide from globe"
                        >
                          <EyeOff size={16} />
                        </button>
                      )}

                      {deleteConfirm === station.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(station.id)}
                            className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 text-xs bg-white/5 text-gray-400 hover:bg-white/10 rounded transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(station.id)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Pack children */}
                  {isPack && children.length > 0 && (
                    <div className="border-t border-white/5 bg-[#0a0e1a]/50">
                      {children.map((child, idx) => (
                        <div
                          key={child.id}
                          className="flex items-center gap-3 px-4 py-2 pl-20 border-b border-white/5 last:border-b-0"
                        >
                          <span className="text-[#FFC044]/40 text-xs w-5">{idx + 1}.</span>
                          <span className="text-gray-300 text-sm flex-1 truncate">{child.title}</span>
                          {child.stream_url && (
                            <a
                              href={child.stream_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#FFC044]/40 hover:text-[#FFC044] text-xs flex items-center gap-1"
                            >
                              <ExternalLink size={10} />
                            </a>
                          )}
                          <button
                            onClick={() => handleEdit(child)}
                            className="p-1 text-gray-500 hover:text-white transition-colors"
                            title="Edit station"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RadioStationModal — reused as-is */}
      <RadioStationModal
        isOpen={showModal}
        onClose={handleModalClose}
        onUploadComplete={handleModalComplete}
        track={editingStation}
        onSave={handleModalComplete}
      />
    </div>
  );
}
