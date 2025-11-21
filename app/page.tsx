"use client";

import React, { useState, useEffect } from "react";
import dynamic from 'next/dynamic';
// Alpha app - no complex auth needed for globe viewing
import Header from "@/components/layout/Header";
import { TrackNode } from "@/components/globe/types";
import { IPTrack } from "@/types";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Globe as GlobeIcon, Headphones, X, ChevronDown, ChevronUp, Layers } from "lucide-react";
import { fetchGlobeTracksFromSupabase, fallbackGlobeNodes } from "@/lib/globeDataSupabase";
import { supabase } from "@/lib/supabase";
import { createLocationClusters, expandCluster, isClusterNode, ClusterNode } from "@/lib/globe/simpleCluster";
import Crate from "@/components/shared/Crate";
import WidgetLauncher from "@/components/WidgetLauncher";
import ResetConfirmModal from "@/components/modals/ResetConfirmModal";


// Dynamically import GlobeTrackCard to avoid SSR issues
const GlobeTrackCard = dynamic(() => import('@/components/cards/GlobeTrackCard'), {
  ssr: false
});

// Dynamically import Globe to avoid SSR issues with Three.js
const Globe = dynamic(() => import('@/components/globe/Globe'), {
  ssr: false,
  loading: () => null // No loading spinner - tagline animation handles this
});


// Dynamically import UniversalMixer - the universal mixer!
const UniversalMixer = dynamic(() => import('@/components/mixer/UniversalMixer'), {
  ssr: false,
  loading: () => (
    <div className="h-[120px] flex items-center justify-center">
      <div className="text-gray-400">Loading mixer...</div>
    </div>
  )
});

// Dynamically import PlaylistWidget - the playlist player!
const PlaylistWidget = dynamic(() => import('@/components/PlaylistWidget'), {
  ssr: false
});

// Dynamically import GlobeSearch to avoid SSR issues
const GlobeSearch = dynamic(() => import('@/components/globe/GlobeSearch'), {
  ssr: false
});

// Dynamically import SimpleRadioPlayer - simplified radio UI
const SimpleRadioPlayer = dynamic(() => import('@/components/SimpleRadioPlayer'), {
  ssr: false
});

// Dynamically import VideoDisplayArea - video mixer display
const VideoDisplayArea = dynamic(() => import('@/components/mixer/compact/VideoDisplayArea'), {
  ssr: false
});

export default function HomePage() {
  // Alpha app - no auth required for globe viewing
  const [selectedNode, setSelectedNode] = useState<TrackNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<TrackNode | null>(null);
  const [globeNodes, setGlobeNodes] = useState<TrackNode[]>(fallbackGlobeNodes);
  const [originalNodes, setOriginalNodes] = useState<TrackNode[]>(fallbackGlobeNodes); // Keep original for toggling
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [showTagline, setShowTagline] = useState(false);
  // Simple location-based clustering enabled (much more performant than old aggregation)
  const isClusteringEnabled = true;
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [previewTimeout, setPreviewTimeout] = useState<NodeJS.Timeout | null>(null);
  const [leftComparisonTrack, setLeftComparisonTrack] = useState<any | null>(null);
  const [rightComparisonTrack, setRightComparisonTrack] = useState<any | null>(null);
  const [comparisonOrder, setComparisonOrder] = useState<'left' | 'right'>('left'); // Track which was added first
  const [carouselPage, setCarouselPage] = useState(0); // For Load More functionality
  const [hoveredNodeTags, setHoveredNodeTags] = useState<string[] | null>(null);
  const [selectedNodeTags, setSelectedNodeTags] = useState<string[] | null>(null);
  const [centerTrackCard, setCenterTrackCard] = useState<any | null>(null); // For FILL button centered card
  const [fillAddedTrackIds, setFillAddedTrackIds] = useState<Set<string>>(new Set()); // Track IDs added by FILL

  // Widget visibility state - persisted in localStorage
  const [isMixerVisible, setIsMixerVisible] = useState(true); // Default
  const [isPlaylistVisible, setIsPlaylistVisible] = useState(false); // Default
  const [isRadioVisible, setIsRadioVisible] = useState(false); // Default
  const [hasLoadedVisibility, setHasLoadedVisibility] = useState(false); // Use state instead of ref

  // Fill/Reset state
  const [isFilled, setIsFilled] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Mixer state for VideoDisplayArea
  const [mixerState, setMixerState] = useState<any>(null);

  // Video display position (draggable)
  const [videoDisplayPosition, setVideoDisplayPosition] = useState({ x: 0, y: 0 });
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Pinned cards (draggable sticky notes)
  const [pinnedCards, setPinnedCards] = useState<Array<{
    node: TrackNode;
    position: { x: number; y: number };
    id: string;
    isExpanded?: boolean; // For cluster cards - track expanded state
  }>>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [cardDragOffset, setCardDragOffset] = useState({ x: 0, y: 0 });

  // Track card position to prevent jumping when hovering over other nodes
  const [cardPosition, setCardPosition] = useState<{ x: number; y: number } | null>(null);
  const [isCardPositionLocked, setIsCardPositionLocked] = useState(false);
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Track if the selected cluster node is expanded
  const [isSelectedClusterExpanded, setIsSelectedClusterExpanded] = useState(false);

  // Track global mouse position for card positioning
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Lock card position when a node is first selected
  useEffect(() => {
    if (selectedNode && !isCardPositionLocked) {
      console.log('🎯 Locking card position on node select:', mousePosition);
      setCardPosition({ x: mousePosition.x, y: mousePosition.y });
      setIsCardPositionLocked(true);
    }
  }, [selectedNode, isCardPositionLocked, mousePosition]);

  // Load video display position from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem('video-display-position');
      if (savedPosition) {
        setVideoDisplayPosition(JSON.parse(savedPosition));
      }
    }
  }, []);

  // Save video display position to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('video-display-position', JSON.stringify(videoDisplayPosition));
    }
  }, [videoDisplayPosition]);

  // Handle video display dragging
  const handleVideoMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking on the drag handle area (top 32px)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isHeader = e.clientY - rect.top < 32;

    if (!isHeader) return;

    setIsDraggingVideo(true);
    setDragOffset({
      x: e.clientX - videoDisplayPosition.x,
      y: e.clientY - videoDisplayPosition.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingVideo) return;

      setVideoDisplayPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDraggingVideo(false);
    };

    if (isDraggingVideo) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVideo, dragOffset]);

  // Handle card dragging (only from drag handle)
  const handleCardMouseDown = (e: React.MouseEvent, cardId: string, currentPosition: { x: number; y: number }) => {
    // Only drag if clicking on the drag handle (will be set by onMouseDown on handle element)
    e.stopPropagation();
    setDraggingCardId(cardId);
    setCardDragOffset({
      x: e.clientX - currentPosition.x,
      y: e.clientY - currentPosition.y
    });
  };

  useEffect(() => {
    const handleCardMouseMove = (e: MouseEvent) => {
      if (!draggingCardId) return;

      setPinnedCards(prev => prev.map(card =>
        card.id === draggingCardId
          ? {
              ...card,
              position: {
                x: e.clientX - cardDragOffset.x,
                y: e.clientY - cardDragOffset.y
              }
            }
          : card
      ));
    };

    const handleCardMouseUp = () => {
      setDraggingCardId(null);
    };

    if (draggingCardId) {
      window.addEventListener('mousemove', handleCardMouseMove);
      window.addEventListener('mouseup', handleCardMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleCardMouseMove);
      window.removeEventListener('mouseup', handleCardMouseUp);
    };
  }, [draggingCardId, cardDragOffset]);

  // Pin card when dragged from center
  const handlePinCard = (node: TrackNode) => {
    const cardId = `card-${node.id}-${Date.now()}`;

    // Detect cluster status from tracks array if flag is missing
    const hasMultipleTracks = node.tracks && node.tracks.length > 1;
    const isClusterNode = node.isAggregated || hasMultipleTracks;
    const trackCount = node.trackCount || node.tracks?.length || 1;

    // Preserve/infer cluster metadata
    const pinnedNode = {
      ...node,
      // Ensure cluster flags are set (preserve or infer)
      isAggregated: isClusterNode,
      trackCount: trackCount,
      tracks: node.tracks
    };


    setPinnedCards(prev => [...prev, {
      node: pinnedNode,
      position: { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 200 },
      id: cardId
    }]);
    setSelectedNode(null); // Clear hover card
  };

  // Remove pinned card
  const handleRemovePinnedCard = (cardId: string) => {
    setPinnedCards(prev => prev.filter(card => card.id !== cardId));
  };

  // Toggle expanded state for cluster cards
  const handleToggleExpanded = (cardId: string) => {
    setPinnedCards(prev => prev.map(card =>
      card.id === cardId
        ? { ...card, isExpanded: !card.isExpanded }
        : card
    ));
  };

  // Poll for mixer state updates from window object
  useEffect(() => {
    const updateMixerState = () => {
      if (typeof window !== 'undefined' && (window as any).mixerState) {
        setMixerState((window as any).mixerState);
      }
    };

    // Initial update
    updateMixerState();

    // Poll every 100ms for updates
    const interval = setInterval(updateMixerState, 100);

    return () => clearInterval(interval);
  }, []);

  // Load widget visibility from localStorage on mount (client-side only)
  useEffect(() => {
    console.log('🔧 Loading widget visibility from localStorage...');
    if (typeof window !== 'undefined') {
      const savedMixer = localStorage.getItem('mixer-widget-visible');
      const savedPlaylist = localStorage.getItem('playlist-widget-visible');
      const savedRadio = localStorage.getItem('radio-widget-visible');

      console.log('🔧 Found:', { savedMixer, savedPlaylist, savedRadio });

      if (savedMixer !== null) setIsMixerVisible(savedMixer === 'true');
      if (savedPlaylist !== null) setIsPlaylistVisible(savedPlaylist === 'true');
      if (savedRadio !== null) setIsRadioVisible(savedRadio === 'true');

      setHasLoadedVisibility(true); // Use state to ensure proper sequencing
      console.log('✅ Widget visibility loaded');
    }
  }, []); // Run once on mount

  // Persist widget visibility states to localStorage (but not until after initial load)
  useEffect(() => {
    if (!hasLoadedVisibility) {
      console.log('⏭️ Skipping mixer visibility save (waiting for initial load)');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('mixer-widget-visible', String(isMixerVisible));
      console.log('💾 Mixer visibility saved:', isMixerVisible);
    }
  }, [isMixerVisible, hasLoadedVisibility]);

  useEffect(() => {
    if (!hasLoadedVisibility) {
      console.log('⏭️ Skipping playlist visibility save (waiting for initial load)');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('playlist-widget-visible', String(isPlaylistVisible));
      console.log('💾 Playlist visibility saved:', isPlaylistVisible);
    }
  }, [isPlaylistVisible, hasLoadedVisibility]);

  useEffect(() => {
    if (!hasLoadedVisibility) {
      console.log('⏭️ Skipping radio visibility save (waiting for initial load)');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('radio-widget-visible', String(isRadioVisible));
      console.log('💾 Radio visibility saved:', isRadioVisible);
    }
  }, [isRadioVisible, hasLoadedVisibility]);

  // Handle comparison track from collection bar
  const handleComparisonTrack = (track: any) => {
    // Check if clicking same track that's already shown
    if (leftComparisonTrack?.id === track.id) {
      setLeftComparisonTrack(null);
      return;
    }
    if (rightComparisonTrack?.id === track.id) {
      setRightComparisonTrack(null);
      return;
    }

    // Add new comparison track
    if (!leftComparisonTrack) {
      // Left slot is empty
      setLeftComparisonTrack(track);
    } else if (!rightComparisonTrack) {
      // Right slot is empty
      setRightComparisonTrack(track);
    } else {
      // Both slots full - alternate replacement
      // Use a simple toggle: if we last filled/replaced right, replace left, and vice versa
      if (comparisonOrder === 'right') {
        // Last action was on right, so replace left
        setLeftComparisonTrack(track);
        setComparisonOrder('left');
      } else {
        // Last action was on left (or initial state), so replace right
        setRightComparisonTrack(track);
        setComparisonOrder('right');
      }
    }
  };

  // Make the handler available globally for CollectionBar
  useEffect(() => {
    (window as any).handleGlobeComparisonTrack = handleComparisonTrack;
    return () => {
      delete (window as any).handleGlobeComparisonTrack;
    };
  }, [leftComparisonTrack, rightComparisonTrack, comparisonOrder]); // Update when state changes

  // Make loadTracks available globally for Header upload
  useEffect(() => {
    (window as any).refreshGlobeData = loadTracks;
    return () => {
      delete (window as any).refreshGlobeData;
    };
  }, []);

  // Fill all widgets with content
  const handleFillWidgets = async () => {
    try {
      console.log('🎲 FILL: Starting to populate widgets...');

      // First, remove previously FILL-added tracks from crate
      if (fillAddedTrackIds.size > 0 && typeof window !== 'undefined' && (window as any).removeFromCollection) {
        // Convert to array to avoid issues with Set iteration
        Array.from(fillAddedTrackIds).forEach((trackId: string) => {
          (window as any).removeFromCollection(trackId);
        });
        console.log(`🗑️ FILL: Cleared ${fillAddedTrackIds.size} previous FILL tracks from crate`);
      }

      // 1. MIXER: Load predetermined loops that mix well together
      // "Test Disco" (Deck A) + "test loop audio upload" (Deck B)
      const { data: mixerTracks, error: mixerError } = await supabase
        .from('ip_tracks')
        .select('*')
        .eq('content_type', 'loop')
        .in('title', ['Test Disco', 'test loop audio upload'])
        .is('deleted_at', null); // Already has deleted_at filter ✓

      if (!mixerError && mixerTracks && mixerTracks.length >= 2) {
        const testDisco = mixerTracks.find(t => t.title === 'Test Disco');
        const testLoop = mixerTracks.find(t => t.title === 'test loop audio upload');

        if (testDisco && testLoop && typeof window !== 'undefined' && (window as any).loadMixerTracks) {
          (window as any).loadMixerTracks(testDisco, testLoop);
          console.log('🎛️ FILL: Loaded Test Disco to Deck A and test loop audio upload to Deck B');
        } else {
          console.log('🎛️ FILL: Missing one or both tracks:', {
            hasTestDisco: !!testDisco,
            hasTestLoop: !!testLoop,
            hasMethod: !!(window as any).loadMixerTracks
          });
        }
      } else {
        console.log('🎛️ FILL: Could not find both mixer tracks');
      }

      // 2. PLAYLIST: Add 5 random tracks (mix of loops & songs)
      const { data: playlistTracks, error: playlistError } = await supabase
        .from('ip_tracks')
        .select('*')
        .in('content_type', ['loop', 'full_song'])
        .is('deleted_at', null) // Already has deleted_at filter ✓
        .limit(100);

      if (!playlistError && playlistTracks && playlistTracks.length > 0) {
        const shuffled = playlistTracks.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(5, shuffled.length));

        if (typeof window !== 'undefined' && (window as any).fillPlaylist) {
          (window as any).fillPlaylist(selected);
          console.log('📝 FILL: Added 5 tracks to playlist');
        }
      }

      // 3. RADIO: Load 1 random track
      const { data: radioTracks, error: radioError } = await supabase
        .from('ip_tracks')
        .select('*')
        .in('content_type', ['loop', 'full_song'])
        .is('deleted_at', null) // Already has deleted_at filter ✓
        .limit(50);

      if (!radioError && radioTracks && radioTracks.length > 0) {
        const randomTrack = radioTracks[Math.floor(Math.random() * radioTracks.length)];

        if (typeof window !== 'undefined' && (window as any).loadRadioTrack) {
          (window as any).loadRadioTrack(randomTrack);
          console.log('📻 FILL: Loaded radio track');
        }
      }

      // 4. CRATE: Add 5 random items to collection
      const { data: crateTracks, error: crateError } = await supabase
        .from('ip_tracks')
        .select('*')
        .in('content_type', ['loop', 'full_song'])
        .is('deleted_at', null) // Already has deleted_at filter ✓
        .limit(100);

      if (!crateError && crateTracks && crateTracks.length > 0) {
        const shuffled = crateTracks.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(5, shuffled.length));

        // Track the new FILL-added track IDs
        const newFillTrackIds = new Set<string>();

        if (typeof window !== 'undefined' && (window as any).addToCollection) {
          selected.forEach((track: any) => {
            (window as any).addToCollection(track);
            newFillTrackIds.add(track.id);
          });
          console.log(`📦 FILL: Added ${newFillTrackIds.size} tracks to crate collection`);
          console.log('📦 FILL: New track IDs:', Array.from(newFillTrackIds));
        }

        // Update the tracked FILL-added IDs
        setFillAddedTrackIds(newFillTrackIds);
      }

      // 5. GLOBE: Launch 1 random centered track card
      if (originalNodes.length > 0) {
        const randomNode = originalNodes[Math.floor(Math.random() * originalNodes.length)];
        setCenterTrackCard(randomNode);
        console.log('🌍 FILL: Launched centered globe track card');
      }

      console.log('✅ FILL: All widgets populated!');
      setIsFilled(true);
    } catch (error) {
      console.error('❌ FILL: Error populating widgets:', error);
    }
  };

  // Reset all widgets and crate
  const handleResetWidgets = () => {
    try {
      console.log('🔄 RESET: Clearing all widgets and crate...');

      // Clear mixer decks
      if (typeof window !== 'undefined' && (window as any).clearMixerDecks) {
        (window as any).clearMixerDecks();
        console.log('🎛️ RESET: Cleared mixer decks');
      }

      // Clear playlist
      if (typeof window !== 'undefined' && (window as any).clearPlaylist) {
        (window as any).clearPlaylist();
        console.log('📝 RESET: Cleared playlist');
      }

      // Clear radio
      if (typeof window !== 'undefined' && (window as any).clearRadio) {
        (window as any).clearRadio();
        console.log('📻 RESET: Cleared radio');
      }

      // Clear crate (all tracks)
      if (typeof window !== 'undefined' && (window as any).clearCollection) {
        (window as any).clearCollection();
        console.log('📦 RESET: Cleared crate');
      }

      // Clear center track card
      setCenterTrackCard(null);

      // Clear fill tracking
      setFillAddedTrackIds(new Set());

      // Reset filled state
      setIsFilled(false);

      console.log('✅ RESET: All widgets and crate cleared!');
    } catch (error) {
      console.error('❌ RESET: Error clearing widgets:', error);
    }
  };

  // Handle fill/reset button click
  const handleFillResetClick = () => {
    if (isFilled) {
      // Show confirmation modal for reset
      setShowResetModal(true);
    } else {
      // Fill widgets
      handleFillWidgets();
    }
  };

  // Simple single query approach - fast and reliable
  const loadTracks = async () => {
      setIsLoadingTracks(true);
      
      try {
        const tracks = await fetchGlobeTracksFromSupabase();
        
        if (tracks.length > 0) {
          setOriginalNodes(tracks);
          
          // Apply clustering for better UX
          if (isClusteringEnabled) {
            const clusteredTracks = createLocationClusters(tracks, {
              enabled: true,
              distanceThreshold: 2.8, // ~200 mile radius (keeps Mombasa/Machakos separate)
              minTracksForCluster: 2
            });
            setGlobeNodes(clusteredTracks);
          } else {
            setGlobeNodes(tracks);
          }
        } else {
          setGlobeNodes(fallbackGlobeNodes);
        }
      } catch (error) {
        console.error('Error loading tracks:', error);
        setGlobeNodes(fallbackGlobeNodes);
      } finally {
        setIsLoadingTracks(false);
      }
    };
  
  useEffect(() => {
    loadTracks();
  }, []);

  // Tagline animation - fade out after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTagline(false);
    }, 8000); // Slower, more relaxed timing

    return () => clearTimeout(timer);
  }, []);
  

  const handleNodeClick = (node: TrackNode) => {
    // Check if this is a cluster node
    if (isClusterNode(node)) {
      // Show the cluster as selected node - the UI will handle showing multiple cards
      setSelectedNode(node);
      setCarouselPage(0); // Reset pagination for new cluster

      // No cluster tags needed - let the modal content speak for itself
      setSelectedNodeTags(null);
      return;
    }

    // Show the globe track card for this node
    setSelectedNode(node);

    // Set the selected node tags (use test tags if no real tags)
    const tags = node.tags && node.tags.length > 0
      ? node.tags.slice(0, 5)
      : ['test', 'hover', 'tag'];
    setSelectedNodeTags(tags);
    
    // Clear any hover state
    setHoveredNode(null);
    setHoveredNodeTags(null);
  };

  const handleNodeHover = (node: TrackNode | null) => {
    setHoveredNode(node);

    // Immediately show the card on hover (no more two-stage process)
    if (node) {
      setSelectedNode(node);
      setCarouselPage(0); // Reset pagination for clusters

      // Clear tags since card is now showing
      setHoveredNodeTags(null);
      setSelectedNodeTags(null);
    } else {
      // When unhover, don't clear the selected node - let user dismiss it manually
      setHoveredNodeTags(null);
    }
  };

  // Audio playback functions (same as Creator Store)
  const playAudioRobust = async (url: string, trackId: string, isRadioStation?: boolean) => {
    try {
      // Stop any currently playing audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // Clear any existing timeout
      if (previewTimeout) {
        clearTimeout(previewTimeout);
      }

      // Create fresh audio element
      const audio = new Audio();

      // Only set crossOrigin for regular tracks that need audio analysis
      // Radio stations don't need this and it causes CORS errors
      if (!isRadioStation) {
        audio.crossOrigin = 'anonymous';
        audio.preload = 'metadata';
      }

      // Set up event handlers before setting src
      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e, 'for track:', trackId);
        // Clear playing state when audio errors occur
        setPlayingTrackId(null);
        setCurrentAudio(null);
      });

      // Set source
      audio.src = url;

      if (isRadioStation) {
        // Radio stations: Just try to play immediately, don't wait for canplay
        console.log('📻 Attempting to play radio station stream:', url);
        try {
          await audio.play();
          setCurrentAudio(audio);
          setPlayingTrackId(trackId);
          console.log('✅ Radio station playing successfully');

          // 20-second preview timeout for radio stations (only Radio Widget plays indefinitely)
          const timeoutId = setTimeout(() => {
            audio.pause();
            setPlayingTrackId(null);
            setCurrentAudio(null);
          }, 20000);
          setPreviewTimeout(timeoutId);
        } catch (playError) {
          console.error('❌ Radio station play error:', playError);
          setPlayingTrackId(null);
          setCurrentAudio(null);
        }
      } else {
        // Regular tracks: Load and wait for canplay event
        audio.load();

        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Audio loading timeout'));
          }, 5000);

          audio.addEventListener('canplay', () => {
            clearTimeout(timeoutId);
            resolve(audio);
          }, { once: true });

          audio.addEventListener('error', () => {
            clearTimeout(timeoutId);
            reject(new Error('Audio loading failed'));
          }, { once: true });
        });

        // Play the audio
        await audio.play();
        setCurrentAudio(audio);
        setPlayingTrackId(trackId);

        // Set 20-second preview timeout (only for regular tracks)
        const timeoutId = setTimeout(() => {
          audio.pause();
          audio.currentTime = 0;
          setPlayingTrackId(null);
          setCurrentAudio(null);
        }, 20000);

        setPreviewTimeout(timeoutId);
      }

      // Handle audio end (for both radio and regular tracks)
      audio.addEventListener('ended', () => {
        setPlayingTrackId(null);
        setCurrentAudio(null);
        if (previewTimeout) {
          clearTimeout(previewTimeout);
        }
      });

    } catch (error) {
      console.error('Audio playback failed:', error);
      setPlayingTrackId(null);
      setCurrentAudio(null);
    }
  };

  const handlePlayPreview = (trackId: string, audioUrl?: string, isRadioStation?: boolean) => {
    console.log('🎧 handlePlayPreview called:', { trackId, audioUrl, isRadioStation });

    if (!audioUrl) {
      console.warn('⚠️ No audioUrl provided for track:', trackId);
      return;
    }

    // If clicking the same track that's playing, pause it
    if (playingTrackId === trackId && currentAudio) {
      console.log('⏸️ Pausing currently playing track');
      currentAudio.pause();
      currentAudio.remove();
      setPlayingTrackId(null);
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
      currentAudio.remove();
      setCurrentAudio(null);
    }

    if (previewTimeout) {
      clearTimeout(previewTimeout);
      setPreviewTimeout(null);
    }

    // Use robust audio playback approach
    return playAudioRobust(audioUrl, trackId, isRadioStation);
  };

  const handleStopPreview = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.remove();
      setCurrentAudio(null);
      setPlayingTrackId(null);
    }
    
    if (previewTimeout) {
      clearTimeout(previewTimeout);
      setPreviewTimeout(null);
    }
  };

  // Cleanup audio when component unmounts
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

  return (
    <>
      {/* Custom header for globe page */}
      <Header />
      
      {/* Full viewport container with starry background */}
      <div className="fixed inset-0 top-[64px] bottom-0 bg-gradient-to-br from-[#151C2A] to-[#101726]">
        {/* Search component - upper left */}
        <GlobeSearch
          nodes={globeNodes}
          onPlayPreview={handlePlayPreview}
          playingTrackId={playingTrackId}
        />

        {/* Globe fills entire container */}
        <div className="w-full h-full relative">
          <Globe
            nodes={globeNodes}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            selectedNode={selectedNode}
            hoveredNode={hoveredNode}
          />

          {/* Tagline overlay - sequential fade animation */}
          {showTagline && (
            <div
              className="absolute left-0 right-0 flex items-center justify-center pointer-events-none gap-4"
              style={{
                top: '45%',
                transform: 'translateY(-50%)'
              }}
            >
              <span
                className="font-bold tracking-wide"
                style={{
                  fontSize: 'clamp(2rem, 5vw, 4rem)',
                  textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  fontFamily: 'var(--font-geist-sans)',
                  color: '#F6F6F6',
                  animation: 'wordFadeSequence1 8s ease-in-out forwards'
                }}
              >
                discover
              </span>
              <span
                className="font-bold"
                style={{
                  fontSize: 'clamp(2rem, 5vw, 4rem)',
                  color: '#F6F6F6',
                  opacity: 0.6
                }}
              >
                •
              </span>
              <span
                className="font-bold tracking-wide"
                style={{
                  fontSize: 'clamp(2rem, 5vw, 4rem)',
                  textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  fontFamily: 'var(--font-geist-sans)',
                  color: '#F6F6F6',
                  animation: 'wordFadeSequence2 8s ease-in-out forwards'
                }}
              >
                mix
              </span>
              <span
                className="font-bold"
                style={{
                  fontSize: 'clamp(2rem, 5vw, 4rem)',
                  color: '#F6F6F6',
                  opacity: 0.6
                }}
              >
                •
              </span>
              <span
                className="font-bold tracking-wide"
                style={{
                  fontSize: 'clamp(2rem, 5vw, 4rem)',
                  textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  fontFamily: 'var(--font-geist-sans)',
                  color: '#F6F6F6',
                  animation: 'wordFadeSequence3 8s ease-in-out forwards'
                }}
              >
                create
              </span>
            </div>
          )}

          {/* Loading overlay removed - sequential tagline animation serves this purpose */}
        </div>

        {/* Comparison Cards */}
          {/* Left Comparison Card */}
          {leftComparisonTrack && (
            <div 
              className="fixed z-50"
              style={{ 
                left: '240px', // 240px from left edge of viewport
                top: '50%', // Vertically centered
                transform: 'translateY(-50%)' // Center vertically
              }}
            >
              <div className="relative bg-[#101726]/95 backdrop-blur-sm rounded-lg p-2 border border-[#1E293B] shadow-xl animate-scale-in">
                {/* Close button - positioned outside the card */}
                <button
                  onClick={() => setLeftComparisonTrack(null)}
                  className="absolute -top-1 -right-1 text-white/60 hover:text-white transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
                
                {/* Globe Track Card */}
                <GlobeTrackCard
                  track={{
                    id: leftComparisonTrack.id,
                    title: leftComparisonTrack.title,
                    artist: leftComparisonTrack.artist,
                    cover_image_url: leftComparisonTrack.imageUrl || leftComparisonTrack.cover_image_url || '',
                    audio_url: leftComparisonTrack.audioUrl || leftComparisonTrack.audio_url || '',
                    stream_url: leftComparisonTrack.stream_url, // For radio stations
                    video_url: leftComparisonTrack.video_url, // For video clips
                    price_stx: leftComparisonTrack.price_stx || '5 STX',
                    content_type: leftComparisonTrack.content_type || leftComparisonTrack.genre || 'loop',
                    bpm: leftComparisonTrack.bpm, // Don't default to 128 for songs
                    tags: leftComparisonTrack.tags || [],
                    description: leftComparisonTrack.description || '',
                    license: leftComparisonTrack.license || '',
                    primary_uploader_wallet: leftComparisonTrack.uploaderAddress || leftComparisonTrack.wallet_address,
                    // Required fields for IPTrack
                    wallet_address: '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    composition_split: 50,
                    production_split: 50,
                    isrc: '',
                    social_links: {},
                    contact_email: ''
                  }}
                  isPlaying={playingTrackId !== null && playingTrackId === leftComparisonTrack.id}
                  onPlayPreview={handlePlayPreview}
                  onStopPreview={handleStopPreview}
                  showEditControls={false}
                  onPurchase={(track) => {
                    // Purchase functionality would be implemented here
                  }}
                />
              </div>
            </div>
          )}

          {/* Right Comparison Card */}
          {rightComparisonTrack && (
            <div 
              className="fixed z-50"
              style={{ 
                right: '240px', // 240px from right edge of viewport (symmetric with left)
                top: '50%', // Vertically centered
                transform: 'translateY(-50%)' // Center vertically
              }}
            >
              <div className="relative bg-[#101726]/95 backdrop-blur-sm rounded-lg p-2 border border-[#1E293B] shadow-xl animate-scale-in">
                {/* Close button - positioned outside the card */}
                <button
                  onClick={() => setRightComparisonTrack(null)}
                  className="absolute -top-1 -right-1 text-white/60 hover:text-white transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>
                
                {/* Globe Track Card */}
                <GlobeTrackCard
                  track={{
                    id: rightComparisonTrack.id,
                    title: rightComparisonTrack.title,
                    artist: rightComparisonTrack.artist,
                    cover_image_url: rightComparisonTrack.imageUrl || rightComparisonTrack.cover_image_url || '',
                    audio_url: rightComparisonTrack.audioUrl || rightComparisonTrack.audio_url || '',
                    stream_url: rightComparisonTrack.stream_url, // For radio stations
                    video_url: rightComparisonTrack.video_url, // For video clips
                    price_stx: rightComparisonTrack.price_stx || '5 STX',
                    content_type: rightComparisonTrack.content_type || rightComparisonTrack.genre || 'loop',
                    bpm: rightComparisonTrack.bpm, // Don't default to 128 for songs
                    tags: rightComparisonTrack.tags || [],
                    description: rightComparisonTrack.description || '',
                    license: rightComparisonTrack.license || '',
                    primary_uploader_wallet: rightComparisonTrack.uploaderAddress || rightComparisonTrack.wallet_address,
                    // Required fields for IPTrack
                    wallet_address: '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    composition_split: 50,
                    production_split: 50,
                    isrc: '',
                    social_links: {},
                    contact_email: ''
                  }}
                  isPlaying={playingTrackId !== null && playingTrackId === rightComparisonTrack.id}
                  onPlayPreview={handlePlayPreview}
                  onStopPreview={handleStopPreview}
                  showEditControls={false}
                  onPurchase={(track) => {
                    // Purchase functionality would be implemented here
                  }}
                />
              </div>
            </div>
          )}

          {/* Center Track Card (from FILL button) */}
          {centerTrackCard && (
            <div
              className="fixed z-50"
              style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="relative bg-[#101726]/95 backdrop-blur-sm rounded-lg p-2 border border-[#1E293B] shadow-xl animate-scale-in">
                {/* Close button */}
                <button
                  onClick={() => setCenterTrackCard(null)}
                  className="absolute -top-1 -right-1 text-white/60 hover:text-white transition-colors z-10"
                >
                  <X className="w-3 h-3" />
                </button>

                {/* Globe Track Card */}
                <GlobeTrackCard
                  track={{
                    id: centerTrackCard.id,
                    title: centerTrackCard.title,
                    artist: centerTrackCard.artist,
                    cover_image_url: centerTrackCard.imageUrl || centerTrackCard.cover_image_url || '',
                    audio_url: centerTrackCard.audioUrl || centerTrackCard.audio_url || '',
                    stream_url: centerTrackCard.stream_url, // For radio stations
                    video_url: centerTrackCard.video_url, // For video clips
                    price_stx: centerTrackCard.price_stx || '5 STX',
                    content_type: centerTrackCard.content_type || centerTrackCard.genre || 'loop',
                    bpm: centerTrackCard.bpm,
                    tags: centerTrackCard.tags || [],
                    description: centerTrackCard.description || '',
                    license: centerTrackCard.license || '',
                    primary_uploader_wallet: centerTrackCard.uploaderAddress || centerTrackCard.wallet_address,
                    wallet_address: '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    composition_split: 50,
                    production_split: 50,
                    isrc: '',
                    social_links: {},
                    contact_email: ''
                  }}
                  isPlaying={playingTrackId !== null && playingTrackId === centerTrackCard.id}
                  onPlayPreview={handlePlayPreview}
                  onStopPreview={handleStopPreview}
                  showEditControls={false}
                  onPurchase={(track) => {
                    // Purchase functionality would be implemented here
                  }}
                />
              </div>
            </div>
          )}

        {/* Pinned Cards - Draggable sticky notes */}
        {pinnedCards.map((pinnedCard) => {
          const isCluster = pinnedCard.node.isAggregated && pinnedCard.node.tracks && pinnedCard.node.tracks.length > 1;
          const isExpanded = pinnedCard.isExpanded || false;
          const tracks = isCluster ? pinnedCard.node.tracks || [] : [pinnedCard.node];


          return (
            <div
              key={pinnedCard.id}
              className="fixed"
              style={{
                left: `${pinnedCard.position.x}px`,
                top: `${pinnedCard.position.y}px`,
                zIndex: draggingCardId === pinnedCard.id ? 300 : 100
              }}
            >
              <div className="bg-[#101726]/95 backdrop-blur-sm rounded-lg border border-[#81E4F2]/30 shadow-xl">
                {/* Drag handle bar */}
                <div
                  className="bg-gradient-to-r from-[#81E4F2]/20 to-[#81E4F2]/10 px-3 py-1.5 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => handleCardMouseDown(e, pinnedCard.id, pinnedCard.position)}
                  style={{ cursor: draggingCardId === pinnedCard.id ? 'grabbing' : 'grab' }}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#81E4F2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                    </svg>
                    <span className="text-[#81E4F2] text-[10px] font-bold">DRAG TO MOVE</span>
                    {isCluster && (
                      <span className="text-[#81E4F2]/70 text-[9px] font-bold flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5" />
                        {pinnedCard.node.trackCount} tracks
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Expand/collapse button for clusters */}
                    {isCluster && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpanded(pinnedCard.id);
                        }}
                        className="hover:bg-cyan-800/50 rounded-full p-0.5 transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3 text-cyan-300 hover:text-white" />
                        ) : (
                          <ChevronDown className="w-3 h-3 text-cyan-300 hover:text-white" />
                        )}
                      </button>
                    )}

                    {/* Close button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePinnedCard(pinnedCard.id);
                      }}
                      className="hover:bg-cyan-800/50 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3 text-cyan-300 hover:text-white" />
                    </button>
                  </div>
                </div>

                {/* Card content - freely draggable to mixer/crate */}
                <div className="p-2">
                  {isCluster && !isExpanded ? (
                    // Collapsed cluster - show stack visual
                    <div className="relative" style={{ height: '280px', width: '300px' }}>
                      {/* Show first 3 cards as a stack */}
                      {tracks.slice(0, 3).map((track, index) => (
                        <div
                          key={track.id}
                          className="absolute transition-all duration-300"
                          style={{
                            top: `${index * 8}px`,
                            left: `${index * 8}px`,
                            right: `${-index * 8}px`,
                            zIndex: 3 - index,
                            transform: `rotate(${index * 2}deg)`,
                            opacity: 1 - index * 0.2
                          }}
                        >
                          <GlobeTrackCard
                            track={{
                              id: track.id,
                              title: track.title,
                              artist: track.artist,
                              cover_image_url: track.imageUrl || '',
                              audio_url: track.audioUrl || '',
                              stream_url: track.stream_url,
                              video_url: track.video_url,
                              price_stx: track.price_stx || '5 STX',
                              content_type: track.content_type || track.genre || 'loop',
                              bpm: track.bpm,
                              tags: track.tags || [],
                              description: track.description || '',
                              license: track.license || '',
                              primary_uploader_wallet: track.uploaderAddress || track.wallet_address,
                              wallet_address: '',
                              created_at: new Date().toISOString(),
                              updated_at: new Date().toISOString(),
                              composition_split: 50,
                              production_split: 50,
                              isrc: '',
                              social_links: {},
                              contact_email: ''
                            }}
                            isPlaying={playingTrackId !== null && playingTrackId === track.id}
                            onPlayPreview={handlePlayPreview}
                            onStopPreview={handleStopPreview}
                            showEditControls={false}
                            onPurchase={(track) => {}}
                          />
                        </div>
                      ))}
                      {/* Click to expand overlay */}
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg cursor-pointer hover:bg-black/50 transition-colors z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpanded(pinnedCard.id);
                        }}
                      >
                        <div className="text-center">
                          <ChevronDown className="w-8 h-8 text-white mx-auto mb-2" />
                          <div className="text-white font-bold text-sm">Click to expand</div>
                          <div className="text-white/70 text-xs">{pinnedCard.node.trackCount} tracks</div>
                        </div>
                      </div>
                    </div>
                  ) : isCluster && isExpanded ? (
                    // Expanded cluster - show all cards in a scrollable grid
                    <div
                      className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2"
                      style={{ maxWidth: '640px' }}
                    >
                      {tracks.map((track) => (
                        <div key={track.id}>
                          <GlobeTrackCard
                            track={{
                              id: track.id,
                              title: track.title,
                              artist: track.artist,
                              cover_image_url: track.imageUrl || '',
                              audio_url: track.audioUrl || '',
                              stream_url: track.stream_url,
                              video_url: track.video_url,
                              price_stx: track.price_stx || '5 STX',
                              content_type: track.content_type || track.genre || 'loop',
                              bpm: track.bpm,
                              tags: track.tags || [],
                              description: track.description || '',
                              license: track.license || '',
                              primary_uploader_wallet: track.uploaderAddress || track.wallet_address,
                              wallet_address: '',
                              created_at: new Date().toISOString(),
                              updated_at: new Date().toISOString(),
                              composition_split: 50,
                              production_split: 50,
                              isrc: '',
                              social_links: {},
                              contact_email: ''
                            }}
                            isPlaying={playingTrackId !== null && playingTrackId === track.id}
                            onPlayPreview={handlePlayPreview}
                            onStopPreview={handleStopPreview}
                            showEditControls={false}
                            onPurchase={(track) => {}}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Single track card
                    <GlobeTrackCard
                      track={{
                        id: pinnedCard.node.id,
                        title: pinnedCard.node.title,
                        artist: pinnedCard.node.artist,
                        cover_image_url: pinnedCard.node.imageUrl || '',
                        audio_url: pinnedCard.node.audioUrl || '',
                        stream_url: pinnedCard.node.stream_url,
                        video_url: pinnedCard.node.video_url,
                        price_stx: pinnedCard.node.price_stx || '5 STX',
                        content_type: pinnedCard.node.content_type || pinnedCard.node.genre || 'loop',
                        bpm: pinnedCard.node.bpm,
                        tags: pinnedCard.node.tags || [],
                        description: pinnedCard.node.description || '',
                        license: pinnedCard.node.license || '',
                        primary_uploader_wallet: pinnedCard.node.uploaderAddress || pinnedCard.node.wallet_address,
                        wallet_address: '',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        composition_split: 50,
                        production_split: 50,
                        isrc: '',
                        social_links: {},
                        contact_email: ''
                      }}
                      isPlaying={playingTrackId !== null && playingTrackId === pinnedCard.node.id}
                      onPlayPreview={handlePlayPreview}
                      onStopPreview={handleStopPreview}
                      showEditControls={false}
                      onPurchase={(track) => {}}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Tags removed - card shows all info on hover now */}

        {/* Globe Track Card or Cluster Cards - Shows when a node is hovered */}
        {selectedNode && (
          <div
            className="fixed bg-[#101726]/95 backdrop-blur-sm rounded-lg pt-2 px-2 pb-1 border border-[#1E293B] shadow-xl animate-scale-in"
            style={{
              top: cardPosition ? `${cardPosition.y}px` : '50%',
              left: cardPosition ? `${cardPosition.x}px` : '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 250,
              maxHeight: '80vh',
              overflow: 'visible',
              maxWidth: isClusterNode(selectedNode) ? '90vw' : 'auto'
            }}
          >
            {/* Pin button (top left - positioned outside card) */}
            <button
              onClick={() => handlePinCard(selectedNode)}
              className="absolute -top-2 -left-2 bg-gray-900 hover:bg-gray-800 border border-gray-600 rounded-full p-1 transition-colors z-20 shadow-lg hover:scale-105 flex items-center justify-center"
              title="Pin this card, then drag to reposition"
            >
              <span className="w-4 h-4 flex items-center justify-center text-xs leading-none">📍</span>
            </button>

            {/* Close button (top right - positioned outside card) */}
            <button
              onClick={() => {
                setSelectedNode(null);
                setSelectedNodeTags(null);
                // Reset card position lock when closed
                setIsCardPositionLocked(false);
                setCardPosition(null);
                // Reset cluster expansion state
                setIsSelectedClusterExpanded(false);
              }}
              className="absolute -top-2 -right-2 bg-gray-900 hover:bg-gray-800 border border-gray-600 rounded-full p-1 transition-colors z-20 shadow-lg hover:scale-105"
            >
              <X className="w-4 h-4 text-gray-300 hover:text-white" />
            </button>
            
            {/* Check if this is a cluster node */}
            {isClusterNode(selectedNode) ? (
              /* Cluster Display - Collapsed Stack View */
              <div className="p-2">
                {/* Title and info */}
                <div className="text-center mb-3">
                  <h3 className="text-white text-sm font-bold">{selectedNode.title}</h3>
                  <p className="text-gray-400 text-xs mt-1">
                    {selectedNode.trackCount || selectedNode.tracks?.length} tracks from {selectedNode.artist}
                  </p>
                  {/* Null Island special message */}
                  {(selectedNode.location?.includes('Null Island') || selectedNode.tracks?.[0]?.location?.includes('Null Island')) && (
                    <div className="mt-3 mx-auto max-w-md px-4 py-3 bg-gradient-to-r from-[#81E4F2]/10 to-pink-900/40 border border-[#81E4F2]/30 rounded-lg">
                      <p className="text-xs text-[#81E4F2] leading-relaxed">
                        <span className="font-semibold">🏝️ Welcome to Null Island!</span> These tracks sailed here because they were uploaded without location tags.
                        Some artists choose this as a badge of freedom from spatial coordinates, while others might want to
                        <span className="text-pink-300"> add a location tag</span> to plant their flag somewhere specific on the globe.
                      </p>
                    </div>
                  )}
                </div>

                {!isSelectedClusterExpanded ? (
                  /* Collapsed stack - show first 3 cards */
                  <div className="relative" style={{ height: '280px', width: '300px', margin: '0 auto' }}>
                    {selectedNode.tracks.slice(0, 3).map((track, index) => (
                      <div
                        key={track.id}
                        className="absolute transition-all duration-300"
                        style={{
                          top: `${index * 8}px`,
                          left: `${index * 8}px`,
                          right: `${-index * 8}px`,
                          zIndex: 3 - index,
                          transform: `rotate(${index * 2}deg)`,
                          opacity: 1 - index * 0.2
                        }}
                      >
                        <GlobeTrackCard
                          track={{
                            id: track.id,
                            title: track.title,
                            artist: track.artist,
                            cover_image_url: track.imageUrl || track.cover_image_url || '',
                            imageUrl: track.imageUrl || track.cover_image_url || '',
                            audio_url: track.audioUrl,
                            stream_url: track.stream_url,
                            video_url: track.video_url,
                            content_type: track.content_type,
                            tags: track.tags || [],
                            price_stx: track.price_stx,
                            bpm: track.bpm,
                            duration: track.duration,
                            description: track.description,
                            primary_location: track.location,
                            primary_uploader_wallet: track.uploaderAddress || track.wallet_address
                          } as any}
                          isPlaying={playingTrackId !== null && playingTrackId === track.id}
                          onPlayPreview={handlePlayPreview}
                          onStopPreview={handleStopPreview}
                          showEditControls={false}
                        />
                      </div>
                    ))}
                    {/* Click to expand overlay */}
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg cursor-pointer hover:bg-black/50 transition-colors z-10"
                      onClick={() => setIsSelectedClusterExpanded(true)}
                    >
                      <div className="text-center">
                        <ChevronDown className="w-8 h-8 text-white mx-auto mb-2" />
                        <div className="text-white font-bold text-sm">Click to expand</div>
                        <div className="text-white/70 text-xs">{selectedNode.trackCount || selectedNode.tracks?.length} tracks</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Expanded view - show all cards in scrollable grid */
                  <div>
                    <div className="flex items-center justify-center mb-3">
                      <button
                        onClick={() => setIsSelectedClusterExpanded(false)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#81E4F2]/20 hover:bg-[#81E4F2]/30 border border-[#81E4F2]/50 rounded-lg transition-colors"
                      >
                        <ChevronUp className="w-4 h-4 text-[#81E4F2]" />
                        <span className="text-[#81E4F2] text-sm font-bold">Collapse</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2" style={{ maxWidth: '640px', margin: '0 auto' }}>
                      {selectedNode.tracks.map((track) => (
                        <div key={track.id}>
                          <GlobeTrackCard
                            track={{
                              id: track.id,
                              title: track.title,
                              artist: track.artist,
                              cover_image_url: track.imageUrl || track.cover_image_url || '',
                              imageUrl: track.imageUrl || track.cover_image_url || '',
                              audio_url: track.audioUrl,
                              stream_url: track.stream_url,
                              video_url: track.video_url,
                              content_type: track.content_type,
                              tags: track.tags || [],
                              price_stx: track.price_stx,
                              bpm: track.bpm,
                              duration: track.duration,
                              description: track.description,
                              primary_location: track.location,
                              primary_uploader_wallet: track.uploaderAddress || track.wallet_address
                            } as any}
                            isPlaying={playingTrackId !== null && playingTrackId === track.id}
                            onPlayPreview={handlePlayPreview}
                            onStopPreview={handleStopPreview}
                            showEditControls={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Individual Track Display */
              (() => {
                const displayTrack = selectedNode;
                
              return (
                <>
                  {/* Globe Track Card */}
                  <div
                    className="group relative cursor-grab active:cursor-grabbing"
                    title="💿 Drag this card to Mixer Decks, Crate, or Radio Player"
                  >
                    <GlobeTrackCard
                      track={{
                        id: displayTrack.id,
                        title: displayTrack.title,
                        artist: displayTrack.artist,
                        cover_image_url: displayTrack.imageUrl || '',
                      audio_url: displayTrack.audioUrl || '',
                      stream_url: displayTrack.stream_url, // For radio stations
                      video_url: displayTrack.video_url, // For video clips
                      price_stx: displayTrack.price_stx || '5 STX',
                      content_type: displayTrack.content_type || displayTrack.genre || 'loop',
                      bpm: displayTrack.bpm, // Don't default to 128 - preserve NULL for songs
                      tags: displayTrack.tags || [],
                      description: displayTrack.description || '',
                      license: displayTrack.license || '',
                      primary_uploader_wallet: displayTrack.uploaderAddress || displayTrack.wallet_address,
                      // Required fields for IPTrack
                      wallet_address: '',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      composition_split: 50,
                      production_split: 50,
                      isrc: '',
                      social_links: {},
                      contact_email: ''
                    }}
                    isPlaying={playingTrackId !== null && playingTrackId === displayTrack.id}
                    onPlayPreview={handlePlayPreview}
                    onStopPreview={handleStopPreview}
                    showEditControls={false}
                    onPurchase={(track) => {
                      console.log('Purchase track:', track);
                    }}
                  />
                  </div>

                  {/* Track list for aggregated nodes */}
                  {selectedNode.isAggregated && selectedNode.tracks && selectedNode.tracks.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-[#1E293B]">
                      <div className="text-xs text-gray-400 mb-2">
                        More tracks from {selectedNode.artist} ({Math.min(3, selectedNode.tracks.length)} of {selectedNode.trackCount})
                      </div>
                      <div className="space-y-1">
                        {selectedNode.tracks.slice(0, 3).map((track, index) => (
                          <div 
                            key={track.id}
                            className="flex items-center justify-between p-2 rounded bg-[#1a1f2e] hover:bg-[#252a3a] transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-white truncate">{track.title}</div>
                              <div className="text-xs text-gray-500">{track.bpm ? `${track.bpm} BPM` : 'Track'}</div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                              {/* Play button */}
                              <button
                                onClick={() => handlePlayPreview(track.id, track.audioUrl)}
                                className="p-1 hover:bg-[#2a2f3e] rounded transition-colors"
                                title="Preview"
                              >
                                {playingTrackId === track.id ? (
                                  <div className="w-4 h-4 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4 text-[#81E4F2]" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M5 4v12l10-6z" />
                                  </svg>
                                )}
                              </button>
                              {/* Add to collection button */}
                              <button
                                onClick={() => {
                                  // Add to collection via global handler
                                  if ((window as any).addToCollection) {
                                    (window as any).addToCollection(track);
                                  }
                                }}
                                className="p-1 hover:bg-[#2a2f3e] rounded transition-colors"
                                title="Add to Collection"
                              >
                                <svg className="w-4 h-4 text-[#81E4F2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()
            )}
          </div>
        )}
      </div>

      {/* Widget Launcher - Temporarily hidden for pre-deploy polish */}
      {/* TODO: Re-enable after implementing simplified radio widget UI */}
      {/* <WidgetLauncher
        onMixClick={() => setIsMixerVisible(!isMixerVisible)}
        onPlayClick={() => setIsPlaylistVisible(!isPlaylistVisible)}
        onRadioClick={() => setIsRadioVisible(!isRadioVisible)}
        onFillClick={handleFillResetClick}
        isMixerVisible={isMixerVisible}
        isPlaylistVisible={isPlaylistVisible}
        isRadioVisible={isRadioVisible}
        isFilled={isFilled}
      /> */}

      {/* Reset Confirmation Modal */}
      <ResetConfirmModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onConfirm={handleResetWidgets}
      />

      {/* Playlist Widget - Fixed left position (24px left of mixer edge) */}
      {isPlaylistVisible && (
        <div className="fixed bottom-20 z-30" style={{ right: 'calc(50% + 324px)' }}>
          <PlaylistWidget />
        </div>
      )}

      {/* Video Display Area - Draggable video mixer display */}
      {isMixerVisible && mixerState && (mixerState.deckATrack?.content_type === 'video_clip' || mixerState.deckBTrack?.content_type === 'video_clip') && (
        <div
          className="fixed"
          style={{
            left: videoDisplayPosition.x === 0 ? '50%' : `${videoDisplayPosition.x}px`,
            top: videoDisplayPosition.y === 0 ? 'auto' : `${videoDisplayPosition.y}px`,
            bottom: videoDisplayPosition.y === 0 ? '508px' : 'auto',
            transform: videoDisplayPosition.x === 0 ? 'translateX(-50%)' : 'none',
            width: '408px',
            zIndex: isDraggingVideo ? 200 : 30,
            cursor: isDraggingVideo ? 'grabbing' : 'default'
          }}
          onMouseDown={handleVideoMouseDown}
        >
          {/* Drag handle */}
          <div
            className="bg-gradient-to-r from-[#2792F5]/90 to-[#38BDF8]/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-t-lg flex items-center justify-between"
            style={{ cursor: 'grab' }}
          >
            <span>VIDEO MIXER</span>
            <span className="text-white/60 text-[10px]">DRAG TO MOVE</span>
          </div>

          <VideoDisplayArea
            deckATrack={mixerState.deckATrack}
            deckBTrack={mixerState.deckBTrack}
            deckAPlaying={mixerState.deckAPlaying}
            deckBPlaying={mixerState.deckBPlaying}
            crossfaderPosition={mixerState.crossfaderPosition}
          />
        </div>
      )}

      {/* Universal Mixer - Always centered */}
      {isMixerVisible && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30">
          <UniversalMixer />
        </div>
      )}

      {/* Crate - Persistent across all pages */}
      <Crate />

      {/* Simple Radio Player - Always available, shows when station loaded */}
      <SimpleRadioPlayer />
    </>
  );
}