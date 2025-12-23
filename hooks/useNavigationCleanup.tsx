"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { navigationManager } from '@/lib/navigationManager';

/**
 * Custom hook to handle navigation cleanup
 * Registers cleanup functions and handles route changes
 */
export function useNavigationCleanup(cleanup?: () => void | Promise<void>) {
  const pathname = usePathname();
  const cleanupRef = useRef(cleanup);
  const hasRegisteredRef = useRef(false);

  // Update cleanup ref when cleanup changes
  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  useEffect(() => {
    // Handle navigation when pathname changes
    navigationManager.handleNavigation(pathname);

    // Register cleanup for current route if provided and not already registered
    if (cleanup && !hasRegisteredRef.current) {
      navigationManager.registerCleanup(pathname, cleanup);
      hasRegisteredRef.current = true;
    }

    // Cleanup function for when component unmounts
    return () => {
      // Only run cleanup on unmount, not on every effect re-run
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      hasRegisteredRef.current = false;
    };
  }, [pathname]); // Remove cleanup from dependencies
}