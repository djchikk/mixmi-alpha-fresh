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
  
  // Loaded tracks in mixer (for remix depth tracking)
  loadedTracks: LoadedTrackInfo[];
  
  // Actions
  loadTrackToDeck: (ipTrack: IPTrack, deck: 'A' | 'B') => void;
  addTrackToCollection: (ipTrack: IPTrack) => void;
  removeTrackFromCollection: (index: number) => void;
  addTrackToCrate: (ipTrack: IPTrack, deck: 'A' | 'B') => void;
  loadTrackFromCrate: (crateIndex: number, deck: 'A' | 'B') => void;
  removeTrackFromCrate: (crateIndex: number, deck: 'A' | 'B') => void;
  clearCrate: (deck: 'A' | 'B') => void;
  consumePendingLoads: () => PendingTrackLoad[];
  clearPendingLoads: () => void;
  
  // Remix depth tracking
  addLoadedTrack: (track: LoadedTrackInfo) => void;
  removeLoadedTrack: (trackId: string) => void;
  clearLoadedTracks: () => void;
  
  // Navigation helper
  shouldNavigateToMixer: boolean;
  setShouldNavigateToMixer: (value: boolean) => void;
}

const MixerContext = createContext<MixerContextType | undefined>(undefined);

// Helper function to convert IPTrack to mixer Track format
const convertIPTrackToMixerTrack = (ipTrack: IPTrack): Track => {
  console.log('🔄 Converting IPTrack to mixer Track:', ipTrack);
  console.log('📷 Image field check:', {
    cover_image_url: ipTrack.cover_image_url,
    image_url: (ipTrack as any).image_url,
    imageUrl: (ipTrack as any).imageUrl
  });
  console.log('🎨 Content type check:', {
    original: ipTrack.content_type,
    willBecome: ipTrack.content_type === 'loop' ? 'loop' : 'full_song'
  });
  
  return {
    id: ipTrack.id,
    title: ipTrack.title,
    artist: ipTrack.artist || (ipTrack as any).artist_name || 'Unknown Artist', // Handle both artist and artist_name
    imageUrl: ipTrack.cover_image_url || (ipTrack as any).imageUrl || '', // Prefer original cover_image_url for better quality
    bpm: ipTrack.bpm || 120,
    audioUrl: (ipTrack as any).audioUrl || ipTrack.audio_url, // Handle both audioUrl and audio_url
    content_type: ipTrack.content_type || 'loop', // Preserve original content type!
    price_stx: ipTrack.price_stx, // Preserve price for cart functionality
    primary_uploader_wallet: ipTrack.primary_uploader_wallet // Preserve for linking to creator store
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
  
  // Loaded tracks state for remix depth tracking
  const [loadedTracks, setLoadedTracks] = useState<LoadedTrackInfo[]>([]);

  // Load from localStorage on hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCollection = localStorage.getItem('mixer-collection');
        if (savedCollection) {
          setCollection(JSON.parse(savedCollection));
        }
        
        const savedDeckACrate = localStorage.getItem('mixer-deck-a-crate');
        if (savedDeckACrate) {
          setDeckACrate(JSON.parse(savedDeckACrate));
        }
        
        const savedDeckBCrate = localStorage.getItem('mixer-deck-b-crate');
        if (savedDeckBCrate) {
          setDeckBCrate(JSON.parse(savedDeckBCrate));
        }
      } catch (error) {
        console.error('Error loading mixer state from localStorage:', error);
      }
    }
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mixer-collection', JSON.stringify(collection));
    }
  }, [collection]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mixer-deck-a-crate', JSON.stringify(deckACrate));
    }
  }, [deckACrate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mixer-deck-b-crate', JSON.stringify(deckBCrate));
    }
  }, [deckBCrate]);

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

  const removeTrackFromCollection = useCallback((index: number) => {
    setCollection(prev => prev.filter((_, i) => i !== index));
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

  const addLoadedTrack = useCallback((track: LoadedTrackInfo) => {
    setLoadedTracks(prev => {
      if (prev.some(t => t.id === track.id)) return prev;
      return [...prev, track];
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
      removeTrackFromCollection,
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