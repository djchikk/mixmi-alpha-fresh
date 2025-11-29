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
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';

type Tab = "uploads" | "history" | "settings";

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
      case 'radio_station':
        filtered = tracks.filter(track => track.content_type === 'radio_station' && !track.is_deleted);
        break;
      case 'station_pack':
        filtered = tracks.filter(track => track.content_type === 'station_pack' && !track.is_deleted);
        break;
      case 'video_clip':
        filtered = tracks.filter(track => track.content_type === 'video_clip' && !track.is_deleted);
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
      case 'radio_station':
        return tracks.filter(track => track.content_type === 'radio_station' && !track.is_deleted).length;
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
              <span>Upload Content</span>
            </button>
          </div>

          {/* Content Filters */}
          <div className="mb-6">
            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeFilter.type !== 'all'
                  ? 'bg-[#81E4F2] text-slate-900 font-medium'
                  : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
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
                <SettingsTab walletAddress={walletAddress} />
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
    if (track.content_type === 'full_song') return 'border-[#FFE4B5]';
    if (track.content_type === 'ep') return 'border-[#FFE4B5]';
    if (track.content_type === 'loop') return 'border-[#9772F4]';
    if (track.content_type === 'loop_pack') return 'border-[#9772F4]';
    if (track.content_type === 'radio_station') return 'border-[#FB923C]';
    if (track.content_type === 'station_pack') return 'border-[#FB923C]';
    if (track.content_type === 'video_clip') return 'border-[#2792F5]'; // Video clips - cyan blue
    return 'border-[#9772F4]';
  };

  // Get border thickness - thicker for multi-content (packs and EPs)
  const getBorderThickness = (track: Track) => {
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

                  {/* Video Player Overlay - only for video_clip content */}
                  {track.content_type === 'video_clip' && track.video_url && isVideoPlaying && playingTrackId === track.id && (
                    <video
                      ref={(el) => {
                        setVideoElement(el);
                        if (el && isVideoPlaying) {
                          el.play().catch(err => console.error('Video play error:', err));
                        }
                      }}
                      src={track.video_url}
                      className="absolute inset-0 w-full h-full object-cover"
                      playsInline
                      onEnded={() => {
                        setIsVideoPlaying(false);
                        setPlayingTrackId(null);
                      }}
                    />
                  )}

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
                      {(track.audio_url || track.stream_url || (track.content_type === 'video_clip' && track.video_url)) && (
                        <button
                          onClick={(e) => handlePlayClick(track, e)}
                          className="transition-all hover:scale-110"
                        >
                          {playingTrackId === track.id && (isVideoPlaying || !track.video_url) ? (
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
                        // Return spacer for proper centering when no badge
                        return <div className="w-12"></div>;
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
                        {track.content_type === 'radio_station' && 'RADIO'}
                        {track.content_type === 'station_pack' && 'PACK'}
                        {track.content_type === 'video_clip' && 'VIDEO'}
                        {!track.content_type && 'TRACK'}
                      </span>

                      {/* BPM Badge (right) */}
                      {track.bpm && track.content_type !== 'ep' && track.content_type !== 'video_clip' ? (
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

function SettingsTab({ walletAddress }: { walletAddress: string | null }) {
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
