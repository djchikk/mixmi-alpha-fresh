"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Play, Plus, Check } from 'lucide-react';
import { TrackNode } from './types';
import { useDebounce } from '@/hooks/useDebounce';

interface GlobeSearchProps {
  nodes: TrackNode[];
  onPlayPreview: (trackId: string, audioUrl?: string) => void;
  playingTrackId: string | null;
  onAddToCollection?: (track: TrackNode) => void;
}

// Filter types matching the updated nomenclature
const FILTER_TYPES = [
  { id: 'loops', label: 'Loops' },
  { id: 'loop_pack', label: 'Loop Packs' },
  { id: 'ep', label: 'EPs' }, // NEW: For EP content!
  { id: 'songs', label: 'Songs' },
  { id: 'instrumental', label: 'Instrumental' },
  { id: 'beats', label: 'Beats' },
  { id: 'vocal', label: 'Vocal' },
  { id: 'stem', label: 'Stem' }
] as const;

type FilterType = typeof FILTER_TYPES[number]['id'];

export default function GlobeSearch({ 
  nodes, 
  onPlayPreview, 
  playingTrackId,
  onAddToCollection 
}: GlobeSearchProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<FilterType>>(new Set());
  const [results, setResults] = useState<TrackNode[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [addedTracks, setAddedTracks] = useState<Set<string>>(new Set());
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('globe-recent-searches');
    if (stored) {
      setRecentSearches(JSON.parse(stored).slice(0, 5));
    }
  }, []);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedSearch) {
      performSearch(debouncedSearch);
    } else {
      setResults([]);
    }
  }, [debouncedSearch, activeFilters, nodes]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isPinned && searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
        setShowRecent(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPinned]);

  const performSearch = (query: string) => {
    const lowerQuery = query.toLowerCase();
    
    // Debug logging for artist search issues
    if (lowerQuery.includes('starla')) {
      console.log('🔍 Searching for STARLA...');
      console.log('📊 Total nodes:', nodes.length);
    }
    
    // Get all individual tracks (expand aggregated AND clustered nodes)
    const allTracks: TrackNode[] = [];
    nodes.forEach(node => {
      // Handle aggregated nodes (old system)
      if (node.isAggregated && node.tracks) {
        allTracks.push(...node.tracks);
      }
      // Handle clustered nodes (new system) - Check if it has tracks array
      else if ((node as any).tracks && Array.isArray((node as any).tracks)) {
        allTracks.push(...(node as any).tracks);
      }
      // Regular individual tracks
      else {
        allTracks.push(node);
      }
    });
    
    if (lowerQuery.includes('starla')) {
      console.log('📊 All tracks after expansion:', allTracks.length);
      
      // Log all track data to see field structure
      allTracks.forEach((track, index) => {
        console.log(`🎵 Track ${index + 1}:`, {
          id: track.id,
          title: track.title,
          artist: track.artist,
          artistName: track.artistName,
          creator: (track as any).creator,
          uploader: (track as any).uploaderAddress,
          // Log all possible artist-related fields
          allFields: Object.keys(track)
        });
      });
      
      const starlaMatches = allTracks.filter(track => 
        track.artist?.toLowerCase().includes('starla') ||
        track.artistName?.toLowerCase().includes('starla') ||
        track.title?.toLowerCase().includes('starla')
      );
      console.log('🎯 STARLA matches found:', starlaMatches.length, starlaMatches);
    }

    // Filter by search query
    let filtered = allTracks.filter(track => {
      const matchesSearch = 
        track.title.toLowerCase().includes(lowerQuery) ||
        track.artist.toLowerCase().includes(lowerQuery) ||
        (track.tags && Array.isArray(track.tags) && track.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
      
      return matchesSearch;
    });

    // Apply content type filters
    if (activeFilters.size > 0) {
      filtered = filtered.filter(track => {
        const tags = Array.isArray(track.tags) ? track.tags : [];
        
        if (activeFilters.has('loops') && track.content_type === 'loop') return true;
        if (activeFilters.has('loop_pack') && track.content_type === 'loop_pack') return true;
        if (activeFilters.has('ep') && track.content_type === 'ep') return true;
        if (activeFilters.has('songs') && track.content_type === 'full_song') return true;
        if (activeFilters.has('instrumental') && tags.includes('instrumental')) return true;
        if (activeFilters.has('beats') && tags.includes('beats')) return true;
        if (activeFilters.has('vocal') && tags.includes('vocal')) return true;
        if (activeFilters.has('stem') && tags.includes('stem')) return true;
        return false;
      });
    }

    // Limit to 10 results
    setResults(filtered.slice(0, 10));

    // Save to recent searches
    if (query && !recentSearches.includes(query)) {
      const updated = [query, ...recentSearches.slice(0, 4)];
      setRecentSearches(updated);
      localStorage.setItem('globe-recent-searches', JSON.stringify(updated));
    }
  };

  const handleExpand = () => {
    setIsExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClear = () => {
    setSearchQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const toggleFilter = (filter: FilterType) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filter)) {
      newFilters.delete(filter);
    } else {
      newFilters.add(filter);
    }
    setActiveFilters(newFilters);
  };

  const handleAddToCollection = (track: TrackNode) => {
    // Add animation state
    setAddedTracks(prev => new Set(prev).add(track.id));
    
    // Prepare complete track data for collection bar
    const collectionTrack = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      imageUrl: track.imageUrl,
      audioUrl: track.audioUrl,
      bpm: track.bpm || 120,
      content_type: track.content_type || 'loop',
      tags: track.tags,
      description: track.description,
      license: track.license,
      price_stx: track.price_stx,
      // Add any other fields the collection bar expects
      cover_image_url: track.imageUrl,
      audio_url: track.audioUrl
    };
    
    // Call the add function
    if (onAddToCollection) {
      onAddToCollection(collectionTrack);
    } else if ((window as any).addToCollection) {
      (window as any).addToCollection(collectionTrack);
    }

    // Remove animation state after delay
    setTimeout(() => {
      setAddedTracks(prev => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }, 1000);
  };

  const handleRecentSearch = (search: string) => {
    setSearchQuery(search);
    setShowRecent(false);
    inputRef.current?.focus();
  };

  return (
    <div 
      ref={searchRef}
      className={`
        fixed top-20 left-4 z-30 
        transition-all duration-300 ease-out
        ${isExpanded ? 'w-[300px]' : 'w-10 h-10'}
      `}
    >
      {/* Main container */}
      <div className={`${isExpanded ? 'bg-[#101726]/95 backdrop-blur-sm rounded-lg border border-[#1E293B] shadow-xl' : ''}`}>
        {/* Search bar */}
        <div className={`flex items-center ${isExpanded ? 'p-2' : 'p-0'}`}>
          {!isExpanded ? (
            <button
              onClick={handleExpand}
              className="p-1.5 hover:bg-[#1E293B] rounded transition-colors"
            >
              <Search className="w-5 h-5 text-[#81E4F2]" />
            </button>
          ) : (
            <>
              <Search className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowRecent(true)}
                placeholder="Search tracks, artists, tags..."
                className="
                  flex-1 bg-transparent text-xs text-white 
                  placeholder-gray-500 outline-none
                  font-mono
                "
                style={{ fontFamily: 'monospace' }}
              />
              {searchQuery && (
                <button
                  onClick={handleClear}
                  className="p-1 hover:bg-[#1E293B] rounded transition-colors"
                >
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              )}
              <button
                onClick={() => setIsPinned(!isPinned)}
                className="p-1 hover:bg-[#1E293B] rounded transition-colors ml-1"
                title={isPinned ? "Unpin search" : "Pin search"}
              >
                {isPinned ? '📌' : '📍'}
              </button>
            </>
          )}
        </div>

        {/* Filter chips */}
        {isExpanded && (
          <div className="px-2 pb-2 flex flex-wrap gap-1">
            {FILTER_TYPES.map(filter => (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={`
                  px-2 py-0.5 rounded text-[10px] font-mono
                  transition-all duration-200
                  ${activeFilters.has(filter.id)
                    ? 'bg-[#81E4F2] text-black'
                    : 'bg-[#1E293B] text-gray-400 hover:text-white'
                  }
                `}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {/* Recent searches dropdown */}
        {isExpanded && showRecent && !searchQuery && recentSearches.length > 0 && (
          <div className="border-t border-[#1E293B]">
            <div className="px-2 py-1 text-[10px] text-gray-500 font-mono">Recent</div>
            {recentSearches.map((search, idx) => (
              <button
                key={idx}
                onClick={() => handleRecentSearch(search)}
                className="
                  w-full px-2 py-1 text-left text-xs font-mono
                  text-gray-400 hover:bg-[#1E293B] hover:text-white
                  transition-colors
                "
              >
                {search}
              </button>
            ))}
          </div>
        )}

        {/* Search results */}
        {isExpanded && results.length > 0 && (
          <div className="border-t border-[#1E293B] max-h-[400px] overflow-y-auto">
            {results.map((track) => (
              <div
                key={track.id}
                className="
                  group px-2 py-1.5 hover:bg-[#1E293B] 
                  transition-colors border-b border-[#151C2A] last:border-b-0
                "
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-white truncate">
                      {track.title} - {track.artist}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-gray-500 font-mono">
                        {track.bpm ? `${track.bpm} BPM` : '---'}
                      </span>
                      <div className="flex gap-1">
                        {Array.isArray(track.tags) && track.tags.slice(0, 2).map((tag, idx) => (
                          <span key={idx} className="text-[10px] text-gray-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => onPlayPreview(track.id, track.audioUrl)}
                      className="
                        p-1 opacity-0 group-hover:opacity-100
                        hover:bg-[#252a3a] rounded transition-all
                      "
                      title="Preview"
                    >
                      {playingTrackId === track.id ? (
                        <div className="w-3 h-3 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Play className="w-3 h-3 text-[#81E4F2]" fill="currentColor" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        // Add to cart via global function
                        if ((window as any).addToCart) {
                          (window as any).addToCart(track);
                        }
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-[#252a3a] rounded transition-all hidden"
                      title="Add to Cart"
                    >
                      <svg className="w-3 h-3 text-[#81E4F2]" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleAddToCollection(track)}
                      className={`
                        p-1 hover:bg-[#252a3a] rounded
                        transition-all duration-300 hidden
                        ${addedTracks.has(track.id) ? 'animate-pulse' : ''}
                      `}
                      title="Add to Collection"
                    >
                      {addedTracks.has(track.id) ? (
                        <Check className="w-3 h-3 text-green-400" />
                      ) : (
                        <Plus className="w-3 h-3 text-[#81E4F2]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results message */}
        {isExpanded && searchQuery && debouncedSearch && results.length === 0 && (
          <div className="border-t border-[#1E293B] px-2 py-3 text-center">
            <p className="text-xs text-gray-500 font-mono">No results found</p>
          </div>
        )}
      </div>
    </div>
  );
}