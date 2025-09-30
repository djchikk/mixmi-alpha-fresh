"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import Crate from '@/components/shared/Crate';
import CompactTrackCardWithFlip from '@/components/cards/CompactTrackCardWithFlip';
import { supabase } from '@/lib/supabase';
import { IPTrack } from '@/types';
import { useToast } from '@/contexts/ToastContext';

interface ContentFilter {
  type: 'all' | 'full_song' | 'loop' | 'loop_pack' | 'ep';
  category?: string;
}

export default function CreatorStorePage() {
  const params = useParams();
  const { showToast } = useToast();
  const walletOrUsername = params.walletAddress as string; // This will be either wallet address or username

  const [tracks, setTracks] = useState<IPTrack[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<IPTrack[]>([]);
  const [activeFilter, setActiveFilter] = useState<ContentFilter>({ type: 'all' });
  const [isLoading, setIsLoading] = useState(true);
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState<string>('');
  const [actualWalletAddress, setActualWalletAddress] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 24;

  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);

  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [visibleCards, setVisibleCards] = useState(0);
  const [waveLoadingActive, setWaveLoadingActive] = useState(false);

  // First, resolve username to wallet address if needed
  useEffect(() => {
    const resolveWalletAddress = async () => {
      if (!walletOrUsername) return;

      // Check if it's a wallet address (starts with SP or ST)
      if (walletOrUsername.startsWith('SP') || walletOrUsername.startsWith('ST')) {
        setActualWalletAddress(walletOrUsername);

        // Also fetch profile data for wallet addresses
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('display_name, profile_config')
            .eq('wallet_address', walletOrUsername)
            .single();

          if (!error && data) {
            setCreatorName(data.display_name || walletOrUsername);
            // Extract profile image from profile_config
            if (data.profile_config?.profile?.image) {
              setProfileImage(data.profile_config.profile.image);
            }
          }
        } catch (error) {
          console.error('Error fetching profile data:', error);
        }
      } else {
        // It's a username, resolve to wallet address
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .select('wallet_address, display_name, profile_config')
            .eq('username', walletOrUsername)
            .single();

          if (!error && data) {
            setActualWalletAddress(data.wallet_address);
            setCreatorName(data.display_name || walletOrUsername);
            // Extract profile image from profile_config
            if (data.profile_config?.profile?.image) {
              setProfileImage(data.profile_config.profile.image);
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

          if (trackData.length > 0) {
            setCreatorName(trackData[0].artist || 'Creator');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#151C2A] to-[#101726] pt-16">
      <Header />

      <div className="max-w-7xl mx-auto px-6 pb-24">
        <div className="sticky top-[73px] z-40 bg-gradient-to-br from-[#151C2A]/95 to-[#101726]/95 backdrop-blur-md border-b border-white/10 -mx-6 px-6 pb-6 mb-8">

          <div className="flex items-center gap-4 mb-6 pt-6">
            <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-[#81E4F2] bg-slate-800">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={creatorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#81E4F2] text-2xl">
                  {creatorName ? creatorName.charAt(0).toUpperCase() : '?'}
                </div>
              )}
            </div>

            <div>
              <h1 className="text-4xl font-bold">
                <span className="bg-gradient-to-r from-[#9772F4] to-[#FFE4B5] bg-clip-text text-transparent">
                  {creatorName}'s Store
                </span>
              </h1>
              <p className="text-gray-400 mt-1">
                Discover and license amazing tracks
              </p>
            </div>
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
                  showEditControls={false}
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

      <Crate />

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