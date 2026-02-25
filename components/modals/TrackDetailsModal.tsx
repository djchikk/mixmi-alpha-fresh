"use client";

import React, { useEffect, useState } from 'react';
import { IPTrack } from '@/types';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useDrag } from 'react-dnd';
import { GripVertical } from 'lucide-react';
import Link from 'next/link';
import { getAIAssistanceDisplay } from '@/lib/aiAssistanceUtils';
import { PRICING } from '@/config/pricing';

interface TrackDetailsModalProps {
  track: IPTrack;
  isOpen: boolean;
  onClose: () => void;
}

// Draggable individual track component for modal
interface DraggableModalTrackProps {
  track: any; // Individual loop or song
  children: React.ReactNode;
}

function DraggableModalTrack({ track, children }: DraggableModalTrackProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TRACK_CARD',
    item: () => {
      console.log('🎵 Modal track being dragged:', track);
      return { track };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [track]);

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      {children}
    </div>
  );
}

export default function TrackDetailsModal({ track, isOpen, onClose }: TrackDetailsModalProps) {
  // Debug: Track what modal actually receives vs what globe conversion produces
  if (isOpen && track.id === '9f490a13-3966-43db-bce1-54e67b309826-loc-0') {
    console.log('🎭 MODAL RECEIVED TRACK OBJECT:', track);
    console.log('🎭 MODAL IP rights:', {
      composition: track.composition_split,
      production: track.production_split, 
      wallet: track.wallet_address
    });
  }
  const [packLoops, setPackLoops] = useState<IPTrack[]>([]);
  const [loadingLoops, setLoadingLoops] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [sourceTracks, setSourceTracks] = useState<IPTrack[]>([]);
  const [loadingSourceTracks, setLoadingSourceTracks] = useState(false);
  const [ipRights, setIPRights] = useState<{
    composition_splits: Array<{ percentage: number; wallet: string }>;
    production_splits: Array<{ percentage: number; wallet: string }>;
    notes: string;
    price_usdc: number;
    remix_price: number;
    license_type: string;
    license_selection: string;
    allow_downloads: boolean;
    remix_price_usdc: number;
    download_price_usdc: number | null;
  } | null>(null);

  // Pending collaborators state
  const [pendingCollaborators, setPendingCollaborators] = useState<Array<{
    collaborator_name: string;
    split_percentage: number;
    split_type: string;
    split_position: number;
    status: string;
  }>>([]);

  // Collaborator usernames lookup (wallet address → username/display name)
  const [collaboratorNames, setCollaboratorNames] = useState<Record<string, string>>({});

  // Derived-from track state (provenance - where this content came from)
  const [derivedFromTrack, setDerivedFromTrack] = useState<{ id: string; title: string; artist: string } | null>(null);

  // Audio playback state for individual loops
  const [playingLoopId, setPlayingLoopId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);

  // Video playback state
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [videoTimeout, setVideoTimeout] = useState<NodeJS.Timeout | null>(null);

  // Fetch username for the track's primary uploader wallet
  // Priority: persona username > user_profiles username
  useEffect(() => {
    const fetchUsername = async () => {
      if (!track.primary_uploader_wallet) return;

      // First check if there's a persona with this wallet
      const { data: personaData } = await supabase
        .from('personas')
        .select('username')
        .eq('wallet_address', track.primary_uploader_wallet)
        .eq('is_active', true)
        .maybeSingle();

      if (personaData?.username) {
        setUsername(personaData.username);
        return;
      }

      // Fall back to user_profiles
      const { data } = await supabase
        .from('user_profiles')
        .select('username')
        .eq('wallet_address', track.primary_uploader_wallet)
        .single();

      setUsername(data?.username || null);
    };

    if (isOpen) {
      fetchUsername();
    }
  }, [track.primary_uploader_wallet, isOpen]);

  // Fetch pending collaborators from database
  useEffect(() => {
    if (isOpen && track.id) {
      const baseId = track.id.split('-loc-')[0];
      console.log('🔍 Fetching pending collaborators for track ID:', baseId);

      supabase
        .from('pending_collaborators')
        .select('collaborator_name, split_percentage, split_type, split_position, status')
        .eq('track_id', baseId)
        .order('split_position', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.log('📝 No pending_collaborators table or no records:', error.message);
            setPendingCollaborators([]);
          } else {
            console.log('✅ Pending collaborators:', data);
            setPendingCollaborators(data || []);
          }
        });
    }
  }, [isOpen, track.id]);

  // Fetch derived-from track (provenance) if this track has one
  useEffect(() => {
    if (isOpen && track.id) {
      const baseId = track.id.split('-loc-')[0];

      // First get the derived_from_track_id from this track
      supabase
        .from('ip_tracks')
        .select('derived_from_track_id')
        .eq('id', baseId)
        .single()
        .then(({ data, error }) => {
          if (error || !data?.derived_from_track_id) {
            setDerivedFromTrack(null);
            return;
          }

          // Now fetch the derived-from track's details
          supabase
            .from('ip_tracks')
            .select('id, title, artist')
            .eq('id', data.derived_from_track_id)
            .single()
            .then(({ data: trackData, error: trackError }) => {
              if (trackError || !trackData) {
                console.log('⚠️ Could not fetch derived-from track:', trackError);
                setDerivedFromTrack(null);
              } else {
                console.log('✅ Found derived-from track:', trackData.title);
                setDerivedFromTrack(trackData);
              }
            });
        });
    }
  }, [isOpen, track.id]);

  // Fetch IP rights directly from database
  useEffect(() => {
    if (isOpen && track.id) {
      const baseId = track.id.split('-loc-')[0]; // Remove location suffix
      console.log('🔍 Fetching IP rights for track ID:', baseId);

      supabase
        .from('ip_tracks')
        .select(`
          composition_split_1_percentage, composition_split_1_wallet, composition_split_1_sui_address,
          composition_split_2_percentage, composition_split_2_wallet, composition_split_2_sui_address,
          composition_split_3_percentage, composition_split_3_wallet, composition_split_3_sui_address,
          composition_split_4_percentage, composition_split_4_wallet, composition_split_4_sui_address,
          composition_split_5_percentage, composition_split_5_wallet, composition_split_5_sui_address,
          composition_split_6_percentage, composition_split_6_wallet, composition_split_6_sui_address,
          composition_split_7_percentage, composition_split_7_wallet, composition_split_7_sui_address,
          production_split_1_percentage, production_split_1_wallet, production_split_1_sui_address,
          production_split_2_percentage, production_split_2_wallet, production_split_2_sui_address,
          production_split_3_percentage, production_split_3_wallet, production_split_3_sui_address,
          production_split_4_percentage, production_split_4_wallet, production_split_4_sui_address,
          production_split_5_percentage, production_split_5_wallet, production_split_5_sui_address,
          production_split_6_percentage, production_split_6_wallet, production_split_6_sui_address,
          production_split_7_percentage, production_split_7_wallet, production_split_7_sui_address,
          uploader_address, primary_uploader_wallet, notes, price_usdc, price_stx, remix_price,
          license_type, license_selection, source_track_ids,
          allow_downloads, remix_price_usdc, remix_price_stx, download_price_usdc, download_price_stx
        `)
        .eq('id', baseId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            console.error('❌ Error fetching IP rights:', error);
          } else {
            console.log('✅ IP rights from database:', data);

            // Collect all composition splits - prefer SUI address over Stacks wallet
            const compositionSplits = [];
            const comp1Wallet = data.composition_split_1_sui_address || data.composition_split_1_wallet;
            if (comp1Wallet && data.composition_split_1_percentage) {
              compositionSplits.push({
                percentage: data.composition_split_1_percentage,
                wallet: comp1Wallet
              });
            }
            const comp2Wallet = data.composition_split_2_sui_address || data.composition_split_2_wallet;
            if (comp2Wallet && data.composition_split_2_percentage) {
              compositionSplits.push({
                percentage: data.composition_split_2_percentage,
                wallet: comp2Wallet
              });
            }
            const comp3Wallet = data.composition_split_3_sui_address || data.composition_split_3_wallet;
            if (comp3Wallet && data.composition_split_3_percentage) {
              compositionSplits.push({
                percentage: data.composition_split_3_percentage,
                wallet: comp3Wallet
              });
            }

            // Collect all production splits - prefer SUI address over Stacks wallet
            const productionSplits = [];
            const prod1Wallet = data.production_split_1_sui_address || data.production_split_1_wallet;
            if (prod1Wallet && data.production_split_1_percentage) {
              productionSplits.push({
                percentage: data.production_split_1_percentage,
                wallet: prod1Wallet
              });
            }
            const prod2Wallet = data.production_split_2_sui_address || data.production_split_2_wallet;
            if (prod2Wallet && data.production_split_2_percentage) {
              productionSplits.push({
                percentage: data.production_split_2_percentage,
                wallet: prod2Wallet
              });
            }
            const prod3Wallet = data.production_split_3_sui_address || data.production_split_3_wallet;
            if (prod3Wallet && data.production_split_3_percentage) {
              productionSplits.push({
                percentage: data.production_split_3_percentage,
                wallet: prod3Wallet
              });
            }

            setIPRights({
              composition_splits: compositionSplits,
              production_splits: productionSplits,
              notes: data.notes || '',
              price_usdc: data.price_usdc || data.price_stx || 0,
              remix_price: data.remix_price || 0,
              license_type: data.license_type || '',
              license_selection: data.license_selection || '',
              allow_downloads: data.allow_downloads || false,
              remix_price_usdc: data.remix_price_usdc || data.remix_price_stx || 0.10,
              download_price_usdc: data.download_price_usdc ?? data.download_price_stx ?? null
            });
          }
        });
    }
  }, [isOpen, track.id]);

  // Look up usernames for all collaborator wallets
  useEffect(() => {
    const lookupCollaboratorNames = async () => {
      // Collect all unique wallet addresses from splits (excluding pending: prefixed ones)
      const wallets = new Set<string>();

      // Add current track's primary uploader (the remixer for remixes)
      if (track.primary_uploader_wallet) {
        wallets.add(track.primary_uploader_wallet);
      }

      // Add wallets from current track's IP splits
      if (ipRights) {
        [...ipRights.composition_splits, ...ipRights.production_splits].forEach(split => {
          if (split.wallet && !split.wallet.startsWith('pending:') && split.wallet.length > 10) {
            wallets.add(split.wallet);
          }
        });
      }

      // Add wallets from source tracks (for remixes)
      sourceTracks.forEach(sourceTrack => {
        // Primary uploader
        if (sourceTrack.primary_uploader_wallet) {
          wallets.add(sourceTrack.primary_uploader_wallet);
        }
        // Composition splits
        if (sourceTrack.composition_split_1_wallet) wallets.add(sourceTrack.composition_split_1_wallet);
        if (sourceTrack.composition_split_2_wallet) wallets.add(sourceTrack.composition_split_2_wallet);
        if (sourceTrack.composition_split_3_wallet) wallets.add(sourceTrack.composition_split_3_wallet);
        // Production splits
        if (sourceTrack.production_split_1_wallet) wallets.add(sourceTrack.production_split_1_wallet);
        if (sourceTrack.production_split_2_wallet) wallets.add(sourceTrack.production_split_2_wallet);
        if (sourceTrack.production_split_3_wallet) wallets.add(sourceTrack.production_split_3_wallet);
      });

      if (wallets.size === 0) return;

      const names: Record<string, string> = {};

      // Look up each wallet in personas table first, then ai_agents, then user_profiles
      for (const wallet of wallets) {
        // Check personas table (for SUI addresses)
        const { data: personaData } = await supabase
          .from('personas')
          .select('username, display_name')
          .eq('wallet_address', wallet)
          .eq('is_active', true)
          .maybeSingle();

        if (personaData?.display_name || personaData?.username) {
          names[wallet] = personaData.display_name || personaData.username;
          continue;
        }

        // Check ai_agents table (for Creator's Agent wallets)
        const { data: agentData } = await supabase
          .from('ai_agents')
          .select('agent_name')
          .eq('agent_address', wallet)
          .eq('is_active', true)
          .maybeSingle();

        if (agentData?.agent_name) {
          // Use "Creator's Agent" as the display name for AI agents
          names[wallet] = "Creator's Agent";
          continue;
        }

        // Check user_profiles table (for legacy STX addresses)
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('username, display_name')
          .eq('wallet_address', wallet)
          .maybeSingle();

        if (profileData?.display_name || profileData?.username) {
          names[wallet] = profileData.display_name || profileData.username;
        }
      }

      setCollaboratorNames(names);
    };

    if (isOpen && (ipRights || sourceTracks.length > 0)) {
      lookupCollaboratorNames();
    }
  }, [isOpen, ipRights, sourceTracks]);

  // Fetch individual loops if this is a loop pack OR individual songs if this is an EP OR individual stations if this is a station pack
  useEffect(() => {
    if (isOpen && (track.content_type === 'loop_pack' || track.content_type === 'ep' || track.content_type === 'station_pack') && track.id) {
      setLoadingLoops(true);

      // For loop packs, EPs, and station packs, use the track's own ID to find individual items
      const packId = track.pack_id || track.id.split('-loc-')[0]; // Remove location suffix if present

      // Determine what content type to fetch
      const contentType = track.content_type === 'loop_pack' ? 'loop' : track.content_type === 'station_pack' ? 'radio_station' : 'full_song';

      supabase
        .from('ip_tracks')
        .select('*')
        .eq('pack_id', packId)
        .eq('content_type', contentType)
        .order('pack_position', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.error(`❌ Error fetching pack ${contentType}s:`, error);
          } else {
            setPackLoops(data || []);
          }
          setLoadingLoops(false);
        });
    } else {
      setPackLoops([]);
    }
  }, [isOpen, track.content_type, track.pack_id]);

  // Fetch source tracks for remixes
  useEffect(() => {
    const isRemix = track.remix_depth && track.remix_depth > 0;
    const hasLegacyIds = track.source_track_ids && track.source_track_ids.length > 0;
    const hasNewIds = track.parent_track_1_id || track.parent_track_2_id;

    if (isOpen && isRemix && (hasLegacyIds || hasNewIds)) {
      setLoadingSourceTracks(true);

      // Build list of source track IDs from either legacy or new fields
      let sourceIds: string[] = [];
      if (hasLegacyIds) {
        sourceIds = track.source_track_ids;
      } else if (hasNewIds) {
        // Use new parent fields
        if (track.parent_track_1_id) sourceIds.push(track.parent_track_1_id);
        if (track.parent_track_2_id) sourceIds.push(track.parent_track_2_id);
      }

      console.log('🔍 Fetching source tracks for remix:', {
        trackId: track.id,
        remixDepth: track.remix_depth,
        sourceIds
      });

      supabase
        .from('ip_tracks')
        .select(`
          id, title, artist, primary_uploader_wallet, locations,
          ai_assisted_idea, ai_assisted_implementation,
          composition_split_1_wallet, composition_split_1_percentage,
          composition_split_2_wallet, composition_split_2_percentage,
          composition_split_3_wallet, composition_split_3_percentage,
          production_split_1_wallet, production_split_1_percentage,
          production_split_2_wallet, production_split_2_percentage,
          production_split_3_wallet, production_split_3_percentage
        `)
        .in('id', sourceIds)
        .then(({ data, error }) => {
          if (error) {
            console.error('❌ Error fetching source tracks:', error);
          } else {
            console.log('✅ Fetched source tracks with IP splits:', data);
            setSourceTracks(data || []);
          }
          setLoadingSourceTracks(false);
        });
    } else {
      setSourceTracks([]);
    }
  }, [isOpen, track.remix_depth, track.source_track_ids, track.parent_track_1_id, track.parent_track_2_id]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  // Video playback function
  const handleVideoPlayPause = () => {
    if (!videoElement) return;

    if (isVideoPlaying) {
      // Pause video
      videoElement.pause();
      setIsVideoPlaying(false);
      if (videoTimeout) {
        clearTimeout(videoTimeout);
        setVideoTimeout(null);
      }
    } else {
      // Play video
      videoElement.play().catch(err => console.error('Video play error:', err));
      setIsVideoPlaying(true);

      // 20-second auto-stop
      const timeout = setTimeout(() => {
        videoElement.pause();
        setIsVideoPlaying(false);
      }, 20000);
      setVideoTimeout(timeout);
    }
  };

  // Audio playback functions for individual loops
  const handleLoopPlayPause = async (loop: IPTrack) => {
    const audioSource = loop.audio_url || loop.stream_url;
    if (!audioSource) return;

    const isRadioStation = loop.content_type === 'radio_station';

    // If clicking the same loop that's playing, pause it
    if (playingLoopId === loop.id && currentAudio) {
      currentAudio.pause();
      setPlayingLoopId(null);
      setCurrentAudio(null);
      if (previewTimeout) {
        clearTimeout(previewTimeout);
        setPreviewTimeout(null);
      }
      return;
    }

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      setCurrentAudio(null);
    }
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      setPreviewTimeout(null);
    }

    try {
      // Create and play new audio
      const audio = new Audio(audioSource);

      // Only set crossOrigin for regular tracks that need audio analysis
      // Radio stations don't need this and it causes CORS errors
      if (!isRadioStation) {
        audio.crossOrigin = 'anonymous';
      }

      await audio.play();
      setCurrentAudio(audio);
      setPlayingLoopId(loop.id);

      // 20-second preview timeout for ALL tracks (including radio stations)
      // Only the Radio Widget should play indefinitely
      const timeoutId = setTimeout(() => {
        audio.pause();
        setPlayingLoopId(null);
        setCurrentAudio(null);
      }, 20000);
      setPreviewTimeout(timeoutId);

      // Handle audio end (only for non-radio tracks)
      if (!isRadioStation) {
        audio.addEventListener('ended', () => {
          setPlayingLoopId(null);
          setCurrentAudio(null);
          if (previewTimeout) {
            clearTimeout(previewTimeout);
          }
        });
      }

    } catch (error) {
      console.error('Playback failed:', error);
    }
  };

  // Cleanup audio and video when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }
      if (videoElement) {
        videoElement.pause();
        setVideoElement(null);
      }
      if (videoTimeout) {
        clearTimeout(videoTimeout);
      }
      setPlayingLoopId(null);
      setIsVideoPlaying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Format helpers
  const getTrackType = () => {
    if (track.content_type === 'full_song') return 'Song';
    if (track.content_type === 'ep') return 'EP';
    if (track.content_type === 'loop') return '8-Bar Loop';
    if (track.content_type === 'mix') return 'Mix';
    if (track.content_type === 'loop_pack') return 'Loop Pack';
    if (track.content_type === 'radio_station') return 'Radio Station';
    if (track.content_type === 'station_pack') return 'Radio Station Pack';
    if (track.content_type === 'video_clip') return 'Video Clip';
    if (track.content_type === 'video_audio') return 'Video + Audio Remix';
    return 'Track';
  };

  // Check if this is a radio station (simplified modal)
  const isRadioStation = track.content_type === 'radio_station' || track.content_type === 'station_pack';

  const getGeneration = () => {
    // Only show generation for loops and mixes (not songs, EPs, etc.)
    if (track.content_type !== 'loop' && track.content_type !== 'mix') return null;

    if (track.remix_depth === 0) return '🌱 Original Seed';
    if (track.remix_depth === 1) return '🌿 Generation 1';
    if (track.remix_depth === 2) return '🌳 Generation 2';
    if (track.remix_depth && track.remix_depth > 2) return `🌳 Generation ${track.remix_depth}`;
    return null;
  };

  const getLicense = () => {
    // Check if track is protected from remixing
    const isRemixProtected = track.remix_protected || ipRights?.remix_protected;
    const allowsDownloads = track.allow_downloads || ipRights?.allow_downloads;

    if (isRemixProtected) {
      return allowsDownloads ? 'Streaming + Download Only' : 'Streaming Only';
    }
    return allowsDownloads ? 'Platform Remix + Download' : 'Platform Remix Only';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const formatWallet = (wallet: string) => {
    if (!wallet) return '';
    if (wallet.length > 20) {
      return `${wallet.slice(0, 8)}...${wallet.slice(-8)}`;
    }
    return wallet;
  };

  // Get collaborator display info - resolves name from pending: prefix, pending_collaborators table, or username lookup
  const getCollaboratorDisplay = (wallet: string, splitType: 'composition' | 'production', position: number): { name: string; isPending: boolean; isAI?: boolean } => {
    // Check if this is AI (for AI-assisted/generated content)
    if (wallet === 'AI') {
      return { name: '🤖 AI', isPending: false, isAI: true };
    }

    // Check if wallet has pending: prefix (name-only collaborator without wallet)
    if (wallet.startsWith('pending:')) {
      const name = wallet.replace('pending:', '');
      return { name, isPending: true };
    }

    // Check pending_collaborators table for this position
    const pendingCollab = pendingCollaborators.find(
      pc => pc.split_type === splitType && pc.split_position === position
    );
    if (pendingCollab) {
      return { name: pendingCollab.collaborator_name, isPending: pendingCollab.status === 'pending' };
    }

    // Check if we looked up a username/display_name for this wallet (includes primary uploader)
    if (collaboratorNames[wallet]) {
      return { name: collaboratorNames[wallet], isPending: false };
    }

    // Default: show truncated wallet (no name found)
    return { name: 'Collaborator', isPending: false };
  };

  // Create section divider
  const Divider = ({ title }: { title: string }) => (
    <div className="mb-3">
      <div className="text-gray-400 text-xs font-bold tracking-wider mb-1">{title}</div>
      <div className="border-b border-gray-700" style={{ borderBottomWidth: '1px' }}>
        <div className="h-px bg-gradient-to-r from-gray-600 to-transparent" />
      </div>
    </div>
  );

  // Donut chart component for IP splits
  const IPDonutChart = ({
    splits,
    title,
    size = 80
  }: {
    splits: Array<{ name: string; percentage: number; color: string }>;
    title: string;
    size?: number;
  }) => {
    const radius = 30;
    const strokeWidth = 12;
    const center = size / 2;
    const circumference = 2 * Math.PI * radius;

    // Calculate stroke dash offsets for each segment
    let currentOffset = 0;
    const segments = splits.map((split, index) => {
      const dashLength = (split.percentage / 100) * circumference;
      const segment = {
        ...split,
        dashArray: `${dashLength} ${circumference - dashLength}`,
        dashOffset: -currentOffset,
      };
      currentOffset += dashLength;
      return segment;
    });

    return (
      <div className="flex flex-col items-center">
        <div className="text-gray-400 text-xs font-semibold mb-2">{title}</div>
        <div className="flex items-center gap-3">
          {/* SVG Donut */}
          <svg width={size} height={size} className="transform -rotate-90">
            {segments.map((segment, index) => (
              <circle
                key={index}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={segment.dashArray}
                strokeDashoffset={segment.dashOffset}
                className="transition-all duration-300"
              />
            ))}
          </svg>

          {/* Legend */}
          <div className="flex flex-col gap-1 text-xs">
            {splits.map((split, index) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: split.color }}
                />
                <span className="text-gray-300 truncate max-w-[100px]">
                  {split.name}
                </span>
                <span className="text-gray-500">{split.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Colors for donut chart segments
  const CHART_COLORS = [
    '#81E4F2', // Cyan (remixer)
    '#A8E66B', // Lime green
    '#A084F9', // Lavender
    '#FFC044', // Golden amber
    '#FF6B9D', // Pink
    '#5BB5F9', // Sky blue
    '#E4E481', // Yellow
  ];

  // Get generation display for IP section header
  const getGenerationHeader = () => {
    const depth = track.remix_depth || 0;
    if (depth === 0) return { emoji: '🌱', text: 'GEN 0 - ORIGINAL' };
    if (depth === 1) return { emoji: '🌿', text: 'GEN 1 - REMIX' };
    if (depth === 2) return { emoji: '🌳', text: 'GEN 2 - REMIX' };
    return { emoji: '🌳', text: `GEN ${depth} - REMIX` };
  };

  // Check if a wallet belongs to an AI agent
  const isAIAgent = (wallet: string): boolean => {
    if (!wallet) return false;
    // Check if this wallet was identified as an AI agent in our lookup
    return collaboratorNames[wallet] === "Creator's Agent";
  };

  // Build Idea splits for donut chart (humans only, 100% total)
  const buildIdeaSplits = (): { splits: Array<{ name: string; percentage: number; color: string }>; aiContribution: number } => {
    const rawSplits: Array<{ name: string; percentage: number; isAI: boolean }> = [];
    let aiContribution = 0;
    const isRemix = track.remix_depth && track.remix_depth > 0;

    if (isRemix) {
      // Remixer gets 10% - look up persona name from wallet
      const remixerName = collaboratorNames[track.primary_uploader_wallet] || track.artist || 'Remixer';
      rawSplits.push({
        name: remixerName,
        percentage: PRICING.remix.remixerStakePercent,
        isAI: false,
      });

      // Remaining 90% split among source tracks' composition holders
      const remainingPercent = 100 - PRICING.remix.remixerStakePercent;
      const perTrackPercent = sourceTracks.length > 0 ? remainingPercent / sourceTracks.length : 0;

      sourceTracks.forEach((sourceTrack) => {
        // Get composition splits from source track
        const compSplits = [];
        if (sourceTrack.composition_split_1_wallet && sourceTrack.composition_split_1_percentage) {
          compSplits.push({ wallet: sourceTrack.composition_split_1_wallet, percentage: sourceTrack.composition_split_1_percentage });
        }
        if (sourceTrack.composition_split_2_wallet && sourceTrack.composition_split_2_percentage) {
          compSplits.push({ wallet: sourceTrack.composition_split_2_wallet, percentage: sourceTrack.composition_split_2_percentage });
        }
        if (sourceTrack.composition_split_3_wallet && sourceTrack.composition_split_3_percentage) {
          compSplits.push({ wallet: sourceTrack.composition_split_3_wallet, percentage: sourceTrack.composition_split_3_percentage });
        }

        if (compSplits.length === 0) {
          // No splits defined - attribute to track's primary uploader
          // Use artist name as fallback if wallet lookup fails
          const uploaderName = collaboratorNames[sourceTrack.primary_uploader_wallet] || sourceTrack.artist || sourceTrack.title || 'Unknown';
          rawSplits.push({
            name: uploaderName,
            percentage: perTrackPercent,
            isAI: false,
          });
        } else {
          // Distribute this track's share among its composition holders
          compSplits.forEach((split) => {
            const holderPercent = (split.percentage / 100) * perTrackPercent;
            const isAI = isAIAgent(split.wallet);
            // Use artist name as fallback if wallet lookup fails
            const name = collaboratorNames[split.wallet] || sourceTrack.artist || sourceTrack.title || 'Unknown';

            if (isAI) {
              aiContribution += holderPercent;
            }

            rawSplits.push({
              name,
              percentage: holderPercent,
              isAI,
            });
          });
        }
      });
    } else {
      // Gen 0: Just use the track's own composition splits
      if (ipRights && ipRights.composition_splits.length > 0) {
        ipRights.composition_splits.forEach((split, index) => {
          const { name, isAI } = getCollaboratorDisplay(split.wallet, 'composition', index + 1);

          if (isAI) {
            aiContribution += split.percentage;
          }

          rawSplits.push({
            name,
            percentage: split.percentage,
            isAI: isAI || false,
          });
        });
      }
    }

    // Filter out AI and recalculate percentages to total 100%
    const humanSplits = rawSplits.filter(s => !s.isAI);
    const humanTotal = humanSplits.reduce((sum, s) => sum + s.percentage, 0);

    // Merge splits with same name and normalize to 100%
    const mergedMap = new Map<string, number>();
    humanSplits.forEach(split => {
      const normalized = humanTotal > 0 ? (split.percentage / humanTotal) * 100 : 0;
      mergedMap.set(split.name, (mergedMap.get(split.name) || 0) + normalized);
    });

    // Round percentages and ensure they total exactly 100%
    const entries = Array.from(mergedMap.entries());
    const rounded = entries.map(([name, pct]) => ({ name, percentage: Math.round(pct) }));
    const roundedTotal = rounded.reduce((sum, s) => sum + s.percentage, 0);
    const diff = 100 - roundedTotal;

    // Adjust the largest slice to make up the difference
    if (diff !== 0 && rounded.length > 0) {
      const largestIdx = rounded.reduce((maxIdx, s, idx, arr) =>
        s.percentage > arr[maxIdx].percentage ? idx : maxIdx, 0);
      rounded[largestIdx].percentage += diff;
    }

    const splits = rounded.map((s, index) => ({
      name: s.name,
      percentage: s.percentage,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

    return { splits, aiContribution };
  };

  // Build Implementation splits for donut chart (humans only, 100% total)
  const buildImplementationSplits = (): { splits: Array<{ name: string; percentage: number; color: string }>; aiContribution: number } => {
    const rawSplits: Array<{ name: string; percentage: number; isAI: boolean }> = [];
    let aiContribution = 0;
    const isRemix = track.remix_depth && track.remix_depth > 0;

    if (isRemix) {
      // Remixer gets 10% - look up persona name from wallet
      const remixerName = collaboratorNames[track.primary_uploader_wallet] || track.artist || 'Remixer';
      rawSplits.push({
        name: remixerName,
        percentage: PRICING.remix.remixerStakePercent,
        isAI: false,
      });

      // Remaining 90% split among source tracks' production holders
      const remainingPercent = 100 - PRICING.remix.remixerStakePercent;
      const perTrackPercent = sourceTracks.length > 0 ? remainingPercent / sourceTracks.length : 0;

      sourceTracks.forEach((sourceTrack) => {
        // Get production splits from source track
        const prodSplits = [];
        if (sourceTrack.production_split_1_wallet && sourceTrack.production_split_1_percentage) {
          prodSplits.push({ wallet: sourceTrack.production_split_1_wallet, percentage: sourceTrack.production_split_1_percentage });
        }
        if (sourceTrack.production_split_2_wallet && sourceTrack.production_split_2_percentage) {
          prodSplits.push({ wallet: sourceTrack.production_split_2_wallet, percentage: sourceTrack.production_split_2_percentage });
        }
        if (sourceTrack.production_split_3_wallet && sourceTrack.production_split_3_percentage) {
          prodSplits.push({ wallet: sourceTrack.production_split_3_wallet, percentage: sourceTrack.production_split_3_percentage });
        }

        if (prodSplits.length === 0) {
          // No splits defined - attribute to track's primary uploader
          // Use artist name as fallback if wallet lookup fails
          const uploaderName = collaboratorNames[sourceTrack.primary_uploader_wallet] || sourceTrack.artist || sourceTrack.title || 'Unknown';
          rawSplits.push({
            name: uploaderName,
            percentage: perTrackPercent,
            isAI: false,
          });
        } else {
          // Distribute this track's share among its production holders
          prodSplits.forEach((split) => {
            const holderPercent = (split.percentage / 100) * perTrackPercent;
            const isAI = isAIAgent(split.wallet);
            // Use artist name as fallback if wallet lookup fails
            const name = collaboratorNames[split.wallet] || sourceTrack.artist || sourceTrack.title || 'Unknown';

            if (isAI) {
              aiContribution += holderPercent;
            }

            rawSplits.push({
              name,
              percentage: holderPercent,
              isAI,
            });
          });
        }
      });
    } else {
      // Gen 0: Just use the track's own production splits
      if (ipRights && ipRights.production_splits.length > 0) {
        ipRights.production_splits.forEach((split, index) => {
          const { name, isAI } = getCollaboratorDisplay(split.wallet, 'production', index + 1);

          if (isAI) {
            aiContribution += split.percentage;
          }

          rawSplits.push({
            name,
            percentage: split.percentage,
            isAI: isAI || false,
          });
        });
      }
    }

    // Filter out AI and recalculate percentages to total 100%
    const humanSplits = rawSplits.filter(s => !s.isAI);
    const humanTotal = humanSplits.reduce((sum, s) => sum + s.percentage, 0);

    // Merge splits with same name and normalize to 100%
    const mergedMap = new Map<string, number>();
    humanSplits.forEach(split => {
      const normalized = humanTotal > 0 ? (split.percentage / humanTotal) * 100 : 0;
      mergedMap.set(split.name, (mergedMap.get(split.name) || 0) + normalized);
    });

    // Round percentages and ensure they total exactly 100%
    const entries = Array.from(mergedMap.entries());
    const rounded = entries.map(([name, pct]) => ({ name, percentage: Math.round(pct) }));
    const roundedTotal = rounded.reduce((sum, s) => sum + s.percentage, 0);
    const diff = 100 - roundedTotal;

    // Adjust the largest slice to make up the difference
    if (diff !== 0 && rounded.length > 0) {
      const largestIdx = rounded.reduce((maxIdx, s, idx, arr) =>
        s.percentage > arr[maxIdx].percentage ? idx : maxIdx, 0);
      rounded[largestIdx].percentage += diff;
    }

    const splits = rounded.map((s, index) => ({
      name: s.name,
      percentage: s.percentage,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));

    return { splits, aiContribution };
  };

  // Aggregate unique locations from source tracks (for remixes)
  // Locations can be strings or objects with {lat, lng, name}
  const getAggregatedLocations = (): string[] => {
    const allLocations = new Set<string>();

    // Helper to extract location name from string or object
    const extractLocationName = (loc: any): string | null => {
      if (typeof loc === 'string') return loc;
      if (loc && typeof loc === 'object' && loc.name) return loc.name;
      return null;
    };

    // Add current track's locations
    if (track.locations && Array.isArray(track.locations)) {
      track.locations.forEach(loc => {
        const name = extractLocationName(loc);
        if (name) allLocations.add(name);
      });
    }

    // Add source tracks' locations (for remixes)
    sourceTracks.forEach(sourceTrack => {
      if (sourceTrack.locations && Array.isArray(sourceTrack.locations)) {
        sourceTrack.locations.forEach((loc: any) => {
          const name = extractLocationName(loc);
          if (name) allLocations.add(name);
        });
      }
    });

    return Array.from(allLocations);
  };

  // Check if any source tracks have AI assistance (for inheritance)
  const getSourceAIFlags = (): { hasAIIdea: boolean; hasAIImplementation: boolean; aiSources: string[] } => {
    const aiSources: string[] = [];
    let hasAIIdea = false;
    let hasAIImplementation = false;

    sourceTracks.forEach(sourceTrack => {
      if (sourceTrack.ai_assisted_idea) {
        hasAIIdea = true;
        aiSources.push(sourceTrack.title);
      }
      if (sourceTrack.ai_assisted_implementation) {
        hasAIImplementation = true;
        if (!aiSources.includes(sourceTrack.title)) {
          aiSources.push(sourceTrack.title);
        }
      }
    });

    return { hasAIIdea, hasAIImplementation, aiSources };
  };

  // Calculate TING attribution for AI-assisted content (including inherited from sources)
  const getTingAttribution = () => {
    const { aiContribution: ideaAI } = buildIdeaSplits();
    const { aiContribution: implAI } = buildImplementationSplits();
    const { hasAIIdea, hasAIImplementation, aiSources } = getSourceAIFlags();

    // Check if current track or any source has AI involvement
    const currentHasAI = track.ai_assisted_idea || track.ai_assisted_implementation;
    const sourcesHaveAI = hasAIIdea || hasAIImplementation;

    if (!currentHasAI && !sourcesHaveAI && ideaAI <= 0 && implAI <= 0) {
      return null;
    }

    // For remixes with AI sources, calculate TING based on their contribution
    // Each AI-assisted source track contributes proportionally
    let tingAmount = '0.00';
    if (sourcesHaveAI && sourceTracks.length > 0) {
      // AI sources get their share of the 90% creators cut
      const aiSourceCount = aiSources.length;
      const perSourcePercent = 90 / sourceTracks.length;
      const aiPercent = aiSourceCount * perSourcePercent;
      tingAmount = (aiPercent / 100).toFixed(2);
    } else if (ideaAI > 0 || implAI > 0) {
      tingAmount = ((ideaAI + implAI) / 100).toFixed(2);
    }

    // Get the persona name for the remixer
    const remixerName = collaboratorNames[track.primary_uploader_wallet] || track.artist || 'Creator';

    return {
      amount: tingAmount,
      agentName: "Creator's Agent",
      personaName: remixerName,
      aiSources: aiSources.length > 0 ? aiSources : undefined,
    };
  };

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div 
        className="relative z-10 bg-slate-900 rounded-lg w-full max-w-[320px] max-h-[70vh] overflow-hidden shadow-2xl border border-gray-800"
        style={{ fontFamily: 'monospace' }}
      >
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-white text-sm font-bold tracking-wider">TRACK DETAILS</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(70vh-120px)] p-6 space-y-4">

          {/* Track Title and Artist/Generation - Top Section */}
          <div className="mb-4">
            {track.primary_uploader_wallet ? (
              <Link
                href={username ? `/store/${username}` : `/store/${track.primary_uploader_wallet}`}
                className="font-bold text-white text-lg leading-tight hover:text-[#81E4F2] transition-colors block mb-1"
              >
                {track.title}
              </Link>
            ) : (
              <h3 className="font-bold text-white text-lg leading-tight mb-1">{track.title}</h3>
            )}
            {/* For remixes, show generation info with creator. For originals, show artist name */}
            {track.remix_depth && track.remix_depth > 0 ? (
              <p className="text-gray-400 text-sm">
                {(() => {
                  const gen = getGenerationHeader();
                  const remixerName = collaboratorNames[track.primary_uploader_wallet] || track.artist || 'Unknown';
                  return (
                    <>
                      {gen.emoji} Gen {track.remix_depth} Remix by{' '}
                      <Link
                        href={username ? `/profile/${username}` : `/profile/${track.primary_uploader_wallet}`}
                        className="text-[#81E4F2] hover:underline"
                      >
                        {remixerName}
                      </Link>
                    </>
                  );
                })()}
              </p>
            ) : track.primary_uploader_wallet ? (
              <Link
                href={username ? `/profile/${username}` : `/profile/${track.primary_uploader_wallet}`}
                className="text-gray-400 text-sm hover:text-[#81E4F2] transition-colors"
              >
                {track.artist}
              </Link>
            ) : (
              <p className="text-gray-400 text-sm">{track.artist}</p>
            )}
          </div>

          {/* Video Player Section - For Video Clips Only */}
          {track.content_type === 'video_clip' && (track as any).video_url && (
            <div className="mb-6">
              <Divider title="VIDEO PLAYER" />
              <div className="relative w-full bg-black rounded-lg overflow-hidden border-2 border-[#5BB5F9]">
                {/* Video Element */}
                <video
                  ref={(el) => setVideoElement(el)}
                  src={(track as any).video_url}
                  className="w-full"
                  style={{ aspectRatio: '16/9' }}
                  muted
                  playsInline
                  onEnded={() => {
                    setIsVideoPlaying(false);
                    if (videoTimeout) {
                      clearTimeout(videoTimeout);
                      setVideoTimeout(null);
                    }
                  }}
                />

                {/* Play/Pause Overlay Button */}
                {!isVideoPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <button
                      onClick={handleVideoPlayPause}
                      className="w-16 h-16 rounded-full bg-[#5BB5F9] hover:bg-[#5BB5F9]/80 flex items-center justify-center transition-all hover:scale-110"
                      title="Play video"
                    >
                      <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  </div>
                )}

                {/* Control Bar - Always visible when playing */}
                {isVideoPlaying && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={handleVideoPlayPause}
                        className="w-10 h-10 rounded-full bg-[#5BB5F9] hover:bg-[#5BB5F9]/80 flex items-center justify-center transition-all"
                        title="Pause video"
                      >
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Individual Loops Section - For Loop Packs Only */}
          {track.content_type === 'loop_pack' && (
            <div>
              <Divider title="INDIVIDUAL LOOPS" />
              {loadingLoops ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                  Loading loops...
                </div>
              ) : packLoops.length > 0 ? (
                <div className="space-y-2">
                  {packLoops.map((loop, index) => (
                    <DraggableModalTrack key={loop.id} track={loop}>
                      <div 
                        className="group flex items-center gap-3 p-2 bg-slate-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors cursor-grab"
                      >
                      {/* Loop Number */}
                      <div className="flex-shrink-0 w-6 h-6 rounded text-white text-xs font-bold flex items-center justify-center" style={{backgroundColor: '#A084F9'}}>
                        {index + 1}
                      </div>
                      
                      {/* Loop Name */}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 text-xs font-medium truncate">
                          {loop.title || `Loop ${index + 1}`}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {loop.bpm || '~'} BPM
                        </div>
                      </div>
                      
                      {/* Drag Handle - appears on hover */}
                      <div 
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all cursor-grab"
                        title="Drag to Crate or Mixer"
                      >
                        <GripVertical className="w-3 h-3 text-gray-400 hover:text-white" />
                      </div>
                      
                      {/* Play/Pause Button */}
                      <button
                        onClick={() => handleLoopPlayPause(loop)}
                        disabled={!loop.audio_url}
                        className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center transition-colors disabled:bg-gray-700"
                        style={{
                          backgroundColor: loop.audio_url ? '#A084F9' : '#374151',
                          opacity: playingLoopId === loop.id ? 0.8 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (loop.audio_url) {
                            (e.target as HTMLElement).style.opacity = '0.8';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (loop.audio_url) {
                            (e.target as HTMLElement).style.opacity = playingLoopId === loop.id ? '0.8' : '1';
                          }
                        }}
                        title={
                          !loop.audio_url 
                            ? 'Audio not available'
                            : playingLoopId === loop.id 
                              ? `Pause ${loop.title}` 
                              : `Play ${loop.title}`
                        }
                      >
                        {playingLoopId === loop.id ? (
                          // Pause icon
                          <svg 
                            className="w-3 h-3 text-white" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                          </svg>
                        ) : (
                          // Play icon  
                          <svg 
                            className="w-3 h-3 text-white ml-0.5" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4v12l10-6z" />
                          </svg>
                        )}
                      </button>
                      </div>
                    </DraggableModalTrack>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  No individual loops found for this pack
                </div>
              )}
            </div>
          )}

          {/* Individual Songs Section - For EPs Only */}
          {track.content_type === 'ep' && (
            <div>
              <Divider title="INDIVIDUAL SONGS" />
              {loadingLoops ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                  Loading songs...
                </div>
              ) : packLoops.length > 0 ? (
                <div className="space-y-2">
                  {packLoops.map((song, index) => (
                    <DraggableModalTrack key={song.id} track={song}>
                      <div
                        className="group flex items-center gap-3 p-2 bg-slate-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors cursor-grab"
                      >
                      {/* Song Number */}
                      <div className="flex-shrink-0 w-6 h-6 bg-[#A8E66B] text-slate-900 rounded text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </div>
                      
                      {/* Song Name */}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 text-xs font-medium truncate">
                          {song.title || `Song ${index + 1}`}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {song.bpm ? `${song.bpm} BPM` : ''}{song.bpm && song.duration ? ' · ' : ''}{song.duration ? formatDuration(song.duration) : ''}
                        </div>
                      </div>

                      {/* Drag Handle - appears on hover */}
                      <div
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all cursor-grab"
                        title="Drag to Crate or Mixer"
                      >
                        <GripVertical className="w-3 h-3 text-gray-400 hover:text-white" />
                      </div>

                      {/* Play/Pause Button */}
                      <button
                        onClick={() => handleLoopPlayPause(song)}
                        disabled={!song.audio_url}
                        className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center transition-colors ${
                          playingLoopId === song.id
                            ? 'bg-[#A8E66B] hover:bg-[#A8E66B]/80 text-slate-900'
                            : 'bg-[#A8E66B] hover:bg-[#A8E66B]/80 text-slate-900'
                        } disabled:bg-gray-700`}
                        title={
                          !song.audio_url 
                            ? 'Audio not available'
                            : playingLoopId === song.id 
                              ? `Pause ${song.title}` 
                              : `Play ${song.title}`
                        }
                      >
                        {playingLoopId === song.id ? (
                          // Pause icon
                          <svg 
                            className="w-3 h-3" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                          </svg>
                        ) : (
                          // Play icon  
                          <svg 
                            className="w-3 h-3 ml-0.5" 
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4v12l10-6z" />
                          </svg>
                        )}
                      </button>
                      </div>
                    </DraggableModalTrack>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  No individual songs found for this EP
                </div>
              )}
            </div>
          )}

          {/* Individual Stations Section - For Station Packs Only */}
          {track.content_type === 'station_pack' && (
            <div>
              <Divider title="INDIVIDUAL STATIONS" />
              {loadingLoops ? (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border border-gray-500 border-t-transparent"></div>
                  Loading stations...
                </div>
              ) : packLoops.length > 0 ? (
                <div className="space-y-2">
                  {packLoops.map((station, index) => (
                    <DraggableModalTrack key={station.id} track={station}>
                      <div
                        className="group flex items-center gap-3 p-2 bg-slate-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors cursor-grab"
                      >
                      {/* Station Number */}
                      <div className="flex-shrink-0 w-6 h-6 rounded text-white text-xs font-bold flex items-center justify-center" style={{backgroundColor: '#FFC044'}}>
                        {index + 1}
                      </div>

                      {/* Station Name */}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-300 text-xs font-medium truncate">
                          {station.title || `Station ${index + 1}`}
                        </div>
                        {station.artist && (
                          <div className="text-gray-500 text-xs truncate">
                            {station.artist}
                          </div>
                        )}
                      </div>

                      {/* Drag Handle - appears on hover */}
                      <div
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-600 rounded transition-all cursor-grab"
                        title="Drag to Radio Widget"
                      >
                        <GripVertical className="w-3 h-3 text-gray-400 hover:text-white" />
                      </div>

                      {/* Play/Pause Button */}
                      <button
                        onClick={() => handleLoopPlayPause(station)}
                        disabled={!station.stream_url}
                        className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center transition-colors disabled:bg-gray-700"
                        style={{
                          backgroundColor: station.stream_url ? '#FFC044' : '#374151',
                          opacity: playingLoopId === station.id ? 0.8 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (station.stream_url) {
                            (e.target as HTMLElement).style.opacity = '0.8';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (station.stream_url) {
                            (e.target as HTMLElement).style.opacity = playingLoopId === station.id ? '0.8' : '1';
                          }
                        }}
                        title={
                          !station.stream_url
                            ? 'Stream not available'
                            : playingLoopId === station.id
                              ? `Pause ${station.title}`
                              : `Play ${station.title}`
                        }
                      >
                        {playingLoopId === station.id ? (
                          // Pause icon
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4h3v12H5V4zm7 0h3v12h-3V4z" />
                          </svg>
                        ) : (
                          // Play icon
                          <svg
                            className="w-3 h-3 text-white ml-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M5 4v12l10-6z" />
                          </svg>
                        )}
                      </button>
                      </div>
                    </DraggableModalTrack>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500">
                  No individual stations found for this pack
                </div>
              )}
            </div>
          )}

          {/* Price and License - moved here for better flow - Skip for radio stations */}
          {!isRadioStation && (
          <div>
            <Divider title="PRICE AND LICENSE" />
            <div className="space-y-1 text-xs">
              <div className="flex">
                <span className="text-gray-500 w-24">License:</span>
                <span className={`${(track.remix_protected || ipRights?.remix_protected) ? 'text-amber-300' : 'text-gray-300'}`}>
                  {getLicense()}
                </span>
              </div>
              {track.content_type === 'loop_pack' ? (
                <>
                  {ipRights?.allow_downloads && ipRights?.download_price_usdc !== null ? (
                    // Downloadable pack: Show total pack price and per-loop price
                    // Use child record price as per-item (always stores per-item regardless of creation path)
                    (() => {
                      const perLoopPrice = packLoops[0]?.download_price_usdc ?? packLoops[0]?.download_price_stx ?? ipRights.download_price_usdc;
                      const totalPrice = perLoopPrice * (packLoops.length || 1);
                      return (
                        <>
                          <div className="flex">
                            <span className="text-gray-500 w-24">Download:</span>
                            <span className="text-gray-300">${totalPrice.toFixed(2)} USDC (full pack)</span>
                          </div>
                          {packLoops.length > 1 && (
                            <div className="flex">
                              <span className="text-gray-500 w-24">Per loop:</span>
                              <span className="text-gray-300">${perLoopPrice} USDC</span>
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    // Remix-only pack: Show per-loop remix price
                    <div className="flex">
                      <span className="text-gray-500 w-24">Remix Fee:</span>
                      <span className="text-gray-300">${PRICING.mixer.loopRecording} USDC per loop</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="text-gray-500 w-24">Loops:</span>
                    <span className="text-gray-300">{packLoops.length || '?'} loops in pack</span>
                  </div>
                </>
              ) : track.content_type === 'loop' ? (
                // Loops: Show different pricing based on allow_downloads
                <>
                  {ipRights?.allow_downloads && ipRights?.download_price_usdc !== null ? (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Download:</span>
                      <span className="text-gray-300">${ipRights.download_price_usdc} USDC</span>
                    </div>
                  ) : (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Remix Fee:</span>
                      <span className="text-gray-300">${PRICING.mixer.loopRecording} USDC per mix</span>
                    </div>
                  )}
                </>
              ) : track.content_type === 'ep' ? (
                // EPs: Show total EP price and per-song price
                // Use child record price as per-item (always stores per-item regardless of creation path)
                <>
                  {ipRights?.allow_downloads && ipRights?.download_price_usdc !== null ? (
                    (() => {
                      const perSongPrice = packLoops[0]?.download_price_usdc ?? packLoops[0]?.download_price_stx ?? ipRights.download_price_usdc;
                      const totalEPPrice = perSongPrice * (packLoops.length || 1);
                      return (
                        <>
                          <div className="flex">
                            <span className="text-gray-500 w-24">Download:</span>
                            <span className="text-gray-300">${totalEPPrice.toFixed(2)} USDC (full EP)</span>
                          </div>
                          {packLoops.length > 1 && (
                            <div className="flex">
                              <span className="text-gray-500 w-24">Per song:</span>
                              <span className="text-gray-300">${perSongPrice} USDC</span>
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Downloads:</span>
                      <span className="text-gray-400">Not available</span>
                    </div>
                  )}
                  <div className="flex">
                    <span className="text-gray-500 w-24">Songs:</span>
                    <span className="text-gray-300">{packLoops.length || '?'} songs in EP</span>
                  </div>
                </>
              ) : (
                // Songs: Only show download price if downloads are enabled
                ipRights?.allow_downloads && ipRights?.download_price_usdc !== null ? (
                  <div className="flex">
                    <span className="text-gray-500 w-24">Download:</span>
                    <span className="text-gray-300">${ipRights.download_price_usdc} USDC</span>
                  </div>
                ) : (
                  <div className="flex">
                    <span className="text-gray-500 w-24">Downloads:</span>
                    <span className="text-gray-400">Not available</span>
                  </div>
                )
              )}
              {track.open_to_commercial && (
                <div className="flex">
                  <span className="text-gray-500 w-24">Commercial:</span>
                  <span className="text-green-400">
                    ✓ {track.collab_contact_fee ? `(Contact: $${track.collab_contact_fee} USDC)` : ''}
                  </span>
                </div>
              )}
              {track.open_to_collaboration && (
                <div className="flex">
                  <span className="text-gray-500 w-24">Collaboration:</span>
                  <span className="text-green-400">
                    ✓ {track.collab_contact_fee ? `(Contact: $${track.collab_contact_fee} USDC)` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Basic Info */}
          <div>
            <Divider title="BASIC INFO" />
            <div className="space-y-1 text-xs">
              <div className="flex">
                <span className="text-gray-500 w-24">{isRadioStation ? 'Station:' : 'Title:'}</span>
                <span className="text-gray-300">{track.title}</span>
              </div>
              {!isRadioStation && (
                <div className="flex">
                  <span className="text-gray-500 w-24">{track.remix_depth && track.remix_depth > 0 ? 'Remixer:' : 'Artist:'}</span>
                  <span className="text-gray-300">
                    {/* Use persona name lookup for remixer, fall back to track.artist */}
                    {collaboratorNames[track.primary_uploader_wallet] || track.artist}
                  </span>
                </div>
              )}
              <div className="flex">
                <span className="text-gray-500 w-24">Type:</span>
                <span className="text-gray-300">{getTrackType()}</span>
              </div>
              {isRadioStation && (
                <>
                  <div className="flex">
                    <span className="text-gray-500 w-24">Status:</span>
                    <span className="text-[#FFC044] font-bold">🔴 LIVE</span>
                  </div>
                  {track.genre && (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Genre:</span>
                      <span className="text-gray-300">{track.genre}</span>
                    </div>
                  )}
                  {track.location && (
                    <div className="flex">
                      <span className="text-gray-500 w-24">Location:</span>
                      <span className="text-gray-300">{track.location}</span>
                    </div>
                  )}
                  {track.description && (
                    <div className="flex flex-col">
                      <span className="text-gray-500 mb-1">Description:</span>
                      <span className="text-gray-300 text-xs leading-relaxed">{track.description}</span>
                    </div>
                  )}
                </>
              )}
              {/* AI Assistance Display - Only for non-radio content */}
              {!isRadioStation && (
                <div className="flex">
                  <span className="text-gray-500 w-24">Creation:</span>
                  <span className="text-gray-300">
                    {(() => {
                      const aiDisplay = getAIAssistanceDisplay(track);
                      return `${aiDisplay.emoji} ${aiDisplay.text}`;
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Derived From - Shows where this content came from (NOT remixes) */}
          {derivedFromTrack && (
            <div>
              <Divider title="DERIVED FROM" />
              <div className="p-2 bg-slate-800/50 rounded border border-gray-700">
                <div className="text-xs text-gray-400 mb-1">This content was extracted from:</div>
                <Link
                  href={`/store/${track.primary_uploader_wallet}`}
                  className="text-[#81E4F2] hover:underline text-sm font-medium"
                >
                  {derivedFromTrack.title}
                </Link>
                <div className="text-gray-500 text-xs">by {derivedFromTrack.artist}</div>
              </div>
            </div>
          )}


          {/* Tags (including location tags) */}
          {track.tags && track.tags.length > 0 && (
            <div>
              <Divider title="TAGS" />
              <div className="flex flex-wrap gap-1">
                {track.tags.map((tag, index) => (
                  <span
                    key={index}
                    className={`px-2 py-1 rounded text-xs ${
                      tag.startsWith('🌍')
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-gray-300'
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Aggregated Locations (for remixes, includes source track locations) */}
          {(() => {
            const locations = getAggregatedLocations();
            return locations.length > 0 && (
              <div>
                <Divider title="LOCATIONS" />
                <div className="flex flex-wrap gap-1">
                  {locations.map((location, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 rounded text-xs bg-blue-600 text-white"
                    >
                      🌍 {location}
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Metadata - Hide BPM/Key for EPs since multiple songs have different values - Skip for radio stations */}
          {(track.bpm || track.key || track.duration) && track.content_type !== 'ep' && !isRadioStation && (
            <div>
              <Divider title="METADATA" />
              <div className="space-y-1 text-xs">
                {track.content_type !== 'ep' && track.content_type !== 'radio_station' && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">BPM:</span>
                    <span className="text-gray-300">{track.bpm || '~'}</span>
                  </div>
                )}
                {track.key && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">Key:</span>
                    <span className="text-gray-300">{track.key}</span>
                  </div>
                )}
                {track.duration && (
                  <div className="flex">
                    <span className="text-gray-500 w-24">Duration:</span>
                    <span className="text-gray-300">{formatDuration(track.duration)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* EP-Specific Metadata - Show duration only, no BPM/Key */}
          {track.content_type === 'ep' && track.duration && (
            <div>
              <Divider title="METADATA" />
              <div className="space-y-1 text-xs">
                <div className="flex">
                  <span className="text-gray-500 w-24">Total Duration:</span>
                  <span className="text-gray-300">{formatDuration(track.duration)}</span>
                </div>
              </div>
            </div>
          )}


          {/* Description - Skip for radio stations (already shown in BASIC INFO) */}
          {track.description && !isRadioStation && (
            <div>
              <Divider title="DESCRIPTION" />
              <p className="text-xs text-gray-300 leading-relaxed">
                {track.description}
              </p>
            </div>
          )}

          {/* Notes & Credits */}
          {(track.tell_us_more || track.notes || ipRights?.notes) && (
            <div>
              <Divider title="NOTES & CREDITS" />
              <p className="text-xs text-gray-300 leading-relaxed">
                {track.tell_us_more || track.notes || ipRights?.notes}
              </p>
            </div>
          )}


          {/* IP Rights - Skip for radio stations */}
          {!isRadioStation && (
          <div>
            {/* Generation Header */}
            {(() => {
              const gen = getGenerationHeader();
              return (
                <Divider title={`${gen.emoji} ${gen.text}`} />
              );
            })()}

            {/* Source Tracks - For Remixes Only (moved here, before donut charts) */}
            {track.remix_depth && track.remix_depth > 0 && sourceTracks.length > 0 && (
              <div className="mb-4">
                <div className="text-gray-400 text-xs font-semibold mb-2">SOURCE MATERIAL</div>
                <div className="space-y-1">
                  {sourceTracks.map((sourceTrack) => (
                    <Link
                      key={sourceTrack.id}
                      href={`/store/${sourceTrack.primary_uploader_wallet}`}
                      className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      <span>→</span>
                      <span className="truncate">{sourceTrack.title}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Donut Charts for IP Splits */}
            <div className="flex flex-col gap-4">
              {/* Idea Donut */}
              {(() => {
                const { splits: ideaSplits } = buildIdeaSplits();
                return ideaSplits.length > 0 ? (
                  <IPDonutChart
                    splits={ideaSplits}
                    title={track.content_type === 'video_clip' ? 'IDEA' : 'IDEA (Composition)'}
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-gray-400 text-xs font-semibold mb-2">
                      {track.content_type === 'video_clip' ? 'IDEA' : 'IDEA (Composition)'}
                    </div>
                    <div className="text-gray-500 text-xs">No splits defined</div>
                  </div>
                );
              })()}

              {/* Implementation Donut */}
              {(() => {
                const { splits: implSplits } = buildImplementationSplits();
                return implSplits.length > 0 ? (
                  <IPDonutChart
                    splits={implSplits}
                    title={track.content_type === 'video_clip' ? 'IMPLEMENTATION' : 'IMPLEMENTATION (Recording)'}
                  />
                ) : (
                  <div className="text-center">
                    <div className="text-gray-400 text-xs font-semibold mb-2">
                      {track.content_type === 'video_clip' ? 'IMPLEMENTATION' : 'IMPLEMENTATION (Recording)'}
                    </div>
                    <div className="text-gray-500 text-xs">No splits defined</div>
                  </div>
                );
              })()}
            </div>

            {/* TING Attribution for AI-assisted content */}
            {(() => {
              const tingAttr = getTingAttribution();
              return tingAttr ? (
                <div className="mt-3 pt-3 border-t border-gray-700/50">
                  <div className="text-xs text-gray-500">
                    <div className="flex items-center gap-1 mb-1">
                      <span>🤖</span>
                      <span>{tingAttr.amount} TING → {tingAttr.agentName}</span>
                    </div>
                    {tingAttr.aiSources && tingAttr.aiSources.length > 0 ? (
                      <div className="text-gray-600 ml-5">
                        AI-assisted sources: {tingAttr.aiSources.join(', ')}
                      </div>
                    ) : (
                      <div className="text-gray-600 ml-5">
                        (visual by {tingAttr.personaName})
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}
          </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;
}