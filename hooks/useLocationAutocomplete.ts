import { useState, useRef, useCallback } from 'react';
import { searchHardcodedLocations, LocationData } from '@/lib/locationLookup';

interface LocationSuggestion {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  properties?: {
    short_code?: string;
  };
}

interface UseLocationAutocompleteProps {
  minCharacters?: number;
  debounceMs?: number;
  types?: string; // e.g., 'country,place,locality,neighborhood'
  limit?: number;
}

export function useLocationAutocomplete({
  minCharacters = 3,
  debounceMs = 300,
  types = 'country,place,locality,neighborhood,address',
  limit = 5
}: UseLocationAutocompleteProps = {}) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const abortController = useRef<AbortController | null>(null);

  // Cache for recent searches
  const cache = useRef<Map<string, LocationSuggestion[]>>(new Map());

  const searchMapbox = async (query: string) => {
    // Check cache first
    const cached = cache.current.get(query.toLowerCase());
    if (cached) {
      setSuggestions(cached);
      return;
    }

    // Cancel previous request if still pending
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create new abort controller for this request
    abortController.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      // Use Supabase Edge Function for secure Mapbox API access
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('Supabase config not found. Location search unavailable.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/search-locations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            query,
            types,
            limit
          }),
          signal: abortController.current.signal
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      const locations = data.suggestions || [];

      // Cache the results
      cache.current.set(query.toLowerCase(), locations);
      
      // Keep cache size reasonable (max 50 entries)
      if (cache.current.size > 50) {
        const firstKey = cache.current.keys().next().value;
        cache.current.delete(firstKey);
      }

      setSuggestions(locations);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Location search error:', err);
        setError('Failed to search locations');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const searchMapboxAndMerge = async (query: string, localSuggestions: LocationSuggestion[]) => {
    // Cancel previous request if still pending
    if (abortController.current) {
      abortController.current.abort();
    }

    // Create new abort controller for this request
    abortController.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      // Use Supabase Edge Function for secure Mapbox API access
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('Supabase config not found. Using local results only.');
        setSuggestions(localSuggestions);
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/search-locations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            query,
            types,
            limit: Math.max(2, limit - localSuggestions.length) // Request fewer Mapbox results
          }),
          signal: abortController.current.signal
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data = await response.json();
      const mapboxLocations = data.suggestions || [];

      // Cache the Mapbox results
      cache.current.set(query.toLowerCase(), mapboxLocations);
      
      // Merge local + Mapbox results, avoiding duplicates
      const combined = [...localSuggestions, ...mapboxLocations];
      const unique = combined.filter((item, index, arr) => 
        arr.findIndex(other => other.place_name === item.place_name) === index
      );

      setSuggestions(unique.slice(0, limit));
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Mapbox search error:', err);
        // Keep local results if Mapbox fails
        setSuggestions(localSuggestions);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = useCallback((value: string) => {
    // Clear timeout if exists
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    // Clear suggestions if input is too short
    if (value.length < minCharacters) {
      setSuggestions([]);
      return;
    }

    // Instant local search (no debounce needed - it's fast!)
    const localResults = searchHardcodedLocations(value, 3);
    
    // Convert to LocationSuggestion format
    const localSuggestions: LocationSuggestion[] = localResults.map(location => ({
      id: `local-${location.name.toLowerCase().replace(/\s+/g, '-')}`,
      place_name: location.name,
      text: location.name,
      center: [location.lng, location.lat], // [lng, lat] format
      place_type: [location.name.includes('Reservation') || location.name.includes('Nation') ? 'territory' : 'place'],
      properties: {}
    }));

    // Show local results immediately
    setSuggestions(localSuggestions);

    // Also search Mapbox for additional results (debounced)
    searchTimeout.current = setTimeout(async () => {
      try {
        const cached = cache.current.get(value.toLowerCase());
        if (cached) {
          // Merge local + cached Mapbox results
          const combined = [...localSuggestions, ...cached];
          const unique = combined.filter((item, index, arr) => 
            arr.findIndex(other => other.place_name === item.place_name) === index
          );
          setSuggestions(unique.slice(0, limit));
          return;
        }

        // Call Mapbox and merge results
        await searchMapboxAndMerge(value, localSuggestions);
      } catch (error) {
        // If Mapbox fails, keep local results
        console.log('Mapbox search failed, showing local results only');
      }
    }, debounceMs);
  }, [minCharacters, debounceMs, limit]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  const cleanup = useCallback(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    if (abortController.current) {
      abortController.current.abort();
    }
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    handleInputChange,
    clearSuggestions,
    cleanup
  };
}