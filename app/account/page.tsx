"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { Plus, ChevronDown, ChevronUp, Pencil, ExternalLink, Image } from 'lucide-react';

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
  const { isAuthenticated, walletAddress } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("uploads");
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
          .select('display_name, username, avatar_url, avatar_thumb_96_url')
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
  }, [walletAddress]);

  // Fetch tracks on mount
  useEffect(() => {
    if (walletAddress) {
      fetchTracks();
    }
  }, [walletAddress]);

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
              onClick={() => router.push(`/profile/${walletAddress}`)}
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
              {activeTab === "library" && (
                <LibraryTab walletAddress={walletAddress} />
              )}
              {activeTab === "history" && (
                <UploadHistoryTab tracks={filteredTracks} onViewCertificate={setSelectedTrack} />
              )}
              {activeTab === "settings" && (
                <SettingsTab walletAddress={walletAddress} onProfileImageUpdate={(url, thumbUrl) => {
                  setProfileImage(url);
                  setProfileThumb96Url(thumbUrl);
                }} />
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

function SettingsTab({ walletAddress, onProfileImageUpdate }: {
  walletAddress: string | null;
  onProfileImageUpdate?: (url: string | null, thumbUrl: string | null) => void;
}) {
  const [loading, setLoading] = useState(true);
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

  // Fetch profile data
  const fetchProfileData = async () => {
    if (!walletAddress) return;

    setLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);
      }

      // Fetch links
      const { data: linksData, error: linksError } = await supabase
        .from('profile_links')
        .select('platform, url')
        .eq('wallet_address', walletAddress);

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
  }, [walletAddress]);

  const handleProfileUpdate = async () => {
    await fetchProfileData();
    // Notify parent to update the profile image in the header
    if (onProfileImageUpdate && profile.avatar_url !== undefined) {
      // Re-fetch to get the latest avatar_url and thumbnail
      const { data } = await supabase
        .from('user_profiles')
        .select('avatar_url, avatar_thumb_96_url')
        .eq('wallet_address', walletAddress)
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

              {/* Divider */}
              <div className="border-t border-[#1E293B]" />

              {/* Section 2: Creative Showcase */}
              <div>
                <h4 className="text-gray-300 text-sm font-medium mb-4">Creative Showcase</h4>

                <div className="flex gap-6">
                  {/* Abstract Profile Preview */}
                  <div className="bg-[#0a0f1a] rounded-lg p-5 border border-[#1E293B]/50 flex-shrink-0 w-[200px] flex flex-col">
                    {/* Content Sections */}
                    <div className="space-y-3">
                      {['Spotlight', 'Streams', 'Shop', 'Gallery'].map((section) => (
                        <div key={section} className="flex flex-col items-center">
                          <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1.5">{section}</p>
                          <div className="flex gap-2 justify-center">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="w-8 h-8 rounded bg-[#2D3748] border border-[#4A5568]/70" />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Sticker at bottom */}
                    <div className="flex justify-center mt-4 pt-4 border-t border-[#2D3748]/70">
                      <div className="w-6 h-6 rounded-full bg-[#2D3748] border border-[#4A5568]/70" />
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="flex-1 flex flex-col justify-center">
                    <p className="text-gray-300 text-sm mb-3">
                      Your profile is your creative canvas. Build it your way!
                    </p>

                    <div className="space-y-1.5 text-xs text-gray-400 mb-3">
                      <p><span className="text-gray-300">Spotlight</span> — Feature projects, profiles, friends, or inspo</p>
                      <p><span className="text-gray-300">Streams</span> — Embed YouTube, SoundCloud, Spotify, Apple Music</p>
                      <p><span className="text-gray-300">Shop</span> — Link to anything you're selling</p>
                      <p><span className="text-gray-300">Gallery</span> — Share images, videos, or visual art</p>
                      <p><span className="text-gray-300">Sticker</span> — Add a personal rotating badge</p>
                    </div>

                    <p className="text-gray-500 text-xs mb-2">
                      Show or hide any section. Reorder them. Make it yours.
                    </p>

                    <a
                      href="https://www.mixmi.app/profile/fluffytoycollective"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#81E4F2] hover:text-[#81E4F2]/80 transition-colors"
                    >
                      See an example profile
                    </a>
                  </div>

                  {/* Customize button aligned with explanation */}
                  <div className="flex-shrink-0 self-center">
                    <a
                      href={`/profile/${profile.username || walletAddress}`}
                      className="px-6 py-2.5 text-sm font-semibold text-white border-2 border-white/60 rounded-lg hover:bg-white/10 transition-colors inline-block"
                    >
                      Customize
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wallet Settings */}
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Wallet Settings</h3>
          <p className="text-gray-400 text-sm mb-4">
            Your connected wallet is used for all transactions and as your identity on mixmi.
          </p>
          <div className="text-xs text-gray-500 font-mono bg-[#0a0f1a] p-3 rounded border border-[#1E293B]">
            {walletAddress ? (
              <div>
                <span className="text-gray-400">Connected: </span>
                <span className="text-[#81E4F2]">{walletAddress}</span>
              </div>
            ) : (
              <span className="text-gray-600">No wallet connected</span>
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
        targetWallet={walletAddress || ''}
        onUpdate={handleProfileUpdate}
      />

      <ProfileInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        profile={profile}
        links={links}
        targetWallet={walletAddress || ''}
        onUpdate={handleProfileUpdate}
      />
    </div>
  );
}
