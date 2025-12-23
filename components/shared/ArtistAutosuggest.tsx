"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ArtistAutosuggestProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  required?: boolean;
}

const STORAGE_KEY = 'mixmi_artist_suggestions';
const MAX_SUGGESTIONS = 20;
const MAX_DISPLAY = 5;

export default function ArtistAutosuggest({
  value,
  onChange,
  placeholder = "Artist or Project name",
  className = "",
  onBlur,
  required = false
}: ArtistAutosuggestProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load saved artists from localStorage on mount
  useEffect(() => {
    const loadSavedArtists = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const artists = JSON.parse(saved);
          setSuggestions(artists);
        }
      } catch (error) {
        console.error('Error loading artist suggestions:', error);
      }
    };
    loadSavedArtists();
  }, []);

  // Save artist name to localStorage
  const saveArtistName = useCallback((artistName: string) => {
    if (!artistName || artistName.trim() === '') return;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      let artists: string[] = saved ? JSON.parse(saved) : [];
      
      // Remove any existing occurrence (case-insensitive)
      artists = artists.filter(a => a.toLowerCase() !== artistName.toLowerCase());
      
      // Add the new artist at the beginning
      artists.unshift(artistName.trim());
      
      // Keep only the last MAX_SUGGESTIONS
      artists = artists.slice(0, MAX_SUGGESTIONS);
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(artists));
      setSuggestions(artists);
    } catch (error) {
      console.error('Error saving artist suggestion:', error);
    }
  }, []);

  // Filter suggestions based on input
  useEffect(() => {
    if (value && value.length > 0) {
      const filtered = suggestions.filter(artist =>
        artist.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered.slice(0, MAX_DISPLAY));
      setShowSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
    setSelectedIndex(-1);
  }, [value, suggestions]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          e.preventDefault();
          selectSuggestion(filteredSuggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Select a suggestion
  const selectSuggestion = (artist: string) => {
    onChange(artist);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Show suggestions when typing
    if (newValue.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle blur - save the artist name if it's new
  const handleInputBlur = () => {
    // Small delay to allow click on suggestion
    setTimeout(() => {
      if (value && value.trim() !== '') {
        saveArtistName(value);
      }
      setShowSuggestions(false);
      if (onBlur) onBlur();
    }, 200);
  };

  // Handle focus
  const handleInputFocus = () => {
    if (value && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="off"
      />
      
      {/* Suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {filteredSuggestions.map((artist, index) => (
            <button
              key={`${artist}-${index}`}
              type="button"
              className={`w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors ${
                index === selectedIndex ? 'bg-slate-700' : ''
              }`}
              onClick={() => selectSuggestion(artist)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center justify-between">
                <span className="text-white">{artist}</span>
                {index === selectedIndex && (
                  <span className="text-gray-400 text-xs">Press Enter</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}