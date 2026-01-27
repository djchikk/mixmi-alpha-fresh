"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { IPTrack } from '@/types';
import { Track } from '@/components/mixer/types';

interface PendingTrackLoad {
  track: Track;
  deck: 'A' | 'B';
  timestamp: number;
}

interface LoadedTrackInfo {
  id: string;
  title: string;
  remix_depth: number;
  source_track_ids?: string[];
}

interface MixerContextType {
  // Track loading state
  pendingTrackLoads: PendingTrackLoad[];

  // Collection Bar (separate from deck crates)
  collection: Track[];

  // Deck Crate management (2x2 grids in mixer)
  deckACrate: Track[];
  deckBCrate: Track[];

  // Loaded tracks in mixer (full IPTrack data for remix split calculations)
  loadedTracks: IPTrack[];
  
  // Actions
  loadTrackToDeck: (ipTrack: IPTrack, deck: 'A' | 'B') => void;
  addTrackToCollection: (ipTrack: IPTrack) => void;
  updateTrackInCollection: (trackId: string, updates: Partial<IPTrack>) => void;
  removeTrackFromCollection: (index: number) => void;
  clearCollection: () => void;
  addTrackToCrate: (ipTrack: IPTrack, deck: 'A' | 'B') => void;
  loadTrackFromCrate: (crateIndex: number, deck: 'A' | 'B') => void;
  removeTrackFromCrate: (crateIndex: number, deck: 'A' | 'B') => void;
  clearCrate: (deck: 'A' | 'B') => void;
  consumePendingLoads: () => PendingTrackLoad[];
  clearPendingLoads: () => void;
  
  // Remix depth tracking
  addLoadedTrack: (track: IPTrack) => void;
  removeLoadedTrack: (trackId: string) => void;
  clearLoadedTracks: () => void;
  
  // Navigation helper
  shouldNavigateToMixer: boolean;
  setShouldNavigateToMixer: (value: boolean) => void;
}

const MixerContext = createContext<MixerContextType | undefined>(undefined);

// Helper function to convert IPTrack to mixer Track format
const convertIPTrackToMixerTrack = (ipTrack: IPTrack): Track => {
  return {
    id: ipTrack.id,
    title: ipTrack.title,
    artist: ipTrack.artist || (ipTrack as any).artist_name || 'Unknown Artist', // Handle both artist and artist_name
    imageUrl: ipTrack.cover_image_url || (ipTrack as any).imageUrl || '', // Prefer original cover_image_url for better quality
    cover_image_url: ipTrack.cover_image_url, // CRITICAL: Preserve original cover_image_url for high-res display
    bpm: ipTrack.bpm, // Preserve original bpm (may be null for undetected)
    audioUrl: (ipTrack as any).audioUrl || ipTrack.audio_url, // Handle both audioUrl and audio_url
    audio_url: ipTrack.audio_url, // Preserve audio_url field
    stream_url: (ipTrack as any).stream_url, // Preserve stream_url for radio stations
    video_url: ipTrack.video_url, // Preserve video_url for video clips
    notes: ipTrack.notes, // Preserve notes for CC text overlay
    pack_position: ipTrack.pack_position, // Preserve pack position for numbering
    pack_id: ipTrack.pack_id, // Preserve pack ID for bundling
    is_draft: ipTrack.is_draft, // Preserve draft status for styling
    content_type: ipTrack.content_type || 'loop', // Preserve original content type!
    price_stx: ipTrack.price_stx, // Preserve price for cart functionality
    price_usdc: ipTrack.price_usdc, // USDC price (primary pricing model)
    download_price_stx: ipTrack.download_price_stx, // Preserve new pricing model
    download_price_usdc: ipTrack.download_price_usdc, // USDC download price (primary)
    allow_downloads: ipTrack.allow_downloads, // Preserve download permission
    primary_uploader_wallet: ipTrack.primary_uploader_wallet, // Preserve for linking to creator store
    foundByAgent: (ipTrack as any).foundByAgent, // Preserve agent discovery flag
    // AI assistance flags for Creation display
    ai_assisted_idea: ipTrack.ai_assisted_idea,
    ai_assisted_implementation: ipTrack.ai_assisted_implementation
  };
};

export const MixerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingTrackLoads, setPendingTrackLoads] = useState<PendingTrackLoad[]>([]);
  const [shouldNavigateToMixer, setShouldNavigateToMixer] = useState(false);
  
  // Collection Bar state - separate from deck crates
  const [collection, setCollection] = useState<Track[]>([]);
  
  // Deck Crate state - each deck has its own crate of queued tracks (2x2 grids)
  const [deckACrate, setDeckACrate] = useState<Track[]>([]);
  const [deckBCrate, setDeckBCrate] = useState<Track[]>([]);
  
  // Loaded tracks state - full IPTrack data for remix split calculations
  const [loadedTracks, setLoadedTracks] = useState<IPTrack[]>([]);

  // Flag to prevent saving until after initial load from localStorage
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  // Load from localStorage on hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCollection = localStorage.getItem('mixer-collection');
        if (savedCollection) {
          const parsed = JSON.parse(savedCollection);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCollection(parsed);
          }
        }

        const savedDeckACrate = localStorage.getItem('mixer-deck-a-crate');
        if (savedDeckACrate) {
          const parsed = JSON.parse(savedDeckACrate);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDeckACrate(parsed);
          }
        }

        const savedDeckBCrate = localStorage.getItem('mixer-deck-b-crate');
        if (savedDeckBCrate) {
          const parsed = JSON.parse(savedDeckBCrate);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDeckBCrate(parsed);
          }
        }
      } catch (error) {
        console.error('Error loading mixer state from localStorage:', error);
      }
      // Mark that we've loaded from storage - now safe to save
      setHasLoadedFromStorage(true);
    }
  }, []);

  // Save to localStorage when state changes (only after initial load)
  useEffect(() => {
    if (typeof window !== 'undefined' && hasLoadedFromStorage) {
      localStorage.setItem('mixer-collection', JSON.stringify(collection));
    }
  }, [collection, hasLoadedFromStorage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && hasLoadedFromStorage) {
      localStorage.setItem('mixer-deck-a-crate', JSON.stringify(deckACrate));
    }
  }, [deckACrate, hasLoadedFromStorage]);

  useEffect(() => {
    if (typeof window !== 'undefined' && hasLoadedFromStorage) {
      localStorage.setItem('mixer-deck-b-crate', JSON.stringify(deckBCrate));
    }
  }, [deckBCrate, hasLoadedFromStorage]);

  // Actions
  const loadTrackToDeck = useCallback((ipTrack: IPTrack, deck: 'A' | 'B') => {
    const track = convertIPTrackToMixerTrack(ipTrack);
    const pendingLoad: PendingTrackLoad = {
      track,
      deck,
      timestamp: Date.now()
    };
    setPendingTrackLoads(prev => [...prev, pendingLoad]);
  }, []);

  const addTrackToCollection = useCallback((ipTrack: IPTrack) => {
    const track = convertIPTrackToMixerTrack(ipTrack);
    setCollection(prev => {
      // Avoid duplicates
      if (prev.some(t => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const updateTrackInCollection = useCallback((trackId: string, updates: Partial<IPTrack>) => {
    setCollection(prev => prev.map(track => {
      if (track.id === trackId) {
        // Merge updates into existing track
        return {
          ...track,
          ...updates,
          // Handle image URL updates
          imageUrl: updates.cover_image_url || (updates as any).imageUrl || track.imageUrl,
          cover_image_url: updates.cover_image_url || track.cover_image_url,
        };
      }
      return track;
    }));
  }, []);

  const removeTrackFromCollection = useCallback((index: number) => {
    setCollection(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearCollection = useCallback(() => {
    setCollection([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('mixer-collection');
    }
  }, []);

  const addTrackToCrate = useCallback((ipTrack: IPTrack, deck: 'A' | 'B') => {
    const track = convertIPTrackToMixerTrack(ipTrack);
    const setCrate = deck === 'A' ? setDeckACrate : setDeckBCrate;
    
    setCrate(prev => {
      // Avoid duplicates and limit to 4 tracks per crate
      if (prev.some(t => t.id === track.id) || prev.length >= 4) return prev;
      return [...prev, track];
    });
  }, []);

  const loadTrackFromCrate = useCallback((crateIndex: number, deck: 'A' | 'B') => {
    const crate = deck === 'A' ? deckACrate : deckBCrate;
    const track = crate[crateIndex];
    if (track) {
      loadTrackToDeck({ ...track } as any, deck);
    }
  }, [deckACrate, deckBCrate, loadTrackToDeck]);

  const removeTrackFromCrate = useCallback((crateIndex: number, deck: 'A' | 'B') => {
    const setCrate = deck === 'A' ? setDeckACrate : setDeckBCrate;
    setCrate(prev => prev.filter((_, i) => i !== crateIndex));
  }, []);

  const clearCrate = useCallback((deck: 'A' | 'B') => {
    const setCrate = deck === 'A' ? setDeckACrate : setDeckBCrate;
    setCrate([]);
  }, []);

  const consumePendingLoads = useCallback(() => {
    const loads = [...pendingTrackLoads];
    setPendingTrackLoads([]);
    return loads;
  }, [pendingTrackLoads]);

  const clearPendingLoads = useCallback(() => {
    setPendingTrackLoads([]);
  }, []);

  const addLoadedTrack = useCallback((track: IPTrack) => {
    console.log('➕ Adding full IPTrack to loadedTracks:', {
      id: track.id,
      title: track.title,
      hasCompositionSplits: !!(track.composition_split_1_wallet),
      hasProductionSplits: !!(track.production_split_1_wallet)
    });
    setLoadedTracks(prev => {
      // Check if track already exists
      if (prev.some(t => t.id === track.id)) {
        console.log('⚠️ Track already in loadedTracks, skipping duplicate');
        return prev;
      }

      // Keep only the 2 most recent tracks (for 2 decks)
      const updated = [...prev, track];
      if (updated.length > 2) {
        console.log('🗑️ More than 2 tracks loaded, removing oldest:', updated[0].title);
        return updated.slice(-2); // Keep last 2 tracks
      }

      return updated;
    });
  }, []);

  const removeLoadedTrack = useCallback((trackId: string) => {
    setLoadedTracks(prev => prev.filter(t => t.id !== trackId));
  }, []);

  const clearLoadedTracks = useCallback(() => {
    setLoadedTracks([]);
  }, []);

  return (
    <MixerContext.Provider value={{
      pendingTrackLoads,
      collection,
      deckACrate,
      deckBCrate,
      loadedTracks,
      loadTrackToDeck,
      addTrackToCollection,
      updateTrackInCollection,
      removeTrackFromCollection,
      clearCollection,
      addTrackToCrate,
      loadTrackFromCrate,
      removeTrackFromCrate,
      clearCrate,
      consumePendingLoads,
      clearPendingLoads,
      addLoadedTrack,
      removeLoadedTrack,
      clearLoadedTracks,
      shouldNavigateToMixer,
      setShouldNavigateToMixer
    }}>
      {children}
    </MixerContext.Provider>
  );
};

export const useMixer = () => {
  const context = useContext(MixerContext);
  if (context === undefined) {
    throw new Error('useMixer must be used within a MixerProvider');
  }
  return context;
};

export default MixerContext;