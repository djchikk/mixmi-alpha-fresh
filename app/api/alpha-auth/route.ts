// Alpha User Authentication API Endpoint
// Server-side authentication with access to service role key

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface AlphaUser {
  wallet_address: string;
  artist_name: string;
  email?: string;
  notes?: string;
  approved: boolean;
  created_at: string;
}

// Validate wallet address format
function isValidWalletAddress(address: string): boolean {
  // Stacks mainnet addresses start with SP and range from 39-42 characters total
  const stacksMainnetPattern = /^SP[0-9A-Z]{37,40}$/;
  return stacksMainnetPattern.test(address.toUpperCase());
}

// Validate alpha invite code format (e.g., mixmi-ABC123)
function isValidInviteCode(code: string): boolean {
  // Invite codes are typically formatted like mixmi-ABC123 or similar
  // Match alphanumeric codes with optional hyphens, 6-20 characters
  const inviteCodePattern = /^[A-Z0-9-]{6,20}$/i;
  return inviteCodePattern.test(code);
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Alpha auth API called');

    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({
        success: false,
        error: 'Wallet address or invite code is required'
      }, { status: 400 });
    }

    console.log('🔍 Checking alpha access for:', walletAddress);

    // Determine if input is a wallet address or invite code
    const isWallet = isValidWalletAddress(walletAddress);
    const isInviteCode = isValidInviteCode(walletAddress);

    if (!isWallet && !isInviteCode) {
      return NextResponse.json({
        success: false,
        error: 'Invalid format. Please provide a valid Stacks wallet address (SP...) or alpha invite code.'
      }, { status: 400 });
    }

    console.log(`📝 Input type: ${isWallet ? 'Wallet Address' : 'Invite Code'}`);
    
    // Get environment variables (available server-side)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('❌ Missing environment variables on server');
      return NextResponse.json({
        success: false,
        error: 'Server configuration error'
      }, { status: 500 });
    }
    
    console.log('✅ Environment variables available');
    
    // Create service role client
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Query alpha_users table
    // Check by wallet_address if it's a wallet, or by invite_code if it's an invite code
    let query = supabase
      .from('alpha_users')
      .select('wallet_address, artist_name, email, notes, approved, created_at, invite_code')
      .eq('approved', true);

    if (isWallet) {
      // Direct wallet address lookup
      query = query.eq('wallet_address', walletAddress);
    } else {
      // Invite code lookup
      query = query.eq('invite_code', walletAddress.toUpperCase());
    }

    const { data: users, error } = await query;

    if (error) {
      console.error('❌ Database error:', error);
      return NextResponse.json({
        success: false,
        error: 'Database error checking user status'
      }, { status: 500 });
    }

    const user = users && users.length > 0 ? users[0] : null;

    if (!user) {
      console.log('❌ Not approved:', walletAddress);
      return NextResponse.json({
        success: false,
        error: isWallet
          ? 'This wallet is not approved for alpha access. Please use an invite code or contact support.'
          : 'Invalid invite code. Please check your code or contact support.'
      }, { status: 403 });
    }

    console.log('✅ Alpha user approved:', user.artist_name, `(${isWallet ? 'wallet' : 'invite code'})`);

    // Return success with user info and auth type
    return NextResponse.json({
      success: true,
      user: user,
      authType: isWallet ? 'wallet' : 'invite',
      effectiveWallet: user.wallet_address,
      message: `Welcome, ${user.artist_name}!`
    });
    
  } catch (error) {
    console.error('❌ Alpha auth API error:', error);
    return NextResponse.json({
      success: false,
      error: 'System error during authentication'
    }, { status: 500 });
  }
}