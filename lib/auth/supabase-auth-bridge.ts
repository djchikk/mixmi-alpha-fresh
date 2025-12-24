import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface WalletAuthSession {
  supabase: SupabaseClient;
  isAuthenticated: boolean;
  walletAddress: string | null;
}

interface SuiAuthSession {
  supabase: SupabaseClient;
  isAuthenticated: boolean;
  suiAddress: string;
  walletAddress?: string | null; // Linked Stacks wallet if any
}

interface WalletVerificationOptions {
  signature?: string;
  message?: string;
  requireVerification?: boolean;
}

export class SupabaseAuthBridge {
  private static instance: SupabaseAuthBridge | null = null;
  private client: SupabaseClient | null = null;
  private currentWallet: string | null = null;

  /**
   * Creates a Supabase session using Stacks wallet address as authentication
   * This bridges the gap between Stacks wallet auth and Supabase RLS
   */
  static async createWalletSession(
    walletAddress: string,
    options: WalletVerificationOptions = {}
  ): Promise<WalletAuthSession> {
    try {
      if (!walletAddress) {
        throw new Error('Wallet address is required for authentication');
      }

      console.log('🔐 Creating wallet session for:', walletAddress.substring(0, 8) + '...');

      // Call server-side API to create JWT token securely
      const response = await fetch('/api/auth/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          walletAddress,
          signature: options.signature
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Session creation failed: ${errorData.error || response.statusText}`);
      }

      const { token, expires_at } = await response.json();
      console.log('✅ Received JWT token from server');

      // Create Supabase client with custom JWT token in headers
      // Instead of using auth.setSession(), we pass the JWT directly in the Authorization header
      // This avoids the need to have actual users in Supabase's auth.users table
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );

      console.log('✅ Supabase client created with wallet authentication');

      return {
        supabase,
        isAuthenticated: true,
        walletAddress
      };

    } catch (error) {
      console.error('🚨 Wallet session creation failed:', error);
      throw error;
    }
  }

  /**
   * Creates a Supabase session using SUI address as authentication (for zkLogin users)
   * This bridges the gap between SUI zkLogin auth and Supabase RLS
   */
  static async createSuiSession(suiAddress: string): Promise<SuiAuthSession> {
    try {
      if (!suiAddress) {
        throw new Error('SUI address is required for authentication');
      }

      console.log('🔐 Creating SUI session for:', suiAddress.substring(0, 10) + '...');

      // Call server-side API to create JWT token securely
      const response = await fetch('/api/auth/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ suiAddress })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Session creation failed: ${errorData.error || response.statusText}`);
      }

      const { token } = await response.json();
      console.log('✅ Received JWT token from server for SUI address');

      // Create Supabase client with custom JWT token in headers
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );

      console.log('✅ Supabase client created with SUI authentication');

      return {
        supabase,
        isAuthenticated: true,
        suiAddress
      };

    } catch (error) {
      console.error('🚨 SUI session creation failed:', error);
      throw error;
    }
  }

  /**
   * Creates a session using either wallet address or SUI address
   * Automatically detects which type of address is provided
   */
  static async createSession(address: string): Promise<WalletAuthSession | SuiAuthSession> {
    // SUI addresses start with 0x and are 66 characters (0x + 64 hex chars)
    const isSuiAddress = address.startsWith('0x') && address.length === 66;

    if (isSuiAddress) {
      return this.createSuiSession(address);
    } else {
      return this.createWalletSession(address);
    }
  }

  /**
   * Upload a file to Supabase storage with proper wallet-based authentication
   */
  static async uploadFileWithAuth(
    file: File,
    walletAddress: string,
    path?: string
  ): Promise<{ url: string; path: string }> {
    try {
      // Create authenticated session
      const session = await this.createWalletSession(walletAddress);

      // Generate file path
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
      const filePath = path || `${walletAddress}/gifs/${fileName}`;

      console.log('📤 Uploading file to:', filePath);

      // Upload file using authenticated Supabase client
      const { data: uploadData, error: uploadError } = await session.supabase.storage
        .from('user-content')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('🚨 Upload failed:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = session.supabase.storage
        .from('user-content')
        .getPublicUrl(filePath);

      console.log('✅ File uploaded successfully:', urlData.publicUrl);

      return {
        url: urlData.publicUrl,
        path: filePath
      };

    } catch (error) {
      console.error('🚨 Authenticated upload failed:', error);
      throw error;
    }
  }

  /**
   * Verify wallet signature (placeholder for future Stacks wallet integration)
   */
  private static async verifyStacksWalletSignature(
    walletAddress: string,
    signature: string
  ): Promise<boolean> {
    // TODO: Implement actual Stacks signature verification
    console.log('🔍 Wallet signature verification (placeholder):', { walletAddress, signature });
    return true; // For now, always return true
  }
}

export default SupabaseAuthBridge;
