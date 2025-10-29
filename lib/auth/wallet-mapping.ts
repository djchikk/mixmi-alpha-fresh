// Wallet Mapping Utility for Alpha Code → Wallet Address conversion
// Ensures blockchain operations use actual wallet addresses, not alpha codes

import { createClient } from '@supabase/supabase-js';

/**
 * Convert alpha code or wallet address to actual wallet address
 * @param authIdentity - Either alpha code (mixmi-ABC123) or wallet address (SP...)
 * @returns Promise<string | null> - Actual wallet address or null if not found
 */
export async function getWalletFromAuthIdentity(authIdentity: string): Promise<string | null> {
  if (!authIdentity) return null;
  
  // If it's already a wallet address, return it directly
  const walletPattern = /^S[PM][0-9A-Z]{37,40}$/;
  if (walletPattern.test(authIdentity.toUpperCase())) {
    return authIdentity;
  }
  
  // If it's an alpha code, look up the associated wallet
  const alphaCodePattern = /^MIXMI-[A-Z0-9]{6}$/;
  if (alphaCodePattern.test(authIdentity.toUpperCase())) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );
      
      const { data: user, error } = await supabase
        .from('alpha_users')
        .select('wallet_address')
        .eq('invite_code', authIdentity.toUpperCase())
        .eq('approved', true)
        .single();
      
      if (error || !user) {
        console.error('Could not find wallet for alpha code:', authIdentity);
        return null;
      }
      
      return user.wallet_address;
    } catch (error) {
      console.error('Error looking up wallet for alpha code:', error);
      return null;
    }
  }
  
  // Neither format recognized
  return null;
}

/**
 * Validate that an input is a proper Stacks wallet address (not alpha code)
 * @param input - String to validate
 * @returns boolean - True if valid wallet address format
 */
export function isValidStacksAddress(input: string): boolean {
  if (!input) return false;
  const walletPattern = /^S[PM][0-9A-Z]{37,40}$/;
  return walletPattern.test(input.toUpperCase());
}

/**
 * Check if input is an alpha code format
 * @param input - String to check
 * @returns boolean - True if alpha code format
 */
export function isAlphaCode(input: string): boolean {
  if (!input) return false;
  const alphaCodePattern = /^MIXMI-[A-Z0-9]{6}$/;
  return alphaCodePattern.test(input.toUpperCase());
}