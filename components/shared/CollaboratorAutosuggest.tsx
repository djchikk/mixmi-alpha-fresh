"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface User {
  walletAddress: string | null;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  suiAddress: string | null;
  isPersona: boolean;
}

interface CollaboratorAutosuggestProps {
  value: string;
  onChange: (value: string) => void;
  onUserSelect?: (user: User) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Uploader's wallet - required to create managed personas */
  uploaderWallet?: string;
  /** Callback when a new persona is created */
  onPersonaCreated?: (persona: { username: string; displayName: string; walletAddress: string }) => void;
}

export default function CollaboratorAutosuggest({
  value,
  onChange,
  onUserSelect,
  placeholder = "Name or wallet address",
  className = "",
  disabled = false,
  uploaderWallet,
  onPersonaCreated
}: CollaboratorAutosuggestProps) {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState(''); // Track what we searched for
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchedQuery('');
      return;
    }

    // Don't search if it looks like a wallet address
    if (query.startsWith('0x') || query.startsWith('SP') || query.startsWith('ST')) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSearchedQuery('');
      return;
    }

    setIsSearching(true);
    setSearchedQuery(query);
    try {
      const response = await fetch(`/api/profile/search-users?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const { users } = await response.json();
        setSuggestions(users);
        // Show dropdown even when no results (to offer create option)
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Create managed persona for collaborator
  const handleCreatePersona = async () => {
    if (!uploaderWallet || !searchedQuery.trim()) return;

    setIsCreatingPersona(true);
    try {
      const response = await fetch('/api/upload-studio/create-collaborator-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploaderWallet,
          collaboratorName: searchedQuery.trim()
        })
      });

      const data = await response.json();

      if (response.ok && data.persona) {
        // Fill in the wallet address
        onChange(data.persona.walletAddress || data.persona.suiAddress);
        setShowSuggestions(false);

        // Notify parent if callback provided
        if (onPersonaCreated) {
          onPersonaCreated({
            username: data.persona.username,
            displayName: data.persona.displayName,
            walletAddress: data.persona.walletAddress || data.persona.suiAddress
          });
        }
      } else {
        console.error('Failed to create persona:', data.error);
        alert(data.error || 'Failed to create managed persona');
      }
    } catch (error) {
      console.error('Error creating persona:', error);
      alert('Failed to create managed persona');
    } finally {
      setIsCreatingPersona(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [value, searchUsers]);

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
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          selectUser(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Select a user
  const selectUser = (user: User) => {
    // Prefer SUI address, fall back to wallet address
    const walletToUse = user.suiAddress || user.walletAddress || '';
    onChange(walletToUse);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    if (onUserSelect) {
      onUserSelect(user);
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setSelectedIndex(-1);
  };

  // Handle focus
  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Truncate wallet address for display
  const truncateAddress = (address: string | null) => {
    if (!address) return '';
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
        autoComplete="off"
      />

      {/* Loading indicator */}
      {isSearching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-[#81E4F2] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-slate-700">
            Select a mixmi user
          </div>
          {suggestions.map((user, index) => (
            <button
              key={user.walletAddress || user.username || index}
              type="button"
              className={`w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors ${
                index === selectedIndex ? 'bg-slate-700' : ''
              }`}
              onClick={() => selectUser(user)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <UserAvatar
                  src={user.avatarUrl}
                  name={user.username || user.displayName || user.walletAddress || '?'}
                  size={32}
                />

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {user.displayName || user.username || 'Unknown'}
                  </div>
                  <div className="text-gray-400 text-xs truncate">
                    {user.username && `@${user.username}`}
                    {user.suiAddress && (
                      <span className="ml-2 text-[#81E4F2]">
                        {truncateAddress(user.suiAddress)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Badge */}
                {user.isPersona && (
                  <span className="text-xs px-1.5 py-0.5 bg-[#81E4F2]/20 text-[#81E4F2] rounded">
                    SUI
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results - offer to create managed persona */}
      {showSuggestions && suggestions.length === 0 && value.length >= 2 && !isSearching && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg"
        >
          <div className="p-3 border-b border-slate-700">
            <p className="text-gray-400 text-sm">
              No mixmi users found for "{searchedQuery}"
            </p>
          </div>

          {/* Create managed persona option */}
          {uploaderWallet && (
            <button
              type="button"
              onClick={handleCreatePersona}
              disabled={isCreatingPersona}
              className="w-full text-left px-3 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700 disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#81E4F2]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#81E4F2]">+</span>
                </div>
                <div className="flex-1">
                  <div className="text-[#81E4F2] text-sm font-medium">
                    {isCreatingPersona ? 'Creating...' : `Create managed wallet for "${searchedQuery}"`}
                  </div>
                  <div className="text-gray-400 text-xs">
                    You'll hold their earnings until you pay them
                  </div>
                </div>
              </div>
            </button>
          )}

          <div className="p-2 text-center">
            <p className="text-gray-500 text-xs">
              Or paste a wallet address directly
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
