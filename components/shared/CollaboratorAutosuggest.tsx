"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';

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
}

export default function CollaboratorAutosuggest({
  value,
  onChange,
  onUserSelect,
  placeholder = "Name or wallet address",
  className = "",
  disabled = false
}: CollaboratorAutosuggestProps) {
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Search for users
  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Don't search if it looks like a wallet address
    if (query.startsWith('0x') || query.startsWith('SP') || query.startsWith('ST')) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/profile/search-users?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const { users } = await response.json();
        setSuggestions(users);
        setShowSuggestions(users.length > 0);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

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
                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-600 flex-shrink-0">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.displayName || user.username || 'User'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                      {(user.displayName || user.username || '?')[0].toUpperCase()}
                    </div>
                  )}
                </div>

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

      {/* Hint text */}
      {showSuggestions && suggestions.length === 0 && value.length >= 2 && !isSearching && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-lg p-3">
          <p className="text-gray-400 text-sm">
            No users found. You can enter a wallet address or name directly.
          </p>
        </div>
      )}
    </div>
  );
}
