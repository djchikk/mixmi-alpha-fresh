"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from 'next/dynamic';
import { useDrop } from 'react-dnd';
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
import { NullIslandModal } from "@/components/globe/NullIslandModal";
import { useMixer } from "@/contexts/MixerContext";

// Demo content track IDs - curated selection for "show me" button
const DEMO_CONTENT = {
  deckA: 'e516f38a-164d-40c7-9d96-dbd718e650f0', // Test Disco - Lunar Drive (loop)
  deckB: 'ab99dcf0-bf1e-4d9b-a93d-adebab349667', // test loop audio upload - tootles (loop)
  radio: '7403c6dd-1f7b-4b9b-9334-8082c5ad7350', // Eritrean - Eritrean Music (radio_station)
  floatingCards: [
    '9a310503-66d5-418e-b476-d762668b14c4', // Baba Unanipenda - Maurice (full_song)
    'bd1e9775-2e5f-4947-ac6d-d03e6ab396b0', // Pink Test Loop - LuLLaby ChicK (loop)
    'c2abf750-bd9c-46c7-a5eb-a0b9902b5346', // Nakala Na Nagai vocal loop - Judy (loop)
    '6b1d0317-878c-4629-9468-273e7118793e', // Puffy Clouds - Demos Never Done (video_clip)
    '0922678f-80a6-42bb-8b24-1785662fe2bf', // TEst Clip 3 - Demos Never Done (video_clip)
  ]
};


// Dynamically import GlobeTrackCard to avoid SSR issues
// GlobeTrackCard handles portal rendering internally
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

// Dynamically import AgentWidget - agent helper widget
const AgentWidget = dynamic(() => import('@/components/AgentWidget'), {
  ssr: false
});

// Dynamically import SimplePlaylistPlayer - simplified playlist UI
const SimplePlaylistPlayer = dynamic(() => import('@/components/SimplePlaylistPlayer'), {
  ssr: false
});

// Dynamically import HelpWidget - help videos and tutorials
const HelpWidget = dynamic(() => import('@/components/HelpWidget'), {
  ssr: false
});

// Dynamically import CartWidget - shopping cart UI
const CartWidget = dynamic(() => import('@/components/CartWidget'), {
  ssr: false
});

// Dynamically import DemoButton - show me demo button
const DemoButton = dynamic(() => import('@/components/DemoButton'), {
  ssr: false
});

// Dynamically import LandingTagline - first-visit animated tagline
const LandingTagline = dynamic(() => import('@/components/LandingTagline'), {
  ssr: false
});

// Dynamically import WebGLVideoDisplay - WebGL video mixer display with shader effects
const WebGLVideoDisplay = dynamic(() => import('@/components/mixer/compact/WebGLVideoDisplay'), {
  ssr: false
});

// Dynamically import WebGLFXPanel - new effect control panel
const WebGLFXPanel = dynamic(() => import('@/components/mixer/compact/WebGLFXPanel'), {
  ssr: false
});

// Dynamically import WebGLControlBar - inline control bar below video
const WebGLControlBar = dynamic(() => import('@/components/mixer/compact/WebGLControlBar'), {
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
  const [isDemoMode, setIsDemoMode] = useState(false); // Demo mode toggle

  // Dwell timer for auto-pinning cards on hover
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Widget visibility state - persisted in localStorage
  const [isMixerVisible, setIsMixerVisible] = useState(true); // Default
  const [isPlaylistVisible, setIsPlaylistVisible] = useState(false); // Default
  const [isRadioVisible, setIsRadioVisible] = useState(false); // Default
  const [hasLoadedVisibility, setHasLoadedVisibility] = useState(false); // Use state instead of ref

  // Fill/Reset state
  const [isFilled, setIsFilled] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Null Island popup state
  const [showNullIslandPopup, setShowNullIslandPopup] = useState(false);

  // Mixer state for VideoDisplayArea
  const [mixerState, setMixerState] = useState<any>(null);

  // Video display position (draggable)
  const [videoDisplayPosition, setVideoDisplayPosition] = useState({ x: 0, y: 0 });
  const [hasManuallyPositionedVideo, setHasManuallyPositionedVideo] = useState(false);
  const [isDraggingVideo, setIsDraggingVideo] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isVideoMixerHovered, setIsVideoMixerHovered] = useState(false);
  const [isVideoViewerCollapsed, setIsVideoViewerCollapsed] = useState(false);

  // Video mixer controls state - WebGL effects
  type CrossfadeMode = 'slide' | 'blend' | 'cut';
  type WebGLEffectType = 'vhs' | 'ascii' | 'dither' | null;
  const [crossfadeMode, setCrossfadeMode] = useState<CrossfadeMode>('slide');
  const [webglActiveEffect, setWebglActiveEffect] = useState<WebGLEffectType>(null);
  const [webglIntensity, setWebglIntensity] = useState(0.5);
  const [webglGranularity, setWebglGranularity] = useState(0.5);
  const [webglWetDry, setWebglWetDry] = useState(1.0);
  const [webglAudioReactive, setWebglAudioReactive] = useState(false);
  const [webglDitherColor, setWebglDitherColor] = useState('#ffffff');
  const [webglAudioLevel, setWebglAudioLevel] = useState(0);
  const [webglRidiculousMode, setWebglRidiculousMode] = useState(false);
  const [webglSaturation, setWebglSaturation] = useState(1.0);
  const [isWebglFXPanelOpen, setIsWebglFXPanelOpen] = useState(false);

  // Pinned cards (draggable sticky notes)
  const [pinnedCards, setPinnedCards] = useState<Array<{
    node: TrackNode;
    position: { x: number; y: number };
    id: string;
    isExpanded?: boolean; // For cluster cards - track expanded state
    hasDragged?: boolean; // Track if card has been dragged at least once
  }>>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [cardDragOffset, setCardDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Mixer context for demo loading
  const { loadTrackToDeck } = useMixer();

  // Demo mode: Load content with staggered animation
  useEffect(() => {
    if (!isDemoMode) return;

    let isCancelled = false;
    const demoCardIds: string[] = []; // Track demo cards for cleanup

    const loadDemoContent = async () => {
      try {
        // Fetch all demo tracks from Supabase
        const { data: tracks, error } = await supabase
          .from('ip_tracks')
          .select('*')
          .in('id', [
            DEMO_CONTENT.deckA,
            DEMO_CONTENT.deckB,
            DEMO_CONTENT.radio,
            ...DEMO_CONTENT.floatingCards
          ]);

        if (error || !tracks || isCancelled) return;

        // Create a map for quick lookup
        const trackMap = new Map(tracks.map(t => [t.id, t]));

        // Staggered loading sequence (~400ms between each, ~3s total)
        const STAGGER_DELAY = 400;

        // 1. Load Deck A
        const deckATrack = trackMap.get(DEMO_CONTENT.deckA);
        if (deckATrack && !isCancelled) {
          loadTrackToDeck(deckATrack, 'A');
        }

        // 2. Load Deck B after delay
        await new Promise(r => setTimeout(r, STAGGER_DELAY));
        if (isCancelled) return;
        const deckBTrack = trackMap.get(DEMO_CONTENT.deckB);
        if (deckBTrack) {
          loadTrackToDeck(deckBTrack, 'B');
        }

        // 3. Load Radio after delay (don't auto-play - pass false)
        await new Promise(r => setTimeout(r, STAGGER_DELAY));
        if (isCancelled) return;
        const radioTrack = trackMap.get(DEMO_CONTENT.radio);
        if (radioTrack && typeof window !== 'undefined' && (window as any).loadRadioTrack) {
          (window as any).loadRadioTrack(radioTrack, false); // false = don't auto-play
        }

        // 4. Load floating cards one by one
        const cardPositions = [
          { x: 180, y: 180 },   // Top left area
          { x: 320, y: 280 },   // Left middle
          { x: window.innerWidth - 420, y: 200 },  // Top right area
          { x: window.innerWidth - 380, y: 350 },  // Right middle
          { x: window.innerWidth / 2 - 80, y: 160 }, // Top center
        ];

        for (let i = 0; i < DEMO_CONTENT.floatingCards.length; i++) {
          await new Promise(r => setTimeout(r, STAGGER_DELAY));
          if (isCancelled) return;

          const cardTrack = trackMap.get(DEMO_CONTENT.floatingCards[i]);
          if (cardTrack) {
            const pos = cardPositions[i] || { x: 200 + i * 100, y: 200 + i * 50 };
            const cardId = `demo-card-${cardTrack.id}-${Date.now()}`;
            demoCardIds.push(cardId);

            const node: TrackNode = {
              id: cardTrack.id,
              title: cardTrack.title,
              artist: cardTrack.artist,
              imageUrl: cardTrack.cover_image_url,
              audioUrl: cardTrack.audio_url,
              stream_url: cardTrack.stream_url,
              video_url: cardTrack.video_url,
              coordinates: { lat: 0, lng: 0 },
              bpm: cardTrack.bpm,
              content_type: cardTrack.content_type,
              tags: cardTrack.tags || [],
              description: cardTrack.description,
              price_stx: cardTrack.price_stx,
              primary_uploader_wallet: cardTrack.primary_uploader_wallet,
              thumb_64_url: cardTrack.thumb_64_url,
              thumb_160_url: cardTrack.thumb_160_url,
              thumb_256_url: cardTrack.thumb_256_url,
            };

            setPinnedCards(prev => [...prev, {
              node,
              position: pos,
              id: cardId,
              isExpanded: false,
              hasDragged: false
            }]);
          }
        }
      } catch (err) {
        console.error('Error loading demo content:', err);
      }
    };

    loadDemoContent();

    // Cleanup function when demo mode is turned off
    return () => {
      isCancelled = true;
    };
  }, [isDemoMode, loadTrackToDeck]);

  // Demo mode OFF: Clear demo content
  useEffect(() => {
    if (isDemoMode) return; // Only run when turning OFF

    // Check if we were previously in demo mode (via sessionStorage)
    const wasInDemo = sessionStorage.getItem('demo-mode-active') === 'true';
    if (!wasInDemo) return;

    // Clear the flag
    sessionStorage.removeItem('demo-mode-active');

    // Clear pinned cards that were added by demo
    setPinnedCards(prev => prev.filter(card => !card.id.startsWith('demo-card-')));

    // Clear mixer decks - the mixer will handle this via its own state
    // We don't need to explicitly clear them since loadTrackToDeck just queues loads

  }, [isDemoMode]);

  // Track when demo mode is active
  useEffect(() => {
    if (isDemoMode) {
      sessionStorage.setItem('demo-mode-active', 'true');
    }
  }, [isDemoMode]);

  // Full-screen drop zone for pinning cards from search results
  const [{ isOverScreen }, screenDropRef] = useDrop(() => ({
    accept: 'TRACK_CARD',
    drop: (item: { track: any }, monitor) => {
      // Get the drop coordinates
      const offset = monitor.getClientOffset();
      if (!offset) return;

      // Convert the dropped track to TrackNode format
      const track = item.track;
      const node: TrackNode = {
        id: track.id,
        title: track.title,
        artist: track.artist || track.artistName || 'Unknown Artist',
        imageUrl: track.imageUrl || track.cover_image_url,
        audioUrl: track.audioUrl || track.audio_url,
        stream_url: track.stream_url,
        coordinates: {
          lat: track.coordinates?.lat || track.lat || 0,
          lng: track.coordinates?.lng || track.lng || 0
        },
        bpm: track.bpm,
        content_type: track.content_type,
        tags: track.tags,
        description: track.description,
        license: track.license,
        price_stx: track.price_stx,
        // Pre-generated thumbnails
        thumb_64_url: track.thumb_64_url,
        thumb_160_url: track.thumb_160_url,
        thumb_256_url: track.thumb_256_url,
        // Wallet info for profile/store links
        uploaderAddress: track.uploaderAddress || track.uploader_address || track.primary_uploader_wallet,
      };

      // Create pinned card at drop location
      const newPinnedCard = {
        node,
        position: { x: offset.x - 120, y: offset.y - 100 }, // Offset so card appears centered on drop
        id: `pinned-${node.id}-${Date.now()}`,
        isExpanded: false,
        hasDragged: false
      };

      setPinnedCards(prev => [...prev, newPinnedCard]);
      console.log('📌 Pinned card from search:', node.title);
    },
    collect: (monitor) => ({
      isOverScreen: monitor.isOver(),
    }),
  }), []);

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
      const savedManualFlag = localStorage.getItem('video-manually-positioned');
      if (savedPosition) {
        setVideoDisplayPosition(JSON.parse(savedPosition));
      }
      if (savedManualFlag) {
        setHasManuallyPositionedVideo(JSON.parse(savedManualFlag));
      }
    }
  }, []);

  // Save video display position to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('video-display-position', JSON.stringify(videoDisplayPosition));
    }
  }, [videoDisplayPosition]);

  // Auto-position video display to right of globe when first shown
  useEffect(() => {
    if (typeof window !== 'undefined' && mixerState && !hasManuallyPositionedVideo) {
      const hasVideo = mixerState.deckATrack?.content_type === 'video_clip' ||
                       mixerState.deckBTrack?.content_type === 'video_clip';

      // Only auto-position if video appears and hasn't been manually positioned
      if (hasVideo && videoDisplayPosition.x === 0 && videoDisplayPosition.y === 0) {
        const videoWidth = 408;
        const videoHeight = 408; // Approximately
        const headerHeight = 64;

        // Position to right of globe, vertically centered
        // Globe is centered, so place video at: center + half globe width + spacing
        const x = window.innerWidth / 2 + 450 + 40; // 450px = ~half globe width, 40px spacing
        const y = (window.innerHeight - headerHeight - videoHeight) / 2 + headerHeight;

        setVideoDisplayPosition({ x, y });
        // Mark as manually positioned so we remember their preference
        setHasManuallyPositionedVideo(true);
        localStorage.setItem('video-manually-positioned', JSON.stringify(true));
      }
    }
  }, [mixerState, videoDisplayPosition.x, videoDisplayPosition.y, hasManuallyPositionedVideo]);

  // WebGL FX panel toggle (triggered by button on video display)
  const toggleWebglFXPanel = () => {
    setIsWebglFXPanelOpen(prev => !prev);
  };

  // Audio reactive: Sample audio levels from analyzer nodes when enabled
  useEffect(() => {
    if (!webglAudioReactive || !webglActiveEffect) {
      setWebglAudioLevel(0);
      return;
    }

    let animationId: number;
    const dataArray = new Uint8Array(128);

    const sampleAudio = () => {
      const windowMixerState = (window as any).mixerState;
      if (!windowMixerState) {
        animationId = requestAnimationFrame(sampleAudio);
        return;
      }

      // Get analyzer from whichever deck is playing (or combine both)
      const analyzerA = windowMixerState.deckAAnalyzer;
      const analyzerB = windowMixerState.deckBAnalyzer;
      const isAPlaying = windowMixerState.deckAPlaying;
      const isBPlaying = windowMixerState.deckBPlaying;

      let level = 0;

      // Sample from playing deck(s)
      if (analyzerA && isAPlaying) {
        try {
          analyzerA.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          level = Math.max(level, sum / (dataArray.length * 255));
        } catch (e) {
          // Analyzer may not be ready
        }
      }

      if (analyzerB && isBPlaying) {
        try {
          analyzerB.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((acc, val) => acc + val, 0);
          level = Math.max(level, sum / (dataArray.length * 255));
        } catch (e) {
          // Analyzer may not be ready
        }
      }

      // Apply smoothing and boost for visual effect
      // Ridiculous mode: CRANK IT UP
      const boostMultiplier = webglRidiculousMode ? 8.0 : 2.5;
      const boostedLevel = Math.min(1, level * boostMultiplier);
      setWebglAudioLevel(boostedLevel);

      animationId = requestAnimationFrame(sampleAudio);
    };

    sampleAudio();

    return () => {
      cancelAnimationFrame(animationId);
      setWebglAudioLevel(0);
    };
  }, [webglAudioReactive, webglActiveEffect, webglRidiculousMode]);

  // Handle video display dragging
  const handleVideoMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Allow dragging from anywhere in the video container
    // (VideoControlPanel will stopPropagation to prevent dragging from buttons)

    // Get actual rendered position to calculate offset correctly
    // (handles centered position with transform vs absolute positioning)
    const rect = e.currentTarget.getBoundingClientRect();

    setIsDraggingVideo(true);
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingVideo) return;

      setVideoDisplayPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });

      // Mark as manually positioned when user drags
      if (!hasManuallyPositionedVideo) {
        setHasManuallyPositionedVideo(true);
        localStorage.setItem('video-manually-positioned', JSON.stringify(true));
      }
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
  }, [isDraggingVideo, dragOffset, hasManuallyPositionedVideo]);

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
              },
              hasDragged: true // Mark as dragged when position changes
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

    

  const handleNodeClick = (node: TrackNode) => {
    // Clear any pending dwell timer
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }

    // Check if this is a cluster node
    const isCluster = (node as any).tracks && (node as any).tracks.length > 1;

    // Auto-pin the card above the cursor
    const newPinnedCard = {
      node,
      position: { x: mousePosition.x, y: mousePosition.y - 180 }, // Above cursor
      id: `pinned-${node.id}-${Date.now()}`,
      isExpanded: false, // All cards start collapsed
      hasDragged: false // Track if card has been dragged
    };

    setPinnedCards(prev => [...prev, newPinnedCard]);

    // Clear hover state
    setHoveredNode(null);
    setHoveredNodeTags(null);
  };

  const handleNodeHover = (node: TrackNode | null) => {
    setHoveredNode(node);

    // Clear any existing dwell timer
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }

    if (node) {
      // Start 500ms dwell timer to auto-pin card
      dwellTimerRef.current = setTimeout(() => {
        const isCluster = (node as any).tracks && (node as any).tracks.length > 1;

        // Auto-pin card above cursor after dwell
        const newPinnedCard = {
          node,
          position: { x: mousePosition.x, y: mousePosition.y - 180 }, // Above cursor
          id: `pinned-${node.id}-${Date.now()}`,
          isExpanded: false,
          hasDragged: false
        };

        setPinnedCards(prev => [...prev, newPinnedCard]);
        dwellTimerRef.current = null;
      }, 500); // 500ms dwell time
    } else {
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
      
      {/* Full viewport container with starry background - also serves as drop zone for pinning cards from search */}
      <div
        ref={screenDropRef as any}
        className="fixed inset-0 top-[64px] bottom-0 bg-gradient-to-br from-[#151C2A] to-[#101726]"
      >
        {/* Search component - upper left */}
        <GlobeSearch
          nodes={globeNodes}
          onPlayPreview={handlePlayPreview}
          playingTrackId={playingTrackId}
        />

        {/* Content type legend - vertically centered left margin */}
        <div
          className="fixed left-4 z-20 flex flex-col gap-2 pointer-events-none content-legend"
          style={{
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'var(--font-geist-mono)'
          }}
        >
          {[
            { label: 'loops', color: '#A084F9', textColor: '#C0AEFA' },
            { label: 'songs', color: '#A8E66B', textColor: '#C4F09A' },
            { label: 'radio', color: '#FFC044', textColor: '#FFD57A' },
            { label: 'video', color: '#5BB5F9', textColor: '#8DCBFB' },
          ].map(({ label, color, textColor }) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className="w-[10px] h-[10px] rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 6px ${color}80`
                }}
              />
              <span
                className="text-[10px] lowercase tracking-wide"
                style={{ color: textColor }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Globe fills entire container */}
        <div className="w-full h-full relative">
          <Globe
            nodes={globeNodes}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            selectedNode={selectedNode}
            hoveredNode={hoveredNode}
            onNullIslandClick={() => setShowNullIslandPopup(true)}
          />

          {/* Landing tagline handled by LandingTagline component */}

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
                    // Pre-generated thumbnails
                    thumb_64_url: leftComparisonTrack.thumb_64_url,
                    thumb_160_url: leftComparisonTrack.thumb_160_url,
                    thumb_256_url: leftComparisonTrack.thumb_256_url,
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
                    // Pre-generated thumbnails
                    thumb_64_url: rightComparisonTrack.thumb_64_url,
                    thumb_160_url: rightComparisonTrack.thumb_160_url,
                    thumb_256_url: rightComparisonTrack.thumb_256_url,
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
                    // Pre-generated thumbnails
                    thumb_64_url: centerTrackCard.thumb_64_url,
                    thumb_160_url: centerTrackCard.thumb_160_url,
                    thumb_256_url: centerTrackCard.thumb_256_url,
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
          const isCluster = (pinnedCard.node as any).tracks && (pinnedCard.node as any).tracks.length > 1;
          const isExpanded = pinnedCard.isExpanded || false;
          const tracks = isCluster ? (pinnedCard.node as any).tracks || [] : [pinnedCard.node];


          return (
            <div
              key={pinnedCard.id}
              className="fixed"
              style={{
                left: `${pinnedCard.position.x}px`,
                top: `${pinnedCard.position.y}px`,
                zIndex: draggingCardId === pinnedCard.id ? 300 : 100
              }}
              onMouseEnter={() => {
                // Clear any pending hide timeout
                if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = null;
                }
                setHoveredCardId(pinnedCard.id);
              }}
              onMouseLeave={() => {
                // Delay hiding the header by 500ms for smoother UX
                hoverTimeoutRef.current = setTimeout(() => {
                  setHoveredCardId(null);
                }, 500);
              }}
            >
              <div className="bg-[#101726]/95 backdrop-blur-sm rounded-lg border border-[#81E4F2]/30 shadow-xl">
                {/* Drag handle bar - smooth fade in/out with 350ms transition */}
                <div
                  className={`bg-gradient-to-r from-[#81E4F2]/20 to-[#81E4F2]/10 px-3 py-1.5 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing transition-all duration-[350ms] ease-in-out ${
                    (!pinnedCard.hasDragged || hoveredCardId === pinnedCard.id || draggingCardId === pinnedCard.id)
                      ? 'opacity-100 max-h-12'
                      : 'opacity-0 max-h-0 py-0 overflow-hidden pointer-events-none'
                  }`}
                  onMouseDown={(e) => {
                    if (!pinnedCard.hasDragged || hoveredCardId === pinnedCard.id || draggingCardId === pinnedCard.id) {
                      handleCardMouseDown(e, pinnedCard.id, pinnedCard.position);
                    }
                  }}
                  onMouseEnter={() => {
                    // Keep header visible when mouse enters the header bar
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    setHoveredCardId(pinnedCard.id);
                  }}
                  style={{ cursor: draggingCardId === pinnedCard.id ? 'grabbing' : 'grab' }}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-[#81E4F2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                    </svg>
                    <span className="text-[#81E4F2] text-[10px] font-bold">DRAG TO MOVE</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Expand/collapse button for clusters */}
                    {isCluster && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpanded(pinnedCard.id);
                        }}
                        className="hover:bg-cyan-800/50 rounded-full p-1 transition-colors"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-cyan-300 hover:text-white" strokeWidth={2.5} />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-cyan-300 hover:text-white" strokeWidth={2.5} />
                        )}
                      </button>
                    )}

                    {/* Close button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePinnedCard(pinnedCard.id);
                      }}
                      className="hover:bg-cyan-800/50 rounded-full p-1 transition-colors"
                    >
                      <X className="w-4 h-4 text-cyan-300 hover:text-white" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Card content - freely draggable to mixer/crate */}
                <div className="p-2">
                  {isCluster && !isExpanded ? (
                    // Collapsed cluster - show stack visual with expand button below
                    <div className="flex flex-col items-center" style={{ width: '200px' }}>
                      {/* Stacked cards container - 160px card + 16px stack offset */}
                      <div className="relative" style={{ height: '180px', width: '200px' }}>
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
                                // Pre-generated thumbnails
                                thumb_64_url: track.thumb_64_url,
                                thumb_160_url: track.thumb_160_url,
                                thumb_256_url: track.thumb_256_url,
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
                      {/* Click to expand button - positioned below the stack */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleExpanded(pinnedCard.id);
                        }}
                        className="mt-2 cursor-pointer hover:bg-white/10 px-6 py-2 rounded-lg transition-colors text-center"
                      >
                        <ChevronDown className="w-6 h-6 text-white mx-auto mb-1" />
                        <div className="text-white font-bold text-sm">Click to expand</div>
                        <div className="text-white/70 text-xs">{pinnedCard.node.trackCount} tracks</div>
                      </button>
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
                              // Pre-generated thumbnails
                              thumb_64_url: track.thumb_64_url,
                              thumb_160_url: track.thumb_160_url,
                              thumb_256_url: track.thumb_256_url,
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
                        // Pre-generated thumbnails
                        thumb_64_url: pinnedCard.node.thumb_64_url,
                        thumb_160_url: pinnedCard.node.thumb_160_url,
                        thumb_256_url: pinnedCard.node.thumb_256_url,
                        // Portal fields
                        portal_username: pinnedCard.node.portal_username,
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
                            primary_uploader_wallet: track.uploaderAddress || track.wallet_address,
                            // Pre-generated thumbnails
                            thumb_64_url: track.thumb_64_url,
                            thumb_160_url: track.thumb_160_url,
                            thumb_256_url: track.thumb_256_url
                          } as any}
                          isPlaying={playingTrackId !== null && playingTrackId === track.id}
                          onPlayPreview={handlePlayPreview}
                          onStopPreview={handleStopPreview}
                          showEditControls={false}
                        />
                      </div>
                    ))}
                    {/* Click to expand overlay - pointer-events-none allows dragging cards */}
                    <div
                      className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg transition-colors z-10 pointer-events-none"
                    >
                      <div className="text-center">
                        <button
                          onClick={() => setIsSelectedClusterExpanded(true)}
                          className="pointer-events-auto cursor-pointer hover:bg-black/20 px-6 py-4 rounded-lg transition-colors"
                        >
                          <ChevronDown className="w-8 h-8 text-white mx-auto mb-2" />
                          <div className="text-white font-bold text-sm">Click to expand</div>
                          <div className="text-white/70 text-xs">{selectedNode.trackCount || selectedNode.tracks?.length} tracks</div>
                        </button>
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
                              primary_uploader_wallet: track.uploaderAddress || track.wallet_address,
                              // Pre-generated thumbnails
                              thumb_64_url: track.thumb_64_url,
                              thumb_160_url: track.thumb_160_url,
                              thumb_256_url: track.thumb_256_url
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
                  {/* Globe Track Card - handles portal rendering internally */}
                  <div
                    className="group relative cursor-grab active:cursor-grabbing"
                    title={displayTrack.content_type === 'portal' ? 'Click to visit profile' : '💿 Drag this card to Mixer Decks, Crate, or Radio Player'}
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
                      // Pre-generated thumbnails
                      thumb_64_url: displayTrack.thumb_64_url,
                      thumb_160_url: displayTrack.thumb_160_url,
                      thumb_256_url: displayTrack.thumb_256_url,
                      // Portal fields
                      portal_username: displayTrack.portal_username,
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

      {/* Null Island Modal - shows content at (0,0) with explainer header */}
      {/* Null Island nodes are scattered within ~2.5 degrees radius, so we check within 3 degrees */}
      {/* We expand any clusters at Null Island to show all individual tracks */}
      <NullIslandModal
        isOpen={showNullIslandPopup}
        onClose={() => setShowNullIslandPopup(false)}
        nodes={globeNodes
          .filter(node => Math.abs(node.coordinates.lat) < 3 && Math.abs(node.coordinates.lng) < 3)
          .flatMap(node => {
            // Expand clusters to get individual tracks
            if (isClusterNode(node)) {
              return node.tracks;
            }
            return [node];
          })
        }
        onSelectNode={(node) => {
          // Open the node's card when selected from the modal
          const newPinnedCard = {
            node,
            position: { x: window.innerWidth / 2, y: window.innerHeight / 2 - 100 },
            id: `pinned-${node.id}-${Date.now()}`,
            isExpanded: false,
            hasDragged: false
          };
          setPinnedCards(prev => [...prev, newPinnedCard]);
        }}
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
            cursor: isDraggingVideo ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleVideoMouseDown}
          onMouseEnter={() => setIsVideoMixerHovered(true)}
          onMouseLeave={() => setIsVideoMixerHovered(false)}
        >
          {/* Drag handle - auto-hides when not hovered */}
          <div
            className={`bg-gradient-to-r from-[#5BB5F9]/90 to-[#38BDF8]/90 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-t-lg flex items-center justify-center transition-opacity duration-200 relative ${
              isVideoMixerHovered || (videoDisplayPosition.x === 0 && videoDisplayPosition.y === 0) ? 'opacity-100' : 'opacity-0'
            }`}
            style={{ cursor: 'grab' }}
          >
            {/* VIDEO MIXER label - absolute positioned left */}
            <span className="absolute left-3 top-1/2 -translate-y-1/2">VIDEO MIXER</span>

            {/* DRAG TO MOVE - centered */}
            <span className="text-white/60 text-[10px]">DRAG TO MOVE</span>

            {/* Collapse/Expand button - absolute positioned right */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsVideoViewerCollapsed(!isVideoViewerCollapsed);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-white/20 rounded p-0.5 transition-colors pointer-events-auto"
              title={isVideoViewerCollapsed ? "Expand viewer" : "Collapse viewer"}
            >
              {isVideoViewerCollapsed ? (
                <ChevronUp className="w-5 h-5" strokeWidth={2.5} />
              ) : (
                <ChevronDown className="w-5 h-5" strokeWidth={2.5} />
              )}
            </button>
          </div>

          {/* Video display - conditionally shown */}
          <div
            className="transition-all duration-300 ease-in-out overflow-hidden"
            style={{
              maxHeight: isVideoViewerCollapsed ? '0px' : '408px',
              opacity: isVideoViewerCollapsed ? 0 : 1
            }}
          >
            <WebGLVideoDisplay
              deckATrack={mixerState.deckATrack}
              deckBTrack={mixerState.deckBTrack}
              deckAPlaying={mixerState.deckAPlaying}
              deckBPlaying={mixerState.deckBPlaying}
              crossfaderPosition={mixerState.crossfaderPosition}
              crossfadeMode={crossfadeMode}
              effects={{
                activeEffect: webglActiveEffect,
                intensity: webglIntensity,
                granularity: webglGranularity,
                wetDry: webglWetDry,
                audioReactive: webglAudioReactive,
                ditherColor: webglDitherColor,
                audioLevel: webglAudioLevel,
                ridiculousMode: webglRidiculousMode,
                saturation: webglSaturation
              }}
            />
          </div>

          {/* Inline Control Bar - MIX and FX controls */}
          <WebGLControlBar
            crossfadeMode={crossfadeMode}
            onCrossfadeModeChange={setCrossfadeMode}
            activeEffect={webglActiveEffect}
            onEffectChange={setWebglActiveEffect}
            audioReactive={webglAudioReactive}
            onAudioReactiveChange={setWebglAudioReactive}
            onOpenSettings={toggleWebglFXPanel}
          />

          {/* WebGL FX Panel - pops out below */}
          {isWebglFXPanelOpen && (
            <div className="absolute top-full left-0 mt-1 z-50">
              <WebGLFXPanel
                isOpen={isWebglFXPanelOpen}
                onClose={() => setIsWebglFXPanelOpen(false)}
                activeEffect={webglActiveEffect}
                intensity={webglIntensity}
                onIntensityChange={setWebglIntensity}
                granularity={webglGranularity}
                onGranularityChange={setWebglGranularity}
                wetDry={webglWetDry}
                onWetDryChange={setWebglWetDry}
                audioReactive={webglAudioReactive}
                ditherColor={webglDitherColor}
                onDitherColorChange={setWebglDitherColor}
                ridiculousMode={webglRidiculousMode}
                onRidiculousModeChange={setWebglRidiculousMode}
                saturation={webglSaturation}
                onSaturationChange={setWebglSaturation}
              />
            </div>
          )}
        </div>
      )}

      {/* Universal Mixer - Always centered */}
      {isMixerVisible && (
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-30 mixer-widget">
          <UniversalMixer />
        </div>
      )}

      {/* Crate - Persistent across all pages */}
      <Crate />

      {/* Simple Radio Player - Always available, shows when station loaded */}
      <SimpleRadioPlayer />

      {/* Simple Playlist Player - Always available, bottom-left corner */}
      <SimplePlaylistPlayer />

      {/* Demo Button - Fixed position, to the left of help widget */}
      <DemoButton isOn={isDemoMode} onToggle={setIsDemoMode} />

      {/* Help Widget - Fixed position, right side */}
      <HelpWidget />

      {/* Agent Widget - Fixed position, left side (triggered by crate robot button) */}
      <AgentWidget />

      {/* Cart Widget - Fixed position, top-right corner */}
      <CartWidget />

      {/* Landing Tagline - First visit only, animated */}
      <LandingTagline />
    </>
  );
}