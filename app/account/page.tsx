"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import CertificateViewer from "@/components/account/CertificateViewer";
import IPTrackModal from "@/components/modals/IPTrackModal";
import TrackDetailsModal from "@/components/modals/TrackDetailsModal";
import EditOptionsModal from "@/components/modals/EditOptionsModal";
import InfoIcon from "@/components/shared/InfoIcon";

type Tab = "uploads" | "history" | "settings";

interface Track {
  id: string;
  title: string;
  artist: string;
  cover_image_url: string;
  audio_url?: string;
  content_type: string;
  price_stx: number;
  bpm?: number;
  key?: string;
  created_at: string;
  primary_uploader_wallet: string;
  is_deleted: boolean;
  generation?: number;
  remix_depth?: number;
  allow_downloads?: boolean;
  download_price_stx?: number;
}

interface ContentFilter {
  type: 'all' | 'full_song' | 'loop' | 'loop_pack' | 'ep' | 'hidden';
}

export default function AccountPage() {
  const router = useRouter();
  const { isAuthenticated, walletAddress } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("uploads");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [activeFilter, setActiveFilter] = useState<ContentFilter>({ type: 'all' });
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Fetch user's tracks function
  const fetchTracks = async () => {
    if (!walletAddress) {
      console.log('[Account] No wallet address yet');
      return;
    }

    console.log('[Account] Fetching tracks for wallet:', walletAddress);
    setLoading(true);

    const { data, error } = await supabase
      .from("ip_tracks")
      .select("*")
      .eq("primary_uploader_wallet", walletAddress)
      .order("created_at", { ascending: false });

    console.log('[Account] Query result:', { data, error, count: data?.length });

    if (error) {
      console.error('[Account] Error fetching tracks:', error);
    } else if (data) {
      setTracks(data);
    }
    setLoading(false);
  };

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!walletAddress) return;

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('display_name, username, avatar_url')
          .eq('wallet_address', walletAddress)
          .single();

        if (!profileError && profileData) {
          // Set display name
          if (profileData.display_name && profileData.display_name !== 'New User') {
            setDisplayName(profileData.display_name);
          } else if (profileData.username) {
            setDisplayName(profileData.username);
          } else {
            setDisplayName(walletAddress.slice(0, 8) + '...');
          }

          // Set profile image
          if (profileData.avatar_url) {
            setProfileImage(profileData.avatar_url);
          }
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };

    fetchProfile();
  }, [walletAddress]);

  // Fetch tracks on mount
  useEffect(() => {
    if (walletAddress) {
      fetchTracks();
    }
  }, [walletAddress]);

  // Filter tracks based on active filter
  useEffect(() => {
    let filtered = tracks;

    switch (activeFilter.type) {
      case 'full_song':
        filtered = tracks.filter(track => track.content_type === 'full_song' && !track.is_deleted);
        break;
      case 'loop':
        filtered = tracks.filter(track => track.content_type === 'loop' && !track.is_deleted);
        break;
      case 'loop_pack':
        filtered = tracks.filter(track => track.content_type === 'loop_pack' && !track.is_deleted);
        break;
      case 'ep':
        filtered = tracks.filter(track => track.content_type === 'ep' && !track.is_deleted);
        break;
      case 'hidden':
        filtered = tracks.filter(track => track.is_deleted === true);
        break;
      case 'all':
      default:
        filtered = tracks.filter(track => !track.is_deleted);
        break;
    }

    setFilteredTracks(filtered);
  }, [tracks, activeFilter]);

  // Get count for each filter
  const getFilterCount = (filter: ContentFilter) => {
    switch (filter.type) {
      case 'all':
        return tracks.filter(track => !track.is_deleted).length;
      case 'full_song':
        return tracks.filter(track => track.content_type === 'full_song' && !track.is_deleted).length;
      case 'loop':
        return tracks.filter(track => track.content_type === 'loop' && !track.is_deleted).length;
      case 'loop_pack':
        return tracks.filter(track => track.content_type === 'loop_pack' && !track.is_deleted).length;
      case 'ep':
        return tracks.filter(track => track.content_type === 'ep' && !track.is_deleted).length;
      case 'hidden':
        return tracks.filter(track => track.is_deleted === true).length;
      default:
        return 0;
    }
  };

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-6">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-[#81E4F2] bg-slate-800">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={displayName || 'User'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('Failed to load profile image');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#81E4F2] text-2xl font-semibold">
                  {displayName ? displayName.charAt(0).toUpperCase() : walletAddress ? walletAddress.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
            </div>

            <div>
              <h1 className="text-4xl font-bold">
                <span className="bg-gradient-to-r from-[#a3f3ff] to-[#81E4F2] bg-clip-text text-transparent">
                  Account Page
                </span>
              </h1>
              <p className="text-gray-400 mt-1">Manage your uploads, certificates, and settings</p>
            </div>
          </div>

          {/* Content Filters */}
          <div className="mb-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setActiveFilter({ type: 'all' })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter.type === 'all'
                    ? 'bg-[#81E4F2] text-slate-900 font-medium'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                All ({getFilterCount({ type: 'all' })})
              </button>

              <button
                onClick={() => setActiveFilter({ type: 'full_song' })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter.type === 'full_song'
                    ? 'bg-[#81E4F2] text-slate-900 font-medium'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                Songs ({getFilterCount({ type: 'full_song' })})
              </button>

              <button
                onClick={() => setActiveFilter({ type: 'loop' })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter.type === 'loop'
                    ? 'bg-[#81E4F2] text-slate-900 font-medium'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                Loops ({getFilterCount({ type: 'loop' })})
              </button>

              <button
                onClick={() => setActiveFilter({ type: 'loop_pack' })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter.type === 'loop_pack'
                    ? 'bg-[#81E4F2] text-slate-900 font-medium'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                Loop Packs ({getFilterCount({ type: 'loop_pack' })})
              </button>

              <button
                onClick={() => setActiveFilter({ type: 'ep' })}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeFilter.type === 'ep'
                    ? 'bg-[#81E4F2] text-slate-900 font-medium'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                EPs ({getFilterCount({ type: 'ep' })})
              </button>

              <button
                onClick={() => setActiveFilter({ type: 'hidden' })}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  activeFilter.type === 'hidden'
                    ? 'bg-[#81E4F2] text-slate-900 font-medium'
                    : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
                }`}
              >
                <span>👁️‍🗨️</span>
                Hidden ({getFilterCount({ type: 'hidden' })})
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-[#1E293B] mb-8">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("uploads")}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === "uploads"
                    ? "text-[#81E4F2]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                My Uploads
                {activeTab === "uploads" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#81E4F2]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === "history"
                    ? "text-[#81E4F2]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Upload History
                {activeTab === "history" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#81E4F2]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === "settings"
                    ? "text-[#81E4F2]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Settings
                {activeTab === "settings" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#81E4F2]" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2]"></div>
            </div>
          ) : (
            <>
              {activeTab === "uploads" && (
                <MyUploadsTab tracks={filteredTracks} onRefresh={fetchTracks} />
              )}
              {activeTab === "history" && (
                <UploadHistoryTab tracks={filteredTracks} onViewCertificate={setSelectedTrack} />
              )}
              {activeTab === "settings" && (
                <SettingsTab />
              )}
            </>
          )}
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {selectedTrack && (
        <CertificateViewer
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
        />
      )}
    </>
  );
}

// Tab Components (placeholder implementations)
function MyUploadsTab({ tracks, onRefresh }: { tracks: Track[]; onRefresh: () => void }) {
  // Tracks are already filtered by parent component based on active filter
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [detailsTrack, setDetailsTrack] = useState<Track | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const handleEditClick = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTrack(track);
    setIsOptionsModalOpen(true);
  };

  const handleOpenEditModal = () => {
    setIsOptionsModalOpen(false);
    setIsEditModalOpen(true);
  };

  const handleEditComplete = () => {
    setIsEditModalOpen(false);
    setEditingTrack(null);
    onRefresh();
  };

  const handleInfoClick = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailsTrack(track);
    setIsDetailsModalOpen(true);
  };

  const handlePlayClick = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();

    if (playingTrackId === track.id) {
      // Pause current track
      audioElement?.pause();
      setPlayingTrackId(null);
    } else {
      // Stop previous track if any
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      // Play new track
      const audio = new Audio(track.audio_url);
      audio.play();
      setAudioElement(audio);
      setPlayingTrackId(track.id);

      // Auto-stop after 20 seconds
      setTimeout(() => {
        audio.pause();
        setPlayingTrackId(null);
      }, 20000);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause();
      }
    };
  }, [audioElement]);

  // Get border color based on content type
  const getBorderColor = (track: Track) => {
    if (track.content_type === 'full_song') return 'border-[#FFE4B5]';
    if (track.content_type === 'ep') return 'border-[#FFE4B5]';
    if (track.content_type === 'loop') return 'border-[#9772F4]';
    if (track.content_type === 'loop_pack') return 'border-[#9772F4]';
    return 'border-[#9772F4]';
  };

  // Get border thickness - thicker for multi-content (loop packs and EPs)
  const getBorderThickness = (track: Track) => {
    return (track.content_type === 'loop_pack' || track.content_type === 'ep') ? 'border-4' : 'border-2';
  };

  return (
    <>
      <div>
        <div className="mb-6 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {tracks.length} {tracks.length === 1 ? 'upload' : 'uploads'}
          </div>
        </div>

        {tracks.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-gray-500 mb-4">No uploads yet</div>
            <p className="text-gray-600 text-sm">
              Upload your first track to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="group cursor-pointer"
              >
                <div className={`relative aspect-square rounded-lg overflow-hidden ${getBorderColor(track)} ${getBorderThickness(track)} mb-2`}>
                  <img
                    src={track.cover_image_url}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />

                  {/* Hover Overlay - Exact same pattern as store cards */}
                  <div className="hover-overlay absolute inset-0 bg-black bg-opacity-90 p-2 animate-fadeIn opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Top Section: Title, Artist (full width) */}
                    <div className="absolute top-1 left-2 right-2">
                      <div className="flex flex-col">
                        <h3 className="font-medium text-white text-sm leading-tight truncate">
                          {track.title}
                        </h3>
                        <p className="text-white/80 text-xs truncate">
                          {track.artist}
                        </p>
                      </div>
                    </div>

                    {/* Info Icon - Left side, vertically centered */}
                    <div className="absolute left-1 top-1/2 transform -translate-y-1/2 z-10">
                      <InfoIcon
                        size="lg"
                        onClick={(e) => handleInfoClick(track, e)}
                        title="View details"
                        className="text-white hover:text-white"
                      />
                    </div>

                    {/* Edit Button - Top Right Corner (same position as trash can in store) */}
                    <button
                      onClick={(e) => handleEditClick(track, e)}
                      title="Edit track"
                      className="absolute top-1 right-1 w-9 h-9 bg-black/90 hover:bg-[#81E4F2]/30 rounded flex items-center justify-center transition-all border border-[#81E4F2]/60 hover:border-[#81E4F2] group z-20"
                    >
                      <svg className="w-5 h-5 text-[#81E4F2] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Center: Play Button - Absolutely centered */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                      {track.audio_url && (
                        <button
                          onClick={(e) => handlePlayClick(track, e)}
                          className="transition-all hover:scale-110"
                        >
                          {playingTrackId === track.id ? (
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                            </svg>
                          ) : (
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Bottom Section: M Badge/Price, Content Type, BPM */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                      {/* M Badge or Price (left) */}
                      {(() => {
                        // For loops: show M if remix-only, otherwise show download price
                        if (track.content_type === 'loop' || track.content_type === 'loop_pack') {
                          if (track.allow_downloads === false) {
                            // Remix-only
                            return (
                              <div
                                className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs"
                                title="Platform remix only - 1 STX per recorded remix"
                              >
                                M
                              </div>
                            );
                          } else if (track.download_price_stx) {
                            // Has download price
                            return (
                              <div className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs">
                                {track.download_price_stx}
                              </div>
                            );
                          } else if (track.price_stx) {
                            // Legacy price field
                            return (
                              <div className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs">
                                {track.price_stx}
                              </div>
                            );
                          }
                        }
                        // For songs/EPs: show download price if available
                        else if (track.content_type === 'full_song' || track.content_type === 'ep') {
                          if (track.download_price_stx) {
                            return (
                              <div className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs">
                                {track.download_price_stx}
                              </div>
                            );
                          } else if (track.price_stx) {
                            return (
                              <div className="bg-accent text-slate-900 font-bold py-0.5 px-2 rounded text-xs">
                                {track.price_stx}
                              </div>
                            );
                          }
                        }
                        return null;
                      })()}

                      {/* Content Type Badge (center) with generation indicators */}
                      <span className="text-xs font-mono font-medium text-white">
                        {track.content_type === 'ep' && 'EP'}
                        {track.content_type === 'loop_pack' && 'PACK'}
                        {track.content_type === 'loop' && (
                          <>
                            {track.generation === 0 || track.remix_depth === 0 ? (
                              '🌱 LOOP'
                            ) : track.generation === 1 || track.remix_depth === 1 ? (
                              '🌿 LOOP'
                            ) : track.generation === 2 || track.remix_depth === 2 ? (
                              '🌳 LOOP'
                            ) : (
                              'LOOP'
                            )}
                          </>
                        )}
                        {track.content_type === 'full_song' && 'SONG'}
                        {!track.content_type && 'TRACK'}
                      </span>

                      {/* BPM Badge (right) */}
                      {track.bpm && track.content_type !== 'ep' ? (
                        <span
                          className="text-sm font-mono font-bold text-white"
                          title="BPM"
                        >
                          {track.bpm}
                        </span>
                      ) : (
                        <div className="w-12"></div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-white truncate">{track.title}</div>
                <div className="text-xs text-gray-400 truncate">{track.artist}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Options Modal */}
      {editingTrack && (
        <EditOptionsModal
          track={editingTrack}
          isOpen={isOptionsModalOpen}
          onClose={() => {
            setIsOptionsModalOpen(false);
            setEditingTrack(null);
          }}
          onEditDetails={handleOpenEditModal}
          onRefresh={onRefresh}
        />
      )}

      {/* Edit Modal */}
      {editingTrack && (
        <IPTrackModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTrack(null);
          }}
          track={editingTrack as any}
          onSave={handleEditComplete}
        />
      )}

      {/* Track Details Modal */}
      {detailsTrack && (
        <TrackDetailsModal
          track={detailsTrack as any}
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setDetailsTrack(null);
          }}
        />
      )}
    </>
  );
}

function UploadHistoryTab({ tracks, onViewCertificate }: { tracks: Track[]; onViewCertificate: (track: Track) => void }) {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const handlePlayPause = (track: Track) => {
    if (playingTrackId === track.id) {
      // Pause current track
      audioElement?.pause();
      setPlayingTrackId(null);
    } else {
      // Stop previous track if any
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      // Play new track
      const audio = new Audio(track.audio_url);
      audio.play();
      setAudioElement(audio);
      setPlayingTrackId(track.id);

      // Handle track ending
      audio.onended = () => {
        setPlayingTrackId(null);
      };
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-gray-400">
          Complete upload history with certificate data
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-gray-500">No upload history</div>
        </div>
      ) : (
        <div className="space-y-3">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-4 p-4 bg-[#101726] border border-[#1E293B] rounded-lg hover:border-[#81E4F2]/30 transition-colors"
            >
              {/* Thumbnail with play button */}
              <div className="relative group">
                <img
                  src={track.cover_image_url}
                  alt={track.title}
                  className="w-16 h-16 rounded object-cover"
                />
                <button
                  onClick={() => handlePlayPause(track)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                >
                  {playingTrackId === track.id ? (
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{track.title}</div>
                <div className="text-sm text-gray-400 truncate">{track.artist}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(track.created_at).toLocaleDateString()} • {track.content_type}
                </div>
              </div>
              <button
                onClick={() => onViewCertificate(track)}
                className="px-4 py-2 text-sm text-[#81E4F2] hover:text-white border border-[#81E4F2]/30 hover:border-[#81E4F2] rounded-md transition-colors"
              >
                View Certificate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  return (
    <div>
      <div className="max-w-2xl space-y-6">
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Profile Settings</h3>
          <p className="text-gray-400 text-sm">
            Edit your profile information, avatar, and bio from your{" "}
            <a href="#" className="text-[#81E4F2] hover:underline">
              profile page
            </a>
          </p>
        </div>

        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Wallet Settings</h3>
          <p className="text-gray-400 text-sm mb-4">
            Your connected wallet is used for all transactions and as your identity on mixmi.
          </p>
          <div className="text-xs text-gray-500 font-mono">
            Connected: Connected wallet address will appear here
          </div>
        </div>

        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Privacy</h3>
          <p className="text-gray-400 text-sm">
            Privacy settings coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}
