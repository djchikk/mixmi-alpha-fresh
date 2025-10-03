"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Crate from '@/components/shared/Crate';
import CompactTrackCardWithFlip from '@/components/cards/CompactTrackCardWithFlip';
import { supabase } from '@/lib/supabase';
import { IPTrack } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/contexts/AuthContext';
import { Plus } from 'lucide-react';
import IPTrackModal from '@/components/modals/IPTrackModal';

interface ContentFilter {
  type: 'all' | 'full_song' | 'loop' | 'loop_pack' | 'ep';
  category?: string;
}

export default function CreatorStorePage() {
  const params = useParams();
  const { showToast } = useToast();
  const { isAuthenticated, walletAddress } = useAuth();
  const walletOrUsername = params.walletAddress as string; // This will be either wallet address or username

  const [tracks, setTracks] = useState<IPTrack[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<IPTrack[]>([]);
  const [activeFilter, setActiveFilter] = useState<ContentFilter>({ type: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [actualWalletAddress, setActualWalletAddress] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 24;

  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [visibleCards, setVisibleCards] = useState(0);
  const [waveLoadingActive, setWaveLoadingActive] = useState(false);

  // Check if viewing own store
  const isOwnStore = isAuthenticated && walletAddress === actualWalletAddress;

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
            .select('display_name, username, avatar_url')
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
            .select('wallet_address, display_name, username, avatar_url')
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
        const [countResult, dataResult] = await Promise.all([
          supabase
            .from('ip_tracks')
            .select('*', { count: 'exact', head: true })
            .eq('primary_uploader_wallet', actualWalletAddress)
            .is('deleted_at', null),
          supabase
            .from('ip_tracks')
            .select('*')
            .eq('primary_uploader_wallet', actualWalletAddress)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(0, ITEMS_PER_PAGE - 1)
        ]);

        setTotalCount(countResult.count || 0);

        if (dataResult.error) {
          console.error('Error fetching tracks:', dataResult.error);
          setTracks([]);
        } else {
          const trackData = dataResult.data || [];
          setTracks(trackData);

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
    const loopTracks = tracks.filter(track => track.content_type === 'loop');
    const categories = [...new Set(loopTracks.map(track => track.loop_category).filter(Boolean))];
    setAvailableCategories(categories.sort());
  }, [tracks]);

  useEffect(() => {
    let filtered = tracks;

    switch (activeFilter.type) {
      case 'full_song':
        filtered = tracks.filter(track => track.content_type === 'full_song');
        break;
      case 'loop':
        filtered = tracks.filter(track => track.content_type === 'loop');
        if (activeFilter.category) {
          filtered = filtered.filter(track => track.loop_category === activeFilter.category);
        }
        break;
      case 'loop_pack':
        filtered = tracks.filter(track => track.content_type === 'loop_pack');
        break;
      case 'ep':
        filtered = tracks.filter(track => track.content_type === 'ep');
        break;
      case 'all':
      default:
        filtered = tracks;
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

  const getFilterCount = (filter: ContentFilter) => {
    switch (filter.type) {
      case 'all':
        return tracks.length;
      case 'full_song':
        return tracks.filter(track => track.content_type === 'full_song').length;
      case 'loop':
        if (filter.category) {
          return tracks.filter(track =>
            track.content_type === 'loop' && track.loop_category === filter.category
          ).length;
        }
        return tracks.filter(track => track.content_type === 'loop').length;
      case 'loop_pack':
        return tracks.filter(track => track.content_type === 'loop_pack').length;
      case 'ep':
        return tracks.filter(track => track.content_type === 'ep').length;
      default:
        return 0;
    }
  };

  const handlePlayPreview = (trackId: string, audioUrl?: string) => {
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
    audio.crossOrigin = 'anonymous';
    audio.volume = 0.5;
    audio.play();
    setCurrentAudio(audio);
    setPlayingTrack(trackId);

    const timeout = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      setPlayingTrack(null);
      setCurrentAudio(null);
    }, 20000);

    setPreviewTimeout(timeout);
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

          <div className="flex items-center justify-between mb-6 pt-6">
            <div className="flex items-center gap-4">
              <Link
                href={`/profile/${walletOrUsername}`}
                className="w-14 h-14 rounded-lg overflow-hidden border-2 border-[#81E4F2] bg-slate-800 hover:border-[#9772F4] transition-colors cursor-pointer"
              >
                {profileImage ? (
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
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#81E4F2] text-2xl font-semibold">
                    {creatorName ? creatorName.charAt(0).toUpperCase() : 'M'}
                  </div>
                )}
              </Link>

              <div>
                <h1 className="text-4xl font-bold">
                  <span className="bg-gradient-to-r from-[#9772F4] to-[#FFE4B5] bg-clip-text text-transparent">
                    {creatorName ? `${creatorName}'s Store` : 'Creator Store'}
                  </span>
                </h1>
                <p className="text-gray-400 mt-1">
                  {isOwnStore ? 'Manage your content' : 'Discover and license amazing tracks'}
                </p>
              </div>
            </div>

            {isOwnStore && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-[#81E4F2] rounded-lg transition-colors border border-slate-600"
              >
                <Plus size={18} />
                <span>Upload Content</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
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
            </div>

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
                {/* Loops Section */}
                {filteredTracks.filter(t => t.content_type === 'loop').length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#9772F4] tracking-wide">loops</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#9772F4]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'loop')
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
                      <h2 className="font-mono text-2xl font-bold text-[#9772F4] tracking-wide">loop packs</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#9772F4]/50 to-transparent"></div>
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

                {/* Songs Section */}
                {filteredTracks.filter(t => t.content_type === 'full_song').length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-mono text-2xl font-bold text-[#FFE4B5] tracking-wide">songs</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#FFE4B5]/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 justify-items-center">
                      {filteredTracks
                        .filter(t => t.content_type === 'full_song')
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
                      <h2 className="font-mono text-2xl font-bold text-[#FFE4B5] tracking-wide">eps</h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#FFE4B5]/50 to-transparent"></div>
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

      {/* Upload Modal */}
      {isOwnStore && (
        <IPTrackModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          onUploadComplete={refreshTracks}
        />
      )}

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