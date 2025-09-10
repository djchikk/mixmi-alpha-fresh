/**
 * Navigation Manager
 * Ensures proper cleanup and state management when navigating between pages
 * Prevents multiple component instances and memory leaks
 */

import { audioContextManager } from './audioContextManager';

type CleanupFunction = () => void | Promise<void>;

class NavigationManager {
  private static instance: NavigationManager;
  private cleanupFunctions: Map<string, CleanupFunction[]> = new Map();
  private currentRoute: string = '';
  private previousRoute: string = '';

  private constructor() {}

  static getInstance(): NavigationManager {
    if (!NavigationManager.instance) {
      NavigationManager.instance = new NavigationManager();
    }
    return NavigationManager.instance;
  }

  /**
   * Register a cleanup function for a specific route
   */
  registerCleanup(route: string, cleanup: CleanupFunction): void {
    if (!this.cleanupFunctions.has(route)) {
      this.cleanupFunctions.set(route, []);
    }
    this.cleanupFunctions.get(route)!.push(cleanup);
    console.log(`🧹 Registered cleanup for route: ${route}`);
  }

  /**
   * Execute all cleanup functions for a route
   */
  private async executeCleanups(route: string): Promise<void> {
    const cleanups = this.cleanupFunctions.get(route) || [];
    if (cleanups.length === 0) return;
    
    console.log(`🧹 Executing ${cleanups.length} cleanup functions for route: ${route}`);
    
    // Clear the cleanup functions immediately to prevent duplicate execution
    this.cleanupFunctions.delete(route);
    
    for (const cleanup of cleanups) {
      try {
        await cleanup();
      } catch (error) {
        console.error(`❌ Cleanup error for route ${route}:`, error);
      }
    }
  }

  /**
   * Handle navigation between routes
   */
  async handleNavigation(newRoute: string): Promise<void> {
    this.previousRoute = this.currentRoute;
    this.currentRoute = newRoute;

    console.log(`🚀 Navigating from ${this.previousRoute} to ${this.currentRoute}`);

    // Execute cleanup for the previous route
    if (this.previousRoute) {
      await this.executeCleanups(this.previousRoute);
    }

    // Special handling for store navigation
    if (this.isStoreRoute(this.previousRoute) && this.isStoreRoute(this.currentRoute)) {
      console.log('🏪 Navigating between creator stores - ensuring single instance');
      // Suspend audio context temporarily to free resources
      await audioContextManager.suspend();
      // Small delay to ensure proper cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      // Resume audio context
      await audioContextManager.resume();
    }
  }

  /**
   * Check if a route is a store route
   */
  private isStoreRoute(route: string): boolean {
    return route.startsWith('/store/');
  }

  /**
   * Get current route
   */
  getCurrentRoute(): string {
    return this.currentRoute;
  }

  /**
   * Get previous route
   */
  getPreviousRoute(): string {
    return this.previousRoute;
  }

  /**
   * Clear all cleanup functions (use with caution)
   */
  clearAllCleanups(): void {
    this.cleanupFunctions.clear();
    console.log('🧹 Cleared all cleanup functions');
  }
}

// Export singleton instance
export const navigationManager = NavigationManager.getInstance();