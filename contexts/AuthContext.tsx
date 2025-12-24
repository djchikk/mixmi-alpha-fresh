"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AppConfig, UserSession } from "@stacks/connect";
// Dynamic import to fix @stacks/connect v8.2.0 static import issues
import { StorageService } from "@/lib/storage";
import { STORAGE_KEYS } from "@/types";
import { SupabaseAuthBridge } from "@/lib/auth/supabase-auth-bridge";

type AuthContextType = {
  isAuthenticated: boolean;
  walletAddress: string | null;
  btcAddress: string | null;
  suiAddress: string | null;
  authType: 'wallet' | 'invite' | 'zklogin' | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
};

const defaultAuthState = {
  isAuthenticated: false,
  walletAddress: null,
  btcAddress: null,
  suiAddress: null,
  authType: null as 'wallet' | 'invite' | 'zklogin' | null
};

// Create a new AppConfig with the proper permissions
const appConfig = new AppConfig(['store_write']);
// Create a UserSession with the AppConfig
const userSession = new UserSession({ appConfig });

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    walletAddress: null as string | null,
    btcAddress: null as string | null,
    suiAddress: null as string | null,
    authType: null as 'wallet' | 'invite' | 'zklogin' | null
  });

  // Load auth state from storage and check if user is already signed in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check if user is already signed in with Stacks wallet
      if (userSession.isUserSignedIn()) {
        const userData = userSession.loadUserData();

        setAuth({
          isAuthenticated: true,
          walletAddress: userData.profile.stxAddress?.mainnet || null,
          btcAddress: userData.profile.btcAddress?.p2wpkh?.mainnet || null,
          suiAddress: null,
          authType: 'wallet'
        });
        return;
      }

      // Check for zkLogin auth in localStorage (set by callback page)
      const zkLoginAuth = localStorage.getItem('zklogin_auth');
      if (zkLoginAuth) {
        try {
          const authData = JSON.parse(zkLoginAuth);
          if (authData.type === 'zklogin' && authData.suiAddress) {
            console.log('✅ Restored zkLogin auth:', authData.email);
            console.log('🔗 Linked wallet:', authData.walletAddress);
            console.log('🆔 SUI address:', authData.suiAddress);
            setAuth({
              isAuthenticated: true,
              walletAddress: authData.walletAddress || null, // Linked Stacks wallet if any
              btcAddress: null,
              suiAddress: authData.suiAddress,
              authType: 'zklogin'
            });
            return;
          }
        } catch (error) {
          console.error('Failed to parse zklogin_auth:', error);
          localStorage.removeItem('zklogin_auth');
        }
      }

      // Check for invite code auth in localStorage
      const alphaAuth = localStorage.getItem('alpha_auth');
      if (alphaAuth) {
        try {
          const authData = JSON.parse(alphaAuth);
          if (authData.type === 'invite' && authData.walletAddress) {
            console.log('✅ Restored invite code auth:', authData.artistName);
            setAuth({
              isAuthenticated: true,
              walletAddress: authData.walletAddress,
              btcAddress: null, // Invite code users don't have BTC address
              suiAddress: null,
              authType: 'invite'
            });
            return;
          }
        } catch (error) {
          console.error('Failed to parse alpha_auth:', error);
          localStorage.removeItem('alpha_auth');
        }
      }

      // No auth found
      setAuth(defaultAuthState);
    }
  }, []);

  // Save auth state to storage when it changes
  useEffect(() => {
    if (auth.isAuthenticated) {
      StorageService.setItem(STORAGE_KEYS.AUTH, auth);
    }
  }, [auth]);

  const connectWallet = async () => {
    try {
      const appDetails = {
        name: "mixmi Profile",
        icon: window.location.origin + "/favicon.ico",
      };

      console.log("Connecting to wallet...");

      // Use dynamic import to fix @stacks/connect v8.2.0 static import issues
      const connectModule = await import("@stacks/connect");
      const connectFunction = connectModule.authenticate; // Use authenticate, not openConnect

      connectFunction({
        appDetails,
        redirectTo: '/',
        userSession,
        onFinish: async () => {
          console.log("Wallet connection finished");
          if (userSession.isUserSignedIn()) {
            const userData = userSession.loadUserData();
            console.log("User is signed in, data:", userData);

            // Extract addresses with fallbacks
            const stxAddress = userData.profile?.stxAddress?.mainnet || null;
            const btcAddress = userData.profile?.btcAddress?.p2wpkh?.mainnet || null;

            if (stxAddress) {
              // First set the auth state
              setAuth({
                isAuthenticated: true,
                walletAddress: stxAddress,
                btcAddress: btcAddress,
                suiAddress: null,
                authType: 'wallet'
              });

              // Log for debugging
              console.log("Wallet addresses set:", {
                stx: stxAddress,
                btc: btcAddress
              });

              // 🚀 Now create the Supabase session with JWT token
              try {
                console.log("🔐 Creating Supabase session for wallet:", stxAddress);
                await SupabaseAuthBridge.createWalletSession(stxAddress);
                console.log("✅ Supabase session created successfully");
              } catch (error) {
                console.error("🚨 Failed to create Supabase session:", error);
                // Don't fail the wallet connection if JWT creation fails
                // This allows the app to work in localStorage mode
              }
            } else {
              console.error("No STX address found in user data");
            }
          } else {
            console.log("User session finished but not signed in");
          }
        },
        onCancel: () => {
          console.log("Wallet connection canceled");
        }
      });
    } catch (error) {
      console.error("Error connecting to wallet:", error);

      // ALPHA UPLOADER: No fallback to mock data - let connection fail gracefully
      console.log("Wallet connection failed - users can still enter wallet address manually");
    }
  };

  const disconnectWallet = () => {
    if (userSession.isUserSignedIn()) {
      userSession.signUserOut();
    }

    // Clear all auth types from storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem('alpha_auth');
      localStorage.removeItem('zklogin_auth');

      // Clear zkLogin session from sessionStorage
      sessionStorage.removeItem('zklogin_session');
      sessionStorage.removeItem('zklogin_pending');
    }

    // ALPHA UPLOADER: Always completely clear auth data
    setAuth({
      isAuthenticated: false,
      walletAddress: null,
      btcAddress: null,
      suiAddress: null,
      authType: null
    });
    StorageService.removeItem(STORAGE_KEYS.AUTH);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated: auth.isAuthenticated,
      walletAddress: auth.walletAddress,
      btcAddress: auth.btcAddress,
      suiAddress: auth.suiAddress,
      authType: auth.authType,
      connectWallet,
      disconnectWallet
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
