"use client";

import { useState, useEffect } from "react";
import { useAuth, Persona } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import CertificateViewer from "@/components/account/CertificateViewer";
import IPTrackModal from "@/components/modals/IPTrackModal";
import RadioStationModal from "@/components/modals/RadioStationModal";
import TrackDetailsModal from "@/components/modals/TrackDetailsModal";
import EditOptionsModal from "@/components/modals/EditOptionsModal";
import ContentTypeSelector from "@/components/modals/ContentTypeSelector";
import InfoIcon from "@/components/shared/InfoIcon";
import CompactTrackCardWithFlip from "@/components/cards/CompactTrackCardWithFlip";
import ProfileImageModal from "@/components/profile/ProfileImageModal";
import ProfileInfoModal from "@/components/profile/ProfileInfoModal";
import { Plus, ChevronDown, ChevronUp, Pencil, ExternalLink, Image, Check, Star } from 'lucide-react';
import AgentVibeMatcher from '@/components/agent/AgentVibeMatcher';
import { Track } from '@/components/mixer/types';
import { useMixer } from '@/contexts/MixerContext';
import Crate from '@/components/shared/Crate';
import { PRICING } from '@/config/pricing';
import { generateAvatar } from '@/lib/avatarUtils';
import AddPersonaModal from '@/components/modals/AddPersonaModal';

type Tab = "uploads" | "library" | "history" | "settings";

interface Track {
  id: string;
  title: string;
  artist: string;
  cover_image_url: string;
  audio_url?: string;
  stream_url?: string;
  video_url?: string;
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
  pack_id?: string;
  pack_position?: number;
}

interface ContentFilter {
  type: 'all' | 'full_song' | 'loop' | 'loop_pack' | 'ep' | 'radio_station' | 'station_pack' | 'video_clip' | 'hidden';
}

export default function AccountPage() {
  const router = useRouter();
  const { isAuthenticated, walletAddress, suiAddress, personas, activePersona, setActivePersona, refreshPersonas } = useAuth();

  // For data lookup, use persona's wallet if available, otherwise use direct wallet
  // This allows zkLogin users to access data from their linked wallet
  const effectiveWallet = activePersona?.wallet_address || walletAddress;

  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [activeFilter, setActiveFilter] = useState<ContentFilter>({ type: 'all' });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileThumb96Url, setProfileThumb96Url] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

  // Upload modal states (separate from editing modals)
  const [isContentTypeSelectorOpen, setIsContentTypeSelectorOpen] = useState(false);
  const [isMusicUploadModalOpen, setIsMusicUploadModalOpen] = useState(false);
  const [isRadioUploadModalOpen, setIsRadioUploadModalOpen] = useState(false);
  const [isVideoUploadModalOpen, setIsVideoUploadModalOpen] = useState(false);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Fetch user's tracks function
  const fetchTracks = async () => {
    if (!effectiveWallet) {
      console.log('[Account] No effective wallet address yet');
      return;
    }

    console.log('[Account] Fetching tracks for wallet:', effectiveWallet);
    setLoading(true);

    const { data, error } = await supabase
      .from("ip_tracks")
      .select("*")
      .eq("primary_uploader_wallet", effectiveWallet)
      .order("created_at", { ascending: false });

    console.log('[Account] Query result:', { data, error, count: data?.length });

    if (error) {
      console.error('[Account] Error fetching tracks:', error);
    } else if (data) {
      setTracks(data);
    }
    setLoading(false);
  };

  // Fetch profile data - use persona data if available, otherwise from wallet profile
  useEffect(() => {
    const fetchProfile = async () => {
      // If we have an active persona, use its data directly
      if (activePersona) {
        if (activePersona.display_name && activePersona.display_name !== 'New User') {
          setDisplayName(activePersona.display_name);
        } else {
          setDisplayName(activePersona.username);
        }
        if (activePersona.avatar_url) {
          setProfileImage(activePersona.avatar_url);
          setProfileThumb96Url(null); // Personas don't have thumbnails yet
        }
        return;
      }

      // Fall back to profile data from wallet
      if (!effectiveWallet) return;

      try {
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('display_name, username, avatar_url, avatar_thumb_96_url')
          .eq('wallet_address', effectiveWallet)
          .single();

        if (!profileError && profileData) {
          // Set display name
          if (profileData.display_name && profileData.display_name !== 'New User') {
            setDisplayName(profileData.display_name);
          } else if (profileData.username) {
            setDisplayName(profileData.username);
          } else {
            setDisplayName(effectiveWallet.slice(0, 8) + '...');
          }

          // Set profile image (with thumbnail for small displays)
          if (profileData.avatar_url) {
            setProfileImage(profileData.avatar_url);
            setProfileThumb96Url(profileData.avatar_thumb_96_url || null);
          }
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };

    fetchProfile();
  }, [effectiveWallet, activePersona]);

  // Fetch tracks on mount and when effective wallet changes
  useEffect(() => {
    if (effectiveWallet) {
      fetchTracks();
    }
  }, [effectiveWallet]);

  // Helper: Check if a track is a child item inside a pack/EP (should be hidden from dashboard)
  // Child items have pack_id AND pack_position >= 1
  // Container items (packs/EPs) have pack_position = 0 or null
  const isChildItem = (track: Track) => {
    return track.pack_id && track.pack_position !== undefined && track.pack_position >= 1;
  };

  // Filter tracks based on active filter
  // IMPORTANT: Always hide child items (loops/songs inside packs/EPs) - only show containers
  useEffect(() => {
    let filtered = tracks;

    switch (activeFilter.type) {
      case 'full_song':
        // Show standalone songs only, not songs inside EPs
        filtered = tracks.filter(track => track.content_type === 'full_song' && !track.is_deleted && !isChildItem(track));
        break;
      case 'loop':
        // Show standalone loops only, not loops inside loop packs
        filtered = tracks.filter(track => track.content_type === 'loop' && !track.is_deleted && !isChildItem(track));
        break;
      case 'loop_pack':
        filtered = tracks.filter(track => track.content_type === 'loop_pack' && !track.is_deleted);
        break;
      case 'ep':
        filtered = tracks.filter(track => track.content_type === 'ep' && !track.is_deleted);
        break;
      case 'radio_station':
        // Show standalone radio stations only, not stations inside station packs
        filtered = tracks.filter(track => track.content_type === 'radio_station' && !track.is_deleted && !isChildItem(track));
        break;
      case 'station_pack':
        filtered = tracks.filter(track => track.content_type === 'station_pack' && !track.is_deleted);
        break;
      case 'video_clip':
        filtered = tracks.filter(track => track.content_type === 'video_clip' && !track.is_deleted);
        break;
      case 'hidden':
        // For hidden, show all deleted items including child items
        filtered = tracks.filter(track => track.is_deleted === true);
        break;
      case 'all':
      default:
        // Show all non-deleted items EXCEPT child items
        filtered = tracks.filter(track => !track.is_deleted && !isChildItem(track));
        break;
    }

    setFilteredTracks(filtered);
  }, [tracks, activeFilter]);

  // Get count for each filter (excluding child items except for hidden)
  const getFilterCount = (filter: ContentFilter) => {
    switch (filter.type) {
      case 'all':
        return tracks.filter(track => !track.is_deleted && !isChildItem(track)).length;
      case 'full_song':
        return tracks.filter(track => track.content_type === 'full_song' && !track.is_deleted && !isChildItem(track)).length;
      case 'loop':
        return tracks.filter(track => track.content_type === 'loop' && !track.is_deleted && !isChildItem(track)).length;
      case 'loop_pack':
        return tracks.filter(track => track.content_type === 'loop_pack' && !track.is_deleted).length;
      case 'ep':
        return tracks.filter(track => track.content_type === 'ep' && !track.is_deleted).length;
      case 'radio_station':
        return tracks.filter(track => track.content_type === 'radio_station' && !track.is_deleted && !isChildItem(track)).length;
      case 'station_pack':
        return tracks.filter(track => track.content_type === 'station_pack' && !track.is_deleted).length;
      case 'video_clip':
        return tracks.filter(track => track.content_type === 'video_clip' && !track.is_deleted).length;
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
            <button
              onClick={() => router.push(`/profile/${activePersona?.username || walletAddress}`)}
              className="w-14 h-14 rounded-lg overflow-hidden border-2 border-[#81E4F2] bg-slate-800 hover:border-[#a3f3ff] transition-colors cursor-pointer"
              title="View your profile"
            >
              {profileImage ? (
                <img
                  src={profileThumb96Url || profileImage}
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
            </button>

            <div>
              <h1 className="text-4xl font-bold">
                <span className="bg-gradient-to-r from-[#a3f3ff] to-[#81E4F2] bg-clip-text text-transparent">
                  Dashboard
                </span>
              </h1>
              <p className="text-gray-400 mt-1">Manage your uploads, certificates, and settings</p>
            </div>
          </div>

          {/* Upload Content Button */}
          <div className="flex justify-start mb-6">
            <button
              onClick={() => setIsContentTypeSelectorOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-[#81E4F2] rounded-lg transition-colors border border-slate-600"
            >
              <Plus size={18} />
              <span>Add</span>
            </button>
          </div>

          {/* Content Filters */}
          <div className="mb-6">
            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${
                activeFilter.type !== 'all'
                  ? 'bg-slate-700 text-white font-medium border-slate-500'
                  : 'bg-slate-800 text-gray-200 hover:bg-slate-700 hover:text-white border-slate-600'
              }`}
            >
              <span>
                {activeFilter.type === 'all'
                  ? `Filter (${getFilterCount({ type: 'all' })})`
                  : `Filtered: ${activeFilter.type === 'full_song' ? 'Songs' :
                      activeFilter.type === 'loop' ? 'Loops' :
                      activeFilter.type === 'loop_pack' ? 'Loop Packs' :
                      activeFilter.type === 'ep' ? 'EPs' :
                      activeFilter.type === 'radio_station' ? 'Radio Stations' :
                      activeFilter.type === 'station_pack' ? 'Station Packs' :
                      activeFilter.type === 'video_clip' ? 'Videos' :
                      activeFilter.type === 'hidden' ? 'Hidden' : 'All'
                    } (${getFilterCount(activeFilter)})`
                }
              </span>
              {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Collapsible Filter Options */}
            {showFilters && (
              <div className="mt-3 flex flex-wrap gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <button
                  onClick={() => { setActiveFilter({ type: 'all' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'all'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  All ({getFilterCount({ type: 'all' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'full_song' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'full_song'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Songs ({getFilterCount({ type: 'full_song' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'loop' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'loop'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Loops ({getFilterCount({ type: 'loop' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'loop_pack' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'loop_pack'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Loop Packs ({getFilterCount({ type: 'loop_pack' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'ep' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'ep'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  EPs ({getFilterCount({ type: 'ep' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'radio_station' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'radio_station'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Radio ({getFilterCount({ type: 'radio_station' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'station_pack' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'station_pack'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Station Packs ({getFilterCount({ type: 'station_pack' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'video_clip' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'video_clip'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Videos ({getFilterCount({ type: 'video_clip' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'hidden' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1 ${
                    activeFilter.type === 'hidden'
                      ? 'bg-[#81E4F2] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  <span>👁️‍🗨️</span>
                  Hidden ({getFilterCount({ type: 'hidden' })})
                </button>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-[#1E293B] mb-8">
            <div className="flex gap-6">
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
              <button
                onClick={() => setActiveTab("uploads")}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === "uploads"
                    ? "text-[#81E4F2]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                My Work
                {activeTab === "uploads" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#81E4F2]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("library")}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === "library"
                    ? "text-[#81E4F2]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Library
                {activeTab === "library" && (
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
            </div>
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2]"></div>
            </div>
          ) : (
            <>
              {activeTab === "settings" && (
                <SettingsTab
                  walletAddress={walletAddress}
                  suiAddress={suiAddress}
                  personas={personas}
                  activePersona={activePersona}
                  setActivePersona={setActivePersona}
                  refreshPersonas={refreshPersonas}
                  onProfileImageUpdate={(url, thumbUrl) => {
                    setProfileImage(url);
                    setProfileThumb96Url(thumbUrl);
                  }}
                />
              )}
              {activeTab === "uploads" && (
                <MyUploadsTab tracks={filteredTracks} onRefresh={fetchTracks} />
              )}
              {activeTab === "library" && (
                <LibraryTab walletAddress={effectiveWallet} />
              )}
              {activeTab === "history" && (
                <UploadHistoryTab tracks={filteredTracks} onViewCertificate={setSelectedTrack} />
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

      {/* Content Type Selector for Upload */}
      <ContentTypeSelector
        isOpen={isContentTypeSelectorOpen}
        onClose={() => setIsContentTypeSelectorOpen(false)}
        onSelectMusic={() => {
          setIsContentTypeSelectorOpen(false);
          setIsMusicUploadModalOpen(true);
        }}
        onSelectRadio={() => {
          setIsContentTypeSelectorOpen(false);
          setIsRadioUploadModalOpen(true);
        }}
        onSelectVideo={() => {
          setIsContentTypeSelectorOpen(false);
          setIsVideoUploadModalOpen(true);
        }}
        onSelectChat={() => {
          setIsContentTypeSelectorOpen(false);
          router.push('/upload-studio');
        }}
      />

      {/* Music Upload Modal */}
      <IPTrackModal
        isOpen={isMusicUploadModalOpen}
        onClose={() => setIsMusicUploadModalOpen(false)}
        onUploadComplete={fetchTracks}
        contentCategory="music"
      />

      {/* Radio Station Upload Modal */}
      <RadioStationModal
        isOpen={isRadioUploadModalOpen}
        onClose={() => setIsRadioUploadModalOpen(false)}
        onUploadComplete={fetchTracks}
      />

      {/* Video Clip Upload Modal */}
      <IPTrackModal
        isOpen={isVideoUploadModalOpen}
        onClose={() => setIsVideoUploadModalOpen(false)}
        onSave={fetchTracks}
        contentCategory="visual"
      />

      {/* Crate - So users can see agent-found tracks */}
      <Crate />
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
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const handleEditClick = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTrack(track);
    setIsOptionsModalOpen(true);
  };

  const handleOpenEditModal = () => {
    setIsOptionsModalOpen(false);
    setIsEditModalOpen(true);
  };

  const handleCancelEdit = () => {
    setIsOptionsModalOpen(false);
    setIsEditModalOpen(false);
    setEditingTrack(null);
  };

  const handleEditComplete = () => {
    setIsEditModalOpen(false);
    setEditingTrack(null);
    setIsOptionsModalOpen(false); // Ensure options modal is also closed
    onRefresh();
  };

  const handleInfoClick = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();
    setDetailsTrack(track);
    setIsDetailsModalOpen(true);
  };

  const handlePlayClick = (track: Track, e: React.MouseEvent) => {
    e.stopPropagation();

    // Handle video clips differently - play inline
    if (track.content_type === 'video_clip' && track.video_url) {
      if (isVideoPlaying && videoElement && playingTrackId === track.id) {
        // Pause video
        videoElement.pause();
        setIsVideoPlaying(false);
        setPlayingTrackId(null);
      } else {
        // Stop any previous video
        if (videoElement) {
          videoElement.pause();
        }
        // Stop any audio
        if (audioElement) {
          audioElement.pause();
        }
        // Play video - will be handled by video element ref
        setIsVideoPlaying(true);
        setPlayingTrackId(track.id);
      }
      return;
    }

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

      // Get audio source - prefer audio_url, fallback to stream_url for radio stations
      const audioSource = track.audio_url || track.stream_url;
      if (!audioSource) return;

      // Play new track
      const audio = new Audio(audioSource);
      const isRadio = track.content_type === 'radio_station' || track.content_type === 'station_pack';

      // Only set crossOrigin for regular tracks, not radio (causes CORS issues)
      if (!isRadio) {
        audio.crossOrigin = 'anonymous';
      }

      audio.play();
      setAudioElement(audio);
      setPlayingTrackId(track.id);

      // 20-second preview timeout for all tracks (including radio stations)
      // Only the Radio Widget should play indefinitely
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

  // Video playback auto-stop after 20 seconds
  useEffect(() => {
    if (isVideoPlaying && videoElement) {
      const timer = setTimeout(() => {
        videoElement.pause();
        setIsVideoPlaying(false);
        setPlayingTrackId(null);
      }, 20000);

      return () => clearTimeout(timer);
    }
  }, [isVideoPlaying, videoElement]);

  // Cleanup video on unmount
  useEffect(() => {
    return () => {
      if (videoElement) {
        videoElement.pause();
      }
    };
  }, [videoElement]);

  // Get border color based on content type
  const getBorderColor = (track: Track) => {
    if (track.content_type === 'full_song') return 'border-[#A8E66B]';
    if (track.content_type === 'ep') return 'border-[#A8E66B]';
    if (track.content_type === 'loop') return 'border-[#A084F9]';
    if (track.content_type === 'loop_pack') return 'border-[#A084F9]';
    if (track.content_type === 'radio_station') return 'border-[#FFC044]';
    if (track.content_type === 'station_pack') return 'border-[#FFC044]';
    if (track.content_type === 'video_clip') return 'border-[#5BB5F9]';
    return 'border-[#A084F9]';
  };

  // Get border thickness - thicker for multi-content (packs and EPs)
  const getBorderThickness = (track: Track) => {
    return (track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') ? 'border-4' : 'border-2';
  };

// Helper functions for Library tab (same as above, extracted for reuse)
const getLibraryBorderColor = (track: Track) => {
  if (track.content_type === 'full_song') return 'border-[#A8E66B]';
  if (track.content_type === 'ep') return 'border-[#A8E66B]';
  if (track.content_type === 'loop') return 'border-[#A084F9]';
  if (track.content_type === 'loop_pack') return 'border-[#A084F9]';
  if (track.content_type === 'radio_station') return 'border-[#FFC044]';
  if (track.content_type === 'station_pack') return 'border-[#FFC044]';
  if (track.content_type === 'video_clip') return 'border-[#5BB5F9]';
  return 'border-[#A084F9]';
};

const getLibraryBorderThickness = (track: Track) => {
  return (track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') ? 'border-4' : 'border-2';
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
              <CompactTrackCardWithFlip
                key={track.id}
                track={track as any}
                isPlaying={playingTrackId === track.id}
                onPlayPreview={(trackId: string, audioUrl?: string) => {
                  // Find the track by ID and call handlePlayClick
                  const foundTrack = tracks.find(t => t.id === trackId);
                  if (foundTrack) {
                    handlePlayClick(foundTrack, { stopPropagation: () => {} } as React.MouseEvent);
                  }
                }}
                onStopPreview={() => {
                  if (audioElement) {
                    audioElement.pause();
                    audioElement.currentTime = 0;
                  }
                  setPlayingTrackId(null);
                }}
                showEditControls={true}
                onEditTrack={(t) => {
                  setEditingTrack(t as any);
                  setIsOptionsModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Options Modal */}
      {editingTrack && (
        <EditOptionsModal
          track={editingTrack}
          isOpen={isOptionsModalOpen}
          onClose={handleCancelEdit}
          onEditDetails={handleOpenEditModal}
          onRefresh={onRefresh}
        />
      )}

      {/* Edit Modal - Conditional based on content type */}
      {editingTrack && (
        <>
          {/* Show RadioStationModal for radio content types */}
          {(editingTrack.content_type === 'radio_station' || editingTrack.content_type === 'station_pack') ? (
            <RadioStationModal
              key={editingTrack.id}
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
                setEditingTrack(null);
              }}
              track={editingTrack as any}
              onSave={handleEditComplete}
            />
          ) : (
            /* Show IPTrackModal for music and video content types */
            <IPTrackModal
              key={editingTrack.id}
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
                setEditingTrack(null);
              }}
              track={editingTrack as any}
              onSave={handleEditComplete}
              contentCategory={editingTrack.content_type === 'video_clip' ? 'visual' : 'music'}
            />
          )}
        </>
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

      // Play new track (support both audio_url and stream_url for radio stations)
      const audioSource = track.audio_url || track.stream_url;
      if (!audioSource) return;

      const audio = new Audio(audioSource);
      const isRadio = track.content_type === 'radio_station' || track.content_type === 'station_pack';

      // Only set crossOrigin for regular tracks, not radio (causes CORS issues)
      if (!isRadio) {
        audio.crossOrigin = 'anonymous';
      }

      audio.play();
      setAudioElement(audio);
      setPlayingTrackId(track.id);

      // 20-second preview timeout for all tracks (including radio stations)
      // Only the Radio Widget should play indefinitely
      setTimeout(() => {
        audio.pause();
        setPlayingTrackId(null);
      }, 20000);

      // Handle track ending (for regular tracks that end naturally)
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

interface Purchase {
  id: string;
  track_id: string;
  buyer_wallet: string;
  seller_wallet: string;
  purchase_price: number;
  purchase_date: string;
  track?: Track;
}

function LibraryTab({ walletAddress }: { walletAddress: string | null }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Helper functions for content-type colored borders
  const getLibraryBorderColor = (track: Track) => {
    switch (track.content_type) {
      case 'loop':
      case 'loop_pack':
        return 'border-[#A084F9]'; // Purple for loops
      case 'full_song':
      case 'ep':
        return 'border-[#FFE4B5]'; // Wheat for songs
      case 'video_clip':
        return 'border-[#5BB5F9]'; // Blue for video
      case 'radio_station':
      case 'station_pack':
        return 'border-[#FB923C]'; // Orange for radio
      default:
        return 'border-slate-600';
    }
  };

  const getLibraryBorderThickness = (track: Track) => {
    return 'border-2';
  };

  useEffect(() => {
    const fetchPurchases = async () => {
      if (!walletAddress) {
        setLoading(false);
        return;
      }

      try {
        // Fetch purchases with track details
        const { data, error } = await supabase
          .from('purchases')
          .select(`
            *,
            track:ip_tracks(*)
          `)
          .eq('buyer_wallet', walletAddress)
          .order('purchase_date', { ascending: false });

        if (error) {
          console.error('Error fetching purchases:', error);
          // Table might not exist yet - that's okay
          setPurchases([]);
        } else if (data) {
          setPurchases(data);
        }
      } catch (error) {
        console.error('Error fetching library:', error);
        setPurchases([]);
      }
      setLoading(false);
    };

    fetchPurchases();
  }, [walletAddress]);

  const handlePlayPause = (track: Track) => {
    if (playingTrackId === track.id) {
      audioElement?.pause();
      setPlayingTrackId(null);
    } else {
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }

      const audioSource = track.audio_url || track.stream_url;
      if (!audioSource) return;

      const audio = new Audio(audioSource);
      audio.play();
      setAudioElement(audio);
      setPlayingTrackId(track.id);

      // 20-second preview
      setTimeout(() => {
        audio.pause();
        setPlayingTrackId(null);
      }, 20000);

      audio.onended = () => setPlayingTrackId(null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2]"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-gray-400">
          Content you've purchased from other creators
        </div>
      </div>

      {purchases.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-gray-500 mb-4">No purchases yet</div>
          <p className="text-gray-600 text-sm">
            Content you purchase from other creators will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {purchases.map((purchase) => {
            const track = purchase.track as Track | undefined;
            if (!track) return null;

            return (
              <div key={purchase.id} className="group cursor-pointer">
                <div className={`relative aspect-square rounded-lg overflow-hidden ${getLibraryBorderColor(track)} ${getLibraryBorderThickness(track)} mb-2`}>
                  <img
                    src={track.cover_image_url}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />

                  {/* Hover Overlay - Same pattern as My Work cards */}
                  <div className="hover-overlay absolute inset-0 bg-black bg-opacity-90 p-2 animate-fadeIn opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Top Section: Title, Artist */}
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

                    {/* Purchased Badge - Top Right Corner */}
                    <div className="absolute top-1 right-1 px-2 py-0.5 bg-green-600/80 rounded text-xs text-white font-medium">
                      Owned
                    </div>

                    {/* Center: Play Button */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                      {(track.audio_url || track.stream_url) && (
                        <button
                          onClick={() => handlePlayPause(track)}
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

                    {/* Bottom Section: Content Type, BPM */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1">
                      {/* Spacer for alignment */}
                      <div className="w-12"></div>

                      {/* Content Type Badge */}
                      <span className="text-xs font-mono font-medium text-white">
                        {track.content_type === 'ep' && 'EP'}
                        {track.content_type === 'loop_pack' && 'PACK'}
                        {track.content_type === 'loop' && 'LOOP'}
                        {track.content_type === 'full_song' && 'SONG'}
                        {track.content_type === 'radio_station' && 'RADIO'}
                        {track.content_type === 'station_pack' && 'PACK'}
                        {track.content_type === 'video_clip' && 'VIDEO'}
                        {!track.content_type && 'TRACK'}
                      </span>

                      {/* BPM Badge */}
                      {track.bpm && track.content_type !== 'ep' && track.content_type !== 'video_clip' ? (
                        <span className="text-sm font-mono font-bold text-white" title="BPM">
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
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsTab({
  walletAddress,
  suiAddress,
  personas,
  activePersona,
  setActivePersona,
  refreshPersonas,
  onProfileImageUpdate
}: {
  walletAddress: string | null;
  suiAddress: string | null;
  personas: Persona[];
  activePersona: Persona | null;
  setActivePersona: (persona: Persona) => void;
  refreshPersonas: () => Promise<void>;
  onProfileImageUpdate?: (url: string | null, thumbUrl: string | null) => void;
}) {
  // For data lookup, use persona's wallet if available, otherwise use direct wallet
  const effectiveWallet = activePersona?.wallet_address || walletAddress;

  const [loading, setLoading] = useState(true);
  const [agentSearching, setAgentSearching] = useState(false);
  const [agentResults, setAgentResults] = useState<{ count: number; message: string } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const mixerContext = useMixer();
  const addTrackToCollection = mixerContext?.addTrackToCollection;
  const router = useRouter();
  const [agentName, setAgentName] = useState('');
  const [profile, setProfile] = useState<{
    username?: string | null;
    bns_name?: string | null;
    display_name?: string | null;
    tagline?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    show_wallet_address?: boolean;
    show_btc_address?: boolean;
  }>({});
  const [links, setLinks] = useState<Array<{ platform: string; url: string }>>([]);

  // Modal states
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isAddPersonaModalOpen, setIsAddPersonaModalOpen] = useState(false);

  // Fetch profile data
  const fetchProfileData = async () => {
    if (!effectiveWallet) return;

    setLoading(true);
    try {
      // Fetch profile using the effective wallet (from persona or direct wallet)
      const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('wallet_address', effectiveWallet)
          .single();

      if (!profileError && profileData) {
        setProfile(profileData);
      }

      // Fetch links
      const { data: linksData, error: linksError } = await supabase
        .from('profile_links')
        .select('platform, url')
        .eq('wallet_address', effectiveWallet);

      if (!linksError && linksData) {
        setLinks(linksData);
      }
    } catch (error) {
      console.error('Error fetching profile data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfileData();
  }, [effectiveWallet]);

  // Load agent name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('agent-name');
    if (savedName) setAgentName(savedName);
  }, []);

  const handleProfileUpdate = async () => {
    await fetchProfileData();
    // Notify parent to update the profile image in the header
    if (onProfileImageUpdate && profile.avatar_url !== undefined) {
      // Re-fetch to get the latest avatar_url and thumbnail
      const { data } = await supabase
        .from('user_profiles')
        .select('avatar_url, avatar_thumb_96_url')
        .eq('wallet_address', effectiveWallet)
        .single();
      if (data) {
        onProfileImageUpdate(data.avatar_url, data.avatar_thumb_96_url);
      }
    }
  };

  // Check if video
  const isVideo = profile.avatar_url && (
    profile.avatar_url.includes('.mp4') ||
    profile.avatar_url.includes('.webm') ||
    profile.avatar_url.includes('video/')
  );

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
        // Clear local storage and redirect to home
        localStorage.removeItem('zklogin_session');
        localStorage.removeItem('sui_address');
        alert('zkLogin disconnected! You will be redirected to sign in again.');
        router.push('/');
        // Force page reload to clear auth state
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
    <div>
      <div className="max-w-2xl space-y-6">
        {/* Profile Settings */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-6">Profile Settings</h3>

          {loading ? (
            <div className="text-gray-400 text-sm">Loading...</div>
          ) : (
            <div className="space-y-8">
              {/* Section 1: Basic Profile Information */}
              <div>
                <h4 className="text-gray-300 text-sm font-medium mb-4">Basic Profile Information</h4>

                <div className="flex gap-6 items-center">
                  {/* Avatar with overlay icon - larger */}
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => setIsImageModalOpen(true)}
                      className="relative w-48 h-48 rounded-2xl overflow-hidden bg-[#1E293B] group cursor-pointer"
                    >
                      {profile.avatar_url ? (
                        <>
                          {isVideo ? (
                            <video
                              src={profile.avatar_url}
                              className="w-full h-full object-cover"
                              autoPlay
                              loop
                              muted
                              playsInline
                            />
                          ) : (
                            <img
                              src={profile.avatar_url}
                              alt="Profile"
                              className="w-full h-full object-cover"
                            />
                          )}
                          {/* Overlay for existing image */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Image className="w-10 h-10 text-white" />
                          </div>
                        </>
                      ) : (
                        /* Empty state with plus */
                        <div className="w-full h-full flex items-center justify-center text-gray-500 group-hover:text-gray-400 transition-colors">
                          <Plus className="w-12 h-12" />
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Profile Info - centered vertically */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    {/* Display Name */}
                    <h2 className="text-xl font-semibold text-white truncate mb-1">
                      {profile.display_name || <span className="text-gray-500 italic font-normal">No display name</span>}
                    </h2>

                    {/* Username */}
                    {profile.username && (
                      <p className="text-[#81E4F2] text-sm mb-2">@{profile.username}</p>
                    )}

                    {/* Tagline */}
                    <p className="text-gray-300 text-sm mb-2">
                      {profile.tagline || <span className="text-gray-500 italic">No tagline</span>}
                    </p>

                    {/* Bio */}
                    <p className="text-gray-400 text-sm whitespace-pre-wrap line-clamp-2">
                      {profile.bio || <span className="text-gray-500 italic">No bio</span>}
                    </p>

                    {/* Social Links */}
                    {links.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {links.map((link, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 bg-[#1E293B] rounded text-gray-400">
                            {link.platform}
                          </span>
                        ))}
                      </div>
                    )}

                    {links.length === 0 && (
                      <p className="text-gray-500 text-xs italic mt-2">No social links added</p>
                    )}
                  </div>

                  {/* Edit button aligned with info */}
                  <div className="flex-shrink-0 self-center">
                    <button
                      onClick={() => setIsInfoModalOpen(true)}
                      className="px-6 py-2.5 text-sm font-semibold text-white border-2 border-white/60 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="flex gap-3 mt-4">
                <a
                  href={`/profile/${activePersona?.username || profile.username || walletAddress}`}
                  className="px-4 py-2 text-sm text-[#81E4F2] border border-[#81E4F2]/30 rounded-lg hover:bg-[#81E4F2]/10 transition-colors"
                >
                  View Profile
                </a>
                <a
                  href={`/profile/${activePersona?.username || profile.username || walletAddress}`}
                  className="px-4 py-2 text-sm text-gray-400 border border-gray-600 rounded-lg hover:bg-gray-700/30 transition-colors"
                >
                  Customize Profile
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Accounts Section */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Your Accounts</h3>
          </div>

          <div className="space-y-3">
            {personas.length > 0 ? (
              <>
                {personas.map((persona) => (
                  <div
                    key={persona.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                      activePersona?.id === persona.id
                        ? 'bg-[#1E293B]/50 border-[#81E4F2]/30'
                        : 'bg-[#0a0f1a] border-[#1E293B] hover:border-gray-600'
                    }`}
                  >
                    {/* Active indicator */}
                    <div className="flex-shrink-0">
                      {activePersona?.id === persona.id ? (
                        <Star className="w-4 h-4 text-[#81E4F2] fill-[#81E4F2]" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1E293B] flex-shrink-0">
                      {(() => {
                        // Only use persona's own avatar, not the main profile's
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
                    </div>

                    {/* Balance */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-[#81E4F2] font-mono font-medium">
                        ${persona.balance_usdc?.toFixed(2) || '0.00'} USDC
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      {activePersona?.id !== persona.id && (
                        <button
                          onClick={() => setActivePersona(persona)}
                          className="px-3 py-1.5 text-xs text-[#81E4F2] border border-[#81E4F2]/30 rounded hover:bg-[#81E4F2]/10 transition-colors"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Add Account button - only if under limit */}
                {personas.length < PRICING.account.maxPersonas && (
                  <button
                    onClick={() => setIsAddPersonaModalOpen(true)}
                    className="w-full flex items-center gap-3 p-4 rounded-lg border border-dashed border-gray-600 text-gray-400 hover:border-[#81E4F2]/50 hover:text-[#81E4F2] transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Account</span>
                    <span className="ml-auto text-xs text-gray-500">
                      ({PRICING.account.maxPersonas - personas.length} slot{PRICING.account.maxPersonas - personas.length !== 1 ? 's' : ''} remaining)
                    </span>
                  </button>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p className="mb-4">No accounts found</p>
                <button
                  onClick={() => setIsAddPersonaModalOpen(true)}
                  className="px-4 py-2 text-sm text-[#81E4F2] border border-[#81E4F2]/30 rounded-lg hover:bg-[#81E4F2]/10 transition-colors"
                >
                  Create Your First Account
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Agent Section */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🤖</span>
            <h3 className="text-white font-semibold">
              {agentName || 'Your Agent'}
            </h3>
          </div>

          {/* Agent Name */}
          <div className="mb-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Name your agent..."
                value={agentName}
                onChange={(e) => {
                  setAgentName(e.target.value);
                  localStorage.setItem('agent-name', e.target.value);
                }}
                className="flex-1 bg-[#0a0f1a] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:border-[#81E4F2] focus:outline-none transition-colors"
              />
              <span className="text-gray-500 text-sm">🤖</span>
            </div>
            <p className="text-gray-500 text-xs mt-1">
              Give your AI bestie a name
            </p>
          </div>

          <p className="text-gray-400 text-sm mb-4">
            Drop a track below or describe what you're looking for.
          </p>

          <AgentVibeMatcher
            onWakeUp={async (mode, input) => {
              setAgentSearching(true);
              setAgentResults(null);
              console.log('[Agent] Waking up in mode:', mode);
              console.log('[Agent] Input:', typeof input === 'string' ? input : input.title);

              try {
                const response = await fetch('/api/agent/vibe-match', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mode, input }),
                });

                const data = await response.json();

                if (data.success && data.tracks && data.tracks.length > 0) {
                  console.log('[Agent] Found', data.tracks.length, 'tracks');

                  // Add each track to the Crate with foundByAgent flag
                  if (addTrackToCollection) {
                    for (const track of data.tracks) {
                      // Convert to IPTrack format for addTrackToCollection
                      const ipTrack = {
                        id: track.id,
                        title: track.title,
                        artist: track.artist,
                        cover_image_url: track.cover_image_url || track.imageUrl,
                        audio_url: track.audioUrl,
                        bpm: track.bpm,
                        content_type: track.content_type,
                        stream_url: track.stream_url,
                        video_url: track.video_url,
                        price_stx: track.price_stx,
                        download_price_stx: track.download_price_stx,
                        allow_downloads: track.allow_downloads,
                        primary_uploader_wallet: track.primary_uploader_wallet,
                        foundByAgent: true, // Mark as found by agent
                      };
                      addTrackToCollection(ipTrack as any);
                    }
                  }

                  const name = agentName || 'Your agent';
                  setAgentResults({
                    count: data.tracks.length,
                    message: `${name} found ${data.tracks.length} track${data.tracks.length > 1 ? 's' : ''} and added to your Crate!`,
                  });
                } else {
                  setAgentResults({
                    count: 0,
                    message: 'No matching tracks found. Try different criteria.',
                  });
                }
              } catch (error) {
                console.error('[Agent] Search error:', error);
                setAgentResults({
                  count: 0,
                  message: 'Search failed. Please try again.',
                });
              }

              setAgentSearching(false);
            }}
            isSearching={agentSearching}
          />

          {/* Results message */}
          {agentResults && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              agentResults.count > 0
                ? 'bg-green-900/30 border border-green-700 text-green-300'
                : 'bg-gray-800 border border-gray-700 text-gray-400'
            }`}>
              <div className="flex items-center gap-2">
                <span>{agentResults.count > 0 ? '🤖' : '🔍'}</span>
                <span>{agentResults.message}</span>
              </div>
              {agentResults.count > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Check your Crate to see the tracks your agent found!
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-700 my-6"></div>

          {/* Agent Settings (collapsed by default) */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-300">
              <ChevronDown className="w-4 h-4 group-open:rotate-180 transition-transform" />
              <span>Agent Settings</span>
            </summary>

            <div className="mt-4 space-y-4">
              {(() => {
                const agentPersona = personas.find(p => (p as any).is_agent);

                if (agentPersona) {
                  const agent = agentPersona as any;
                  return (
                    <>
                      {/* Agent Card */}
                      <div className="flex items-center gap-4 p-4 bg-[#0a0f1a] rounded-lg border border-[#1E293B]">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-[#1E293B] flex-shrink-0 ring-2 ring-[#81E4F2]/50">
                          {(() => {
                            const avatarSrc = agent.avatar_url || profile.avatar_url;
                            const isVideo = avatarSrc && (avatarSrc.includes('.mp4') || avatarSrc.includes('.webm') || avatarSrc.includes('video/'));
                            if (isVideo) {
                              return <video src={avatarSrc} className="w-full h-full object-cover" autoPlay loop muted playsInline />;
                            }
                            return <img src={avatarSrc || generateAvatar(agent.username || agent.id)} alt={agent.display_name || 'Agent'} className="w-full h-full object-cover" />;
                          })()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium truncate">
                              {agent.display_name || agent.username || 'Unnamed Agent'}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-[#81E4F2]/20 text-[#81E4F2] rounded">🤖 Agent</span>
                          </div>
                        </div>

                        {/* Edit button */}
                        <button
                          onClick={() => console.log('Edit agent:', agent.id)}
                          className="px-3 py-1.5 text-xs text-gray-400 border border-gray-600 rounded hover:bg-gray-700/30 transition-colors"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Items found limit */}
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Max items per search:</span>
                        <span className="text-white font-mono">5</span>
                      </div>
                    </>
                  );
                }

                // No agent persona yet
                return (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">
                      Agent settings will appear here once you use the vibe matcher.
                    </p>
                  </div>
                );
              })()}
            </div>
          </details>
        </div>

        {/* Wallet Settings */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Connected Wallets</h3>
          <p className="text-gray-400 text-sm mb-4">
            Your connected wallet addresses for transactions and identity.
          </p>
          <div className="space-y-3">
            {/* SUI Address (zkLogin) */}
            {suiAddress && (
              <div className="bg-[#0a0f1a] p-3 rounded border border-[#1E293B]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-mono min-w-0">
                    <span className="text-gray-400 flex-shrink-0">SUI:</span>
                    <span className="text-[#81E4F2] truncate">{suiAddress}</span>
                    <span className="text-xs px-1.5 py-0.5 bg-blue-900/50 text-blue-300 rounded flex-shrink-0">zkLogin</span>
                  </div>
                  {!showDisconnectConfirm ? (
                    <button
                      onClick={() => setShowDisconnectConfirm(true)}
                      className="text-xs text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-shrink-0">
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
                {showDisconnectConfirm && (
                  <p className="text-xs text-amber-400/80 mt-2">
                    This will unlink your Apple/Google login from this account. You'll need to sign in again with a different invite code.
                  </p>
                )}
              </div>
            )}
            {/* STX Address */}
            {walletAddress && (
              <div className="text-xs font-mono bg-[#0a0f1a] p-3 rounded border border-[#1E293B]">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 w-12">STX:</span>
                  <span className="text-gray-500">{walletAddress}</span>
                </div>
              </div>
            )}
            {/* No wallet */}
            {!suiAddress && !walletAddress && (
              <div className="text-xs text-gray-600 font-mono bg-[#0a0f1a] p-3 rounded border border-[#1E293B]">
                No wallet connected
              </div>
            )}
          </div>
        </div>

        {/* Privacy */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Privacy</h3>
          <p className="text-gray-400 text-sm">
            Privacy settings coming soon...
          </p>
        </div>
      </div>

      {/* Modals */}
      <ProfileImageModal
        isOpen={isImageModalOpen}
        onClose={() => setIsImageModalOpen(false)}
        currentImage={profile.avatar_url || undefined}
        targetWallet={effectiveWallet || ''}
        onUpdate={handleProfileUpdate}
      />

      <ProfileInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        profile={profile}
        links={links}
        targetWallet={effectiveWallet || ''}
        suiAddress={suiAddress}
        onUpdate={handleProfileUpdate}
      />

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
    </div>
  );
}
