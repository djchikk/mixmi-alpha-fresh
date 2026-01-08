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
  // Create service role client directly (server-side only)
  private static getServiceClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
    }

    if (!serviceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
    }

    // Create a fresh client with service role key
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  // Validate Stacks wallet address format
  private static isValidStacksAddress(address: string): boolean {
    // Stacks mainnet addresses start with SP and range from 39-42 characters total
    const stacksMainnetPattern = /^SP[0-9A-Z]{37,40}$/;
    return stacksMainnetPattern.test(address.toUpperCase());
  }

  // Validate SUI address format (0x followed by 64 hex characters)
  private static isValidSuiAddress(address: string): boolean {
    const suiPattern = /^0x[a-fA-F0-9]{64}$/;
    return suiPattern.test(address);
  }

  // Validate alpha invite code format (e.g., mixmi-ABC123)
  private static isValidInviteCode(code: string): boolean {
    // Invite codes are typically formatted like mixmi-ABC123 or similar
    // Match alphanumeric codes with optional hyphens, 6-20 characters
    const inviteCodePattern = /^[A-Z0-9-]{6,20}$/i;
    return inviteCodePattern.test(code);
  }

  // Check if wallet or invite code is in approved alpha users list
  static async checkAlphaUser(input: string): Promise<AuthResult & { effectiveWallet?: string; authType?: 'wallet' | 'invite' | 'zklogin' }> {
    try {
      console.log('🔍 Checking alpha access for:', input);

      const supabase = this.getServiceClient();

      // Determine if input is a wallet address, SUI address, or invite code
      const isStacksWallet = this.isValidStacksAddress(input);
      const isSuiAddress = this.isValidSuiAddress(input);
      const isInviteCode = this.isValidInviteCode(input);

      // Handle SUI addresses - look up via zklogin_users or personas table
      if (isSuiAddress) {
        console.log('📝 Input type: SUI Address');

        // First check zklogin_users table for the invite code
        const { data: zkUser } = await supabase
          .from('zklogin_users')
          .select('invite_code, email')
          .eq('sui_address', input)
          .maybeSingle();

        if (zkUser?.invite_code) {
          // Verify the invite code is approved in alpha_users
          const { data: alphaUser } = await supabase
            .from('alpha_users')
            .select('wallet_address, artist_name, email, notes, approved, created_at, invite_code')
            .eq('invite_code', zkUser.invite_code.toUpperCase())
            .eq('approved', true)
            .maybeSingle();

          if (alphaUser) {
            console.log('✅ zkLogin user verified via invite code:', alphaUser.artist_name);
            return {
              success: true,
              user: alphaUser,
              authType: 'zklogin',
              effectiveWallet: input // Use SUI address as effective wallet
            };
          }
        }

        // Also check personas table - the SUI address might be a persona's sui_address
        const { data: persona } = await supabase
          .from('personas')
          .select('username, wallet_address, sui_address, account_id')
          .or(`sui_address.eq.${input},wallet_address.eq.${input}`)
          .eq('is_active', true)
          .maybeSingle();

        if (persona) {
          console.log('✅ Persona found:', persona.username);
          return {
            success: true,
            user: { wallet_address: input, artist_name: persona.username, approved: true, created_at: '' },
            authType: 'zklogin',
            effectiveWallet: input
          };
        }

        return {
          success: false,
          error: 'This SUI address is not associated with an approved alpha account.'
        };
      }

      if (!isStacksWallet && !isInviteCode) {
        return {
          success: false,
          error: 'Invalid format. Please provide a valid wallet address or alpha invite code.'
        };
      }

      console.log(`📝 Input type: ${isStacksWallet ? 'Stacks Wallet Address' : 'Invite Code'}`);

      // Query alpha_users table directly
      let query = supabase
        .from('alpha_users')
        .select('wallet_address, artist_name, email, notes, approved, created_at, invite_code')
        .eq('approved', true);

      if (isStacksWallet) {
        // Direct wallet address lookup
        query = query.eq('wallet_address', input);
      } else {
        // Invite code lookup
        query = query.eq('invite_code', input.toUpperCase());
      }

      const { data: users, error } = await query;

      if (error) {
        console.error('❌ Database error checking alpha user:');
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error details:', error.details);
        console.error('❌ Full error:', error);
        return {
          success: false,
          error: 'Database error checking user status'
        };
      }

      console.log('📊 Query result - User count:', users?.length);
      if (users && users.length > 0) {
        console.log('📊 Found user:', { wallet: users[0].wallet_address, artist: users[0].artist_name, invite_code: users[0].invite_code });
      }

      const user = users && users.length > 0 ? users[0] : null;

      if (!user) {
        console.log('❌ Not approved:', input);
        return {
          success: false,
          error: isStacksWallet
            ? 'This wallet is not approved for alpha access. Please use an invite code or contact support.'
            : 'Invalid invite code. Please check your code or contact support.'
        };
      }

      console.log('✅ Alpha user verified:', user.artist_name, `(${isStacksWallet ? 'wallet' : 'invite code'})`);
      return {
        success: true,
        user: user,
        authType: isStacksWallet ? 'wallet' : 'invite',
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