"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Crate from '@/components/shared/Crate';
import CompactTrackCardWithFlip from '@/components/cards/CompactTrackCardWithFlip';
import { supabase } from '@/lib/supabase';
import { IPTrack } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import IPTrackModal from '@/components/modals/IPTrackModal';
import ContentTypeSelector from '@/components/modals/ContentTypeSelector';
import RadioStationModal from '@/components/modals/RadioStationModal';
import CartWidget from '@/components/CartWidget';
import SimpleRadioPlayer from '@/components/SimpleRadioPlayer';
import SimplePlaylistPlayer from '@/components/SimplePlaylistPlayer';

interface ContentFilter {
  type: 'all' | 'full_song' | 'loop' | 'loop_pack' | 'ep' | 'radio_station' | 'station_pack' | 'video_clip' | 'hidden';
  category?: string;
}

export default function CreatorStorePage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const { isAuthenticated, walletAddress } = useAuth();
  const walletOrUsername = params.walletAddress as string; // This will be either wallet address or username

  const [tracks, setTracks] = useState<IPTrack[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<IPTrack[]>([]);
  const [activeFilter, setActiveFilter] = useState<ContentFilter>({ type: 'all' });
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [actualWalletAddress, setActualWalletAddress] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [storeLabel, setStoreLabel] = useState<string>('Store');
  const [isContentTypeSelectorOpen, setIsContentTypeSelectorOpen] = useState(false);
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 24;

  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [visibleCards, setVisibleCards] = useState(0);
  const [waveLoadingActive, setWaveLoadingActive] = useState(false);
  const [failedRemixCount, setFailedRemixCount] = useState(0);

  // Check if viewing own store
  const isOwnStore = isAuthenticated && walletAddress === actualWalletAddress;

  // Helper: Check if a track is a child item inside a pack/EP (should be hidden)
  // Child items have pack_id AND pack_position >= 1
  // Container items (packs/EPs) have pack_position = 0 or null
  const isChildItem = (track: IPTrack) => {
    return track.pack_id && track.pack_position !== undefined && track.pack_position >= 1;
  };

  // First, resolve username to wallet address if needed
  useEffect(() => {
    const resolveWalletAddress = async () => {
      if (!walletOrUsername) return;

      // Check if it's a wallet address (starts with SP or ST)
      if (walletOrUsername.startsWith('SP') || walletOrUsername.startsWith('ST')) {
        setActualWalletAddress(walletOrUsername);
        // Set a default creator name from wallet (will be overridden by profile or first track)
        setCreatorName(walletOrUsername.slice(0, 8) + '...');

        // Fetch profile data for wallet addresses
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('display_name, username, avatar_url, store_label')
            .eq('wallet_address', walletOrUsername)
            .single();

          if (!profileError && profileData) {
            // Only use profile data if it's been customized (not "New User")
            if (profileData.display_name && profileData.display_name !== 'New User') {
              setCreatorName(profileData.display_name);
            } else if (profileData.username) {
              setCreatorName(profileData.username);
            }
            // Otherwise leave it for the track fetch to set from artist name

            // Set profile image from avatar_url if customized
            if (profileData.avatar_url) {
              setProfileImage(profileData.avatar_url);
            }
            // Otherwise leave it for track fetch to set from first track cover

            // Set store label from profile if customized
            if (profileData.store_label) {
              setStoreLabel(profileData.store_label);
            }
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
        }
      } else {
        // It's a username, resolve to wallet address
        setCreatorName(walletOrUsername);

        try {
          const { data: profileData, error: profileError } = await supabase
            .from('user_profiles')
            .select('wallet_address, display_name, username, avatar_url, store_label')
            .eq('username', walletOrUsername)
            .single();

          if (!profileError && profileData) {
            setActualWalletAddress(profileData.wallet_address);

            // Only use profile data if it's been customized
            if (profileData.display_name && profileData.display_name !== 'New User') {
              setCreatorName(profileData.display_name);
            } else if (profileData.username) {
              setCreatorName(profileData.username);
            }

            // Set profile image from avatar_url if customized
            if (profileData.avatar_url) {
              setProfileImage(profileData.avatar_url);
            }

            // Set store label from profile if customized
            if (profileData.store_label) {
              setStoreLabel(profileData.store_label);
            }
          } else {
            // Username not found, treat as wallet address
            setActualWalletAddress(walletOrUsername);
          }
        } catch (error) {
          console.error('Error resolving username:', error);
          setActualWalletAddress(walletOrUsername);
        }
      }
    };

    resolveWalletAddress();
  }, [walletOrUsername]);

  useEffect(() => {
    const fetchTracks = async () => {
      if (!actualWalletAddress) return;

      setIsLoading(true);
      try {
        // Fetch all tracks (including failed ones)
        const { data: allTracks, error: fetchError } = await supabase
          .from('ip_tracks')
          .select('*')
          .eq('primary_uploader_wallet', actualWalletAddress)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching tracks:', fetchError);
          setTracks([]);
          setTotalCount(0);
          setFailedRemixCount(0);
        } else {
          const trackData = allTracks || [];

          // DEBUG: Check if notes field is being fetched for video clips
          const videoClips = trackData.filter(t => t.content_type === 'video_clip');
          if (videoClips.length > 0) {
            console.log('🎥 Video clips fetched from database:', videoClips.map(v => ({
              id: v.id,
              title: v.title,
              notes: v.notes,
              video_url: v.video_url ? '✅' : '❌',
              audio_url: v.audio_url ? '✅' : '❌'
            })));
          }

          // TODO: Implement payment status filtering
          // Currently showing all tracks. Need to filter out tracks with payment_status='failed'
          // after confirming the filtering logic doesn't accidentally hide legitimate content.
          // Related files: /api/verify-remix-payments/route.ts (cleanup API exists and works)
          // Migration: /supabase/migrations/add_payment_status.sql (already applied)
          setTracks(trackData);
          setTotalCount(trackData.length);
          setFailedRemixCount(0);

          // Use first track's data as fallback if profile not customized
          if (trackData.length > 0) {
            // Set artist name as fallback if creatorName is still wallet address or empty
            setCreatorName(prev => {
              if (!prev || prev.includes('...') || prev === 'New User') {
                return trackData[0].artist || 'Creator';
              }
              return prev;
            });

            // Set first track's cover as fallback avatar if no profile image set
            setProfileImage(prev => {
              if (!prev && trackData[0].cover_image_url) {
                return trackData[0].cover_image_url;
              }
              return prev;
            });
          }
        }
      } catch (error) {
        console.error('Failed to fetch tracks:', error);
        setTracks([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTracks();
    setCurrentPage(1);
  }, [actualWalletAddress]);

  useEffect(() => {
    // Only consider standalone loops (not loops inside packs) for categories
    const loopTracks = tracks.filter(track => track.content_type === 'loop' && !isChildItem(track));
    const categories = [...new Set(loopTracks.map(track => track.loop_category).filter(Boolean))];
    setAvailableCategories(categories.sort());
  }, [tracks]);

  useEffect(() => {
    let filtered = tracks;

    // IMPORTANT: Always hide child items (loops/songs inside packs/EPs) - only show containers
    switch (activeFilter.type) {
      case 'full_song':
        // Show standalone songs only, not songs inside EPs
        filtered = tracks.filter(track => track.content_type === 'full_song' && !track.is_deleted && !isChildItem(track));
        break;
      case 'loop':
        // Show standalone loops only, not loops inside loop packs
        filtered = tracks.filter(track => track.content_type === 'loop' && !track.is_deleted && !isChildItem(track));
        if (activeFilter.category) {
          filtered = filtered.filter(track => track.loop_category === activeFilter.category);
        }
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

  useEffect(() => {
    if (filteredTracks.length === 0) {
      setVisibleCards(0);
      return;
    }

    setVisibleCards(0);
    setWaveLoadingActive(true);

    const wave1Timer = setTimeout(() => setVisibleCards(Math.min(2, filteredTracks.length)), 0);
    const wave2Timer = setTimeout(() => setVisibleCards(Math.min(4, filteredTracks.length)), 200);
    const wave3Timer = setTimeout(() => setVisibleCards(Math.min(8, filteredTracks.length)), 400);
    const wave4Timer = setTimeout(() => setVisibleCards(Math.min(12, filteredTracks.length)), 600);
    const wave5Timer = setTimeout(() => {
      setVisibleCards(filteredTracks.length);
      setWaveLoadingActive(false);
    }, 800);

    return () => {
      clearTimeout(wave1Timer);
      clearTimeout(wave2Timer);
      clearTimeout(wave3Timer);
      clearTimeout(wave4Timer);
      clearTimeout(wave5Timer);
    };
  }, [filteredTracks]);

  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
    };
  }, [currentAudio, previewTimeout]);

  // Get count for each filter (excluding child items except for hidden)
  const getFilterCount = (filter: ContentFilter) => {
    switch (filter.type) {
      case 'all':
        return tracks.filter(track => !track.is_deleted && !isChildItem(track)).length;
      case 'full_song':
        return tracks.filter(track => track.content_type === 'full_song' && !track.is_deleted && !isChildItem(track)).length;
      case 'loop':
        if (filter.category) {
          return tracks.filter(track =>
            track.content_type === 'loop' && track.loop_category === filter.category && !track.is_deleted && !isChildItem(track)
          ).length;
        }
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

  const handlePlayPreview = (trackId: string, audioUrl?: string, isRadioStation?: boolean) => {
    console.log('🎧 Creator Store handlePlayPreview called:', { trackId, audioUrl, isRadioStation });

    if (!audioUrl) return;

    if (playingTrack === trackId && currentAudio) {
      currentAudio.pause();
      currentAudio.remove();
      setPlayingTrack(null);
      setCurrentAudio(null);
      if (previewTimeout) {
        clearTimeout(previewTimeout);
        setPreviewTimeout(null);
      }
      return;
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.remove();
      setCurrentAudio(null);
    }

    if (previewTimeout) {
      clearTimeout(previewTimeout);
      setPreviewTimeout(null);
    }

    const audio = new Audio(audioUrl);

    // Only set crossOrigin for regular tracks that need audio analysis
    // Radio stations don't need this and it causes CORS errors
    if (!isRadioStation) {
      audio.crossOrigin = 'anonymous';
    }

    audio.volume = 0.5;

    // Only set playingTrack state if audio actually starts playing
    audio.play()
      .then(() => {
        console.log('✅ Creator Store audio playing successfully');
        setCurrentAudio(audio);
        setPlayingTrack(trackId);

        // 20-second preview timeout for all tracks (including radio stations)
        // Only the Radio Widget should play indefinitely
        const timeout = setTimeout(() => {
          audio.pause();
          if (!isRadioStation) {
            audio.currentTime = 0; // Only reset position for regular tracks
          }
          setPlayingTrack(null);
          setCurrentAudio(null);
        }, 20000);

        setPreviewTimeout(timeout);
      })
      .catch(error => {
        console.error('❌ Creator Store playback failed:', error);
        setPlayingTrack(null);
        setCurrentAudio(null);
      });
  };

  const handleStopPreview = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.remove();
      setCurrentAudio(null);
      setPlayingTrack(null);
    }

    if (previewTimeout) {
      clearTimeout(previewTimeout);
      setPreviewTimeout(null);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!confirm('Are you sure you want to delete this track? This action cannot be undone.')) {
      return;
    }

    try {
      // Soft delete by setting deleted_at timestamp
      const { error } = await supabase
        .from('ip_tracks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', trackId)
        .eq('primary_uploader_wallet', actualWalletAddress); // Verify ownership

      if (error) {
        console.error('Error deleting track:', error);
        showToast('Failed to delete track', 'error');
        return;
      }

      // Remove from local state
      setTracks(prev => prev.filter(t => t.id !== trackId));
      showToast('Track deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting track:', error);
      showToast('Failed to delete track', 'error');
    }
  };

  const refreshTracks = async () => {
    if (!actualWalletAddress) return;

    try {
      const { data, error } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('primary_uploader_wallet', actualWalletAddress)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error refreshing tracks:', error);
        return;
      }

      setTracks(data || []);
      showToast('Content uploaded successfully!', 'success');
    } catch (error) {
      console.error('Error refreshing tracks:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#151C2A] to-[#101726] pt-16">
      <Header />

      <div className="max-w-7xl mx-auto px-6 pb-24">
        <div className="sticky top-[73px] z-40 bg-gradient-to-br from-[#151C2A]/95 to-[#101726]/95 backdrop-blur-md border-b border-white/10 -mx-6 px-6 pb-6 mb-8">

          <div className="flex items-center gap-4 mb-6 pt-6">
            <Link
              href={`/profile/${walletOrUsername}`}
              className="w-14 h-14 rounded-lg overflow-hidden border-2 border-[#81E4F2] bg-slate-800 hover:shadow-[0_0_20px_rgba(129,228,242,0.5)] transition-all duration-300 cursor-pointer"
              title="Go to Profile"
            >
              {profileImage ? (
                profileImage.includes('.mp4') || profileImage.includes('.webm') || profileImage.includes('video/') ? (
                  <video
                    src={profileImage}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onError={() => {
                      console.error('Failed to load profile video');
                    }}
                  />
                ) : (
                  <img
                    src={profileImage}
                    alt={creatorName || 'Creator'}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('Failed to load profile image');
                      // Hide the broken image and show fallback
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#81E4F2] text-2xl font-semibold">
                  {creatorName ? creatorName.charAt(0).toUpperCase() : 'M'}
                </div>
              )}
            </Link>

            <div>
              <h1 className="text-4xl font-bold">
                <span className="bg-gradient-to-r from-[#A084F9] to-[#A8E66B] bg-clip-text text-transparent">
                  {creatorName ? (
                    <>
                      <Link
                        href={`/profile/${walletOrUsername}`}
                        className="border-b-2 border-transparent hover:border-[#81E4F2] transition-all duration-300"
                      >
                        {creatorName}
                      </Link>
                      's {storeLabel}
                    </>
                  ) : `Creator ${storeLabel}`}
                </span>
              </h1>
              <p className="text-gray-400 mt-1">
                {isOwnStore ? 'Manage your content' : 'Discover and license amazing tracks'}
              </p>
            </div>
          </div>

          {isOwnStore && (
            <div className="flex justify-start mb-6">
              <button
                onClick={() => setIsContentTypeSelectorOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-[#81E4F2] rounded-lg transition-colors border border-slate-600"
              >
                <Plus size={18} />
                <span>Add</span>
              </button>
            </div>
          )}

          <div className="space-y-4">
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
                      activeFilter.type === 'loop' ? (activeFilter.category ? `Loops - ${activeFilter.category}` : 'Loops') :
                      activeFilter.type === 'loop_pack' ? 'Loop Packs' :
                      activeFilter.type === 'ep' ? 'EPs' :
                      activeFilter.type === 'radio_station' ? 'Radio' :
                      activeFilter.type === 'station_pack' ? 'Radio Packs' :
                      activeFilter.type === 'video_clip' ? 'Videos' :
                      activeFilter.type === 'hidden' ? 'Hidden' : 'All'
                    } (${getFilterCount(activeFilter)})`
                }
              </span>
              {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {/* Collapsible Filter Options */}
            {showFilters && (
              <div className="flex flex-wrap gap-2 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
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
                      ? 'bg-[#FFC044] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Radio ({getFilterCount({ type: 'radio_station' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'station_pack' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'station_pack'
                      ? 'bg-[#FFC044] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Radio Packs ({getFilterCount({ type: 'station_pack' })})
                </button>

                <button
                  onClick={() => { setActiveFilter({ type: 'video_clip' }); setShowFilters(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    activeFilter.type === 'video_clip'
                      ? 'bg-[#5BB5F9] text-slate-900 font-medium'
                      : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  }`}
                >
                  Videos ({getFilterCount({ type: 'video_clip' })})
                </button>

                {isOwnStore && (
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
                )}
              </div>
            )}

            {/* Loop Categories Sub-filter (shows when loops are selected) */}
            {activeFilter.type === 'loop' && availableCategories.length > 0 && (
              <div className="ml-4 pl-4 border-l-2 border-slate-700">
                <p className="text-gray-400 text-sm mb-2">Loop Categories:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveFilter({ type: 'loop' })}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      activeFilter.type === 'loop' && !activeFilter.category
                        ? 'bg-[#81E4F2]/20 text-[#81E4F2] border border-[#81E4F2]'
                        : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                    }`}
                  >
                    All Loops ({getFilterCount({ type: 'loop' })})
                  </button>

                  {availableCategories.map(category => (
                    <button
                      key={category}
                      onClick={() => setActiveFilter({ type: 'loop', category })}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        activeFilter.type === 'loop' && activeFilter.category === category
                          ? 'bg-[#81E4F2] text-slate-900 font-medium'
                          : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                      }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')} ({getFilterCount({ type: 'loop', category })})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TODO: Re-enable after implementing payment status filtering */}
        {/* Failed Payment Notification - Only show to owner */}
        {false && isOwnStore && failedRemixCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-900/20 border-2 border-yellow-600/50 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-yellow-200 font-semibold mb-1">
                  {failedRemixCount} Remix{failedRemixCount > 1 ? 'es' : ''} Hidden Due to Payment Failure
                </h3>
                <p className="text-yellow-300/80 text-sm leading-relaxed">
                  {failedRemixCount > 1 ? 'These remixes were' : 'This remix was'} not saved because the payment transaction failed.
                  This can happen if your wallet had insufficient funds when recording.
                  {failedRemixCount > 1 ? ' These items have' : ' This item has'} been automatically hidden from your store.
                </p>
                <p className="text-yellow-300/60 text-xs mt-2">
                  To record a new remix, make sure your wallet has enough STX to cover the licensing fees.
                </p>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2]"></div>
          </div>
        ) : filteredTracks.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-32 h-32 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <svg className="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No tracks yet</h2>
            <p className="text-gray-400">This creator hasn't uploaded any tracks yet.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Group tracks by content type when showing "All" */}
            {activeFilter.type === 'all' ? (
              <>
                {/* Loops Section - standalone loops only */}
                {filteredTracks.filter(t => t.content_type === 'loop' && !isChildItem(t)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#A084F9] tracking-wide">loops</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#A084F9]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'loop' && !isChildItem(t))
                        .slice(0, visibleCards)
                        .map((track, index) => (
                          <div key={track.id} className="wave-card" style={{ animationDelay: `${index * 75}ms`, animationDuration: '0.5s' }}>
                            <CompactTrackCardWithFlip
                              track={track}
                              isPlaying={playingTrack === track.id}
                              onPlayPreview={handlePlayPreview}
                              onStopPreview={handleStopPreview}
                              showEditControls={isOwnStore}
                              onDeleteTrack={isOwnStore ? handleDeleteTrack : undefined}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Loop Packs Section */}
                {filteredTracks.filter(t => t.content_type === 'loop_pack').length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#A084F9] tracking-wide">loop packs</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#A084F9]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'loop_pack')
                        .slice(0, visibleCards)
                        .map((track, index) => (
                          <div key={track.id} className="wave-card" style={{ animationDelay: `${index * 75}ms`, animationDuration: '0.5s' }}>
                            <CompactTrackCardWithFlip
                              track={track}
                              isPlaying={playingTrack === track.id}
                              onPlayPreview={handlePlayPreview}
                              onStopPreview={handleStopPreview}
                              showEditControls={isOwnStore}
                              onDeleteTrack={isOwnStore ? handleDeleteTrack : undefined}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Songs Section - standalone songs only */}
                {filteredTracks.filter(t => t.content_type === 'full_song' && !isChildItem(t)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#A8E66B] tracking-wide">songs</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#A8E66B]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'full_song' && !isChildItem(t))
                        .slice(0, visibleCards)
                        .map((track, index) => (
                          <div key={track.id} className="wave-card" style={{ animationDelay: `${index * 75}ms`, animationDuration: '0.5s' }}>
                            <CompactTrackCardWithFlip
                              track={track}
                              isPlaying={playingTrack === track.id}
                              onPlayPreview={handlePlayPreview}
                              onStopPreview={handleStopPreview}
                              showEditControls={isOwnStore}
                              onDeleteTrack={isOwnStore ? handleDeleteTrack : undefined}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* EPs Section */}
                {filteredTracks.filter(t => t.content_type === 'ep').length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#A8E66B] tracking-wide">eps</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#A8E66B]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'ep')
                        .slice(0, visibleCards)
                        .map((track, index) => (
                          <div key={track.id} className="wave-card" style={{ animationDelay: `${index * 75}ms`, animationDuration: '0.5s' }}>
                            <CompactTrackCardWithFlip
                              track={track}
                              isPlaying={playingTrack === track.id}
                              onPlayPreview={handlePlayPreview}
                              onStopPreview={handleStopPreview}
                              showEditControls={isOwnStore}
                              onDeleteTrack={isOwnStore ? handleDeleteTrack : undefined}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Radio Stations Section - standalone stations only */}
                {filteredTracks.filter(t => t.content_type === 'radio_station' && !isChildItem(t)).length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#FFC044] tracking-wide">radio stations</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#FFC044]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'radio_station' && !isChildItem(t))
                        .slice(0, visibleCards)
                        .map((track, index) => (
                          <div key={track.id} className="wave-card" style={{ animationDelay: `${index * 75}ms`, animationDuration: '0.5s' }}>
                            <CompactTrackCardWithFlip
                              track={track}
                              isPlaying={playingTrack === track.id}
                              onPlayPreview={handlePlayPreview}
                              onStopPreview={handleStopPreview}
                              showEditControls={isOwnStore}
                              onDeleteTrack={isOwnStore ? handleDeleteTrack : undefined}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Radio Packs Section */}
                {filteredTracks.filter(t => t.content_type === 'station_pack').length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#FFC044] tracking-wide">radio packs</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#FFC044]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'station_pack')
                        .slice(0, visibleCards)
                        .map((track, index) => (
                          <div key={track.id} className="wave-card" style={{ animationDelay: `${index * 75}ms`, animationDuration: '0.5s' }}>
                            <CompactTrackCardWithFlip
                              track={track}
                              isPlaying={playingTrack === track.id}
                              onPlayPreview={handlePlayPreview}
                              onStopPreview={handleStopPreview}
                              showEditControls={isOwnStore}
                              onDeleteTrack={isOwnStore ? handleDeleteTrack : undefined}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Video Clips Section */}
                {filteredTracks.filter(t => t.content_type === 'video_clip').length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#5BB5F9] tracking-wide">video clips</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#5BB5F9]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'video_clip')
                        .slice(0, visibleCards)
                        .map((track, index) => (
                          <div key={track.id} className="wave-card" style={{ animationDelay: `${index * 75}ms`, animationDuration: '0.5s' }}>
                            <CompactTrackCardWithFlip
                              track={track}
                              isPlaying={playingTrack === track.id}
                              onPlayPreview={handlePlayPreview}
                              onStopPreview={handleStopPreview}
                              showEditControls={isOwnStore}
                              onDeleteTrack={isOwnStore ? handleDeleteTrack : undefined}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Filtered view - single grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                {filteredTracks.slice(0, visibleCards).map((track, index) => (
                  <div
                    key={track.id}
                    className="wave-card"
                    style={{
                      animationDelay: `${index * 75}ms`,
                      animationDuration: '0.5s'
                    }}
                  >
                    <CompactTrackCardWithFlip
                      track={track}
                      isPlaying={playingTrack === track.id}
                      onPlayPreview={handlePlayPreview}
                      onStopPreview={handleStopPreview}
                      showEditControls={isOwnStore}
                      onDeleteTrack={isOwnStore ? handleDeleteTrack : undefined}
                    />
                  </div>
                ))}

                {waveLoadingActive && filteredTracks.length > visibleCards && (
                  <>
                    {Array.from({ length: Math.min(8, filteredTracks.length - visibleCards) }, (_, i) => (
                      <div
                        key={`skeleton-${i}`}
                        className="w-[160px] h-[160px] bg-slate-800 rounded-lg animate-pulse"
                        style={{
                          animationDelay: `${(visibleCards + i) * 75}ms`,
                          animationDuration: '1.5s'
                        }}
                      />
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Crate />

      {/* Content Type Selector */}
      {isOwnStore && (
        <ContentTypeSelector
          isOpen={isContentTypeSelectorOpen}
          onClose={() => setIsContentTypeSelectorOpen(false)}
          onSelectMusic={() => {
            setIsContentTypeSelectorOpen(false);
            setIsMusicModalOpen(true);
          }}
          onSelectRadio={() => {
            setIsContentTypeSelectorOpen(false);
            setIsRadioModalOpen(true);
          }}
          onSelectVideo={() => {
            setIsContentTypeSelectorOpen(false);
            setIsVideoModalOpen(true);
          }}
          onSelectChat={() => {
            setIsContentTypeSelectorOpen(false);
            router.push('/upload-studio');
          }}
        />
      )}

      {/* Music Upload Modal */}
      {isOwnStore && (
        <IPTrackModal
          isOpen={isMusicModalOpen}
          onClose={() => setIsMusicModalOpen(false)}
          onUploadComplete={refreshTracks}
          contentCategory="music"
        />
      )}

      {/* Radio Station Upload Modal */}
      {isOwnStore && (
        <RadioStationModal
          isOpen={isRadioModalOpen}
          onClose={() => setIsRadioModalOpen(false)}
          onUploadComplete={refreshTracks}
        />
      )}

      {/* Video Clip Upload Modal - Uses IPTrackModal filtered to visual content types */}
      {isOwnStore && (
        <IPTrackModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          onSave={refreshTracks}
          contentCategory="visual"
        />
      )}

      {/* Widgets */}
      <CartWidget />
      <SimpleRadioPlayer />
      <SimplePlaylistPlayer />

      <style jsx>{`
        @keyframes waveCardFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .wave-card {
          animation: waveCardFadeIn ease-out both;
        }
      `}</style>
    </div>
  );
}