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
  
  // Validate wallet address OR invite code format
  private static isValidInput(input: string): boolean {
    // Check for invite code format: MIXMI-ABC123
    const inviteCodePattern = /^MIXMI-[A-Z0-9]{6}$/;
    if (inviteCodePattern.test(input.toUpperCase())) {
      return true;
    }
    
    // Check for wallet address format: Stacks mainnet addresses start with SP
    const stacksMainnetPattern = /^SP[0-9A-Z]{37,40}$/;
    return stacksMainnetPattern.test(input.toUpperCase());
  }
  
  // Check if wallet is in approved alpha users list
  static async checkAlphaUser(walletAddress: string): Promise<AuthResult> {
    try {
      console.log('Checking alpha user status for:', walletAddress);
      
      // Validate input format first (invite code or wallet address)
      if (!this.isValidInput(walletAddress)) {
        return {
          success: false,
          error: 'Invalid format. Please use an invite code (MIXMI-ABC123) or STX wallet address (SP...)'
        };
      }
      
      // Query alpha_users table - supports both invite codes and wallet addresses
      const supabase = this.getServiceClient();
      const { data: user, error } = await supabase.rpc('validate_alpha_invite', {
        input_code: walletAddress
      }).single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Database error checking alpha user:', error);
        return {
          success: false,
          error: 'Database error checking user status'
        };
      }
      
      if (!user || !user.approved) {
        console.log('Input not found in alpha users list or not approved:', walletAddress);
        return {
          success: false,
          error: 'This invite code or wallet address is not approved for alpha access. Please contact support.'
        };
      }
      
      console.log('Alpha user verified:', user.artist_name);
      return {
        success: true,
        user: user
        // Note: supabaseClient intentionally removed for security - never expose service role key to client
      };
      
    } catch (error) {
      console.error('Error in alpha user check:', error);
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