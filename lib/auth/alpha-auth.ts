// Alpha User Authentication System
// Simple whitelist-based authentication for alpha uploader
// Replaces complex JWT user creation with service role + wallet validation

import { createClient } from '@supabase/supabase-js';

interface AlphaUser {
  wallet_address: string;
  artist_name: string;
  email?: string;
  notes?: string;
  approved: boolean;
  created_at: string;
}

interface AuthResult {
  success: boolean;
  user?: AlphaUser;
  error?: string;
}

export class AlphaAuth {
  // Get environment variables dynamically to avoid client/server issues
  private static getEnvVars() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', { 
        hasUrl: !!supabaseUrl, 
        hasServiceKey: !!serviceRoleKey 
      });
      throw new Error('Missing required environment variables');
    }
    
    return { supabaseUrl, serviceRoleKey };
  }
  
  // Create service role client (server-side only, never exposed to users)
  private static getServiceClient() {
    const { supabaseUrl, serviceRoleKey } = this.getEnvVars();
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  // Validate wallet address format
  private static isValidWalletAddress(address: string): boolean {
    // Stacks mainnet addresses start with SP and range from 39-42 characters total
    const stacksMainnetPattern = /^SP[0-9A-Z]{37,40}$/;
    return stacksMainnetPattern.test(address.toUpperCase());
  }

  // Validate alpha invite code format (e.g., MIXMI-ABC123)
  private static isValidInviteCode(code: string): boolean {
    // Invite codes are typically formatted like MIXMI-ABC123 or similar
    // Match alphanumeric codes with optional hyphens, 6-20 characters
    const inviteCodePattern = /^[A-Z0-9-]{6,20}$/i;
    return inviteCodePattern.test(code);
  }

  // Check if wallet or invite code is in approved alpha users list
  static async checkAlphaUser(input: string): Promise<AuthResult & { effectiveWallet?: string; authType?: 'wallet' | 'invite' }> {
    try {
      console.log('🔍 Checking alpha access for:', input);

      // Determine if input is a wallet address or invite code
      const isWallet = this.isValidWalletAddress(input);
      const isInviteCode = this.isValidInviteCode(input);

      if (!isWallet && !isInviteCode) {
        return {
          success: false,
          error: 'Invalid format. Please provide a valid Stacks wallet address (SP...) or alpha invite code.'
        };
      }

      console.log(`📝 Input type: ${isWallet ? 'Wallet Address' : 'Invite Code'}`);

      // Query alpha_users table directly
      const supabase = this.getServiceClient();
      let query = supabase
        .from('alpha_users')
        .select('wallet_address, artist_name, email, notes, approved, created_at, invite_code')
        .eq('approved', true);

      if (isWallet) {
        // Direct wallet address lookup
        query = query.eq('wallet_address', input);
      } else {
        // Invite code lookup
        query = query.eq('invite_code', input.toUpperCase());
      }

      const { data: users, error } = await query;

      if (error) {
        console.error('❌ Database error checking alpha user:', error);
        return {
          success: false,
          error: 'Database error checking user status'
        };
      }

      const user = users && users.length > 0 ? users[0] : null;

      if (!user) {
        console.log('❌ Not approved:', input);
        return {
          success: false,
          error: isWallet
            ? 'This wallet is not approved for alpha access. Please use an invite code or contact support.'
            : 'Invalid invite code. Please check your code or contact support.'
        };
      }

      console.log('✅ Alpha user verified:', user.artist_name, `(${isWallet ? 'wallet' : 'invite code'})`);
      return {
        success: true,
        user: user,
        authType: isWallet ? 'wallet' : 'invite',
        effectiveWallet: user.wallet_address
      };

    } catch (error) {
      console.error('❌ Error in alpha user check:', error);
      return {
        success: false,
        error: 'System error during authentication'
      };
    }
  }
  
  // Simple authentication for alpha uploads
  static async authenticateAlphaUser(walletAddress: string): Promise<AuthResult> {
    console.log('Authenticating alpha user:', walletAddress);
    
    const result = await this.checkAlphaUser(walletAddress);
    
    if (result.success) {
      console.log('Alpha user authenticated successfully');
    } else {
      console.log('Alpha user authentication failed:', result.error);
    }
    
    return result;
  }
}

// Export for easy importing
export default AlphaAuth;