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

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Alpha auth API called');
    
    const { walletAddress } = await request.json();
    
    if (!walletAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'Wallet address is required' 
      }, { status: 400 });
    }
    
    console.log('🔍 Checking alpha user:', walletAddress);
    
    // Validate wallet format
    if (!isValidWalletAddress(walletAddress)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid wallet address format. Please use a valid STX mainnet address (SP...)'
      }, { status: 400 });
    }
    
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
    const { data: user, error } = await supabase
      .from('alpha_users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .eq('approved', true)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      console.error('❌ Database error:', error);
      return NextResponse.json({
        success: false,
        error: 'Database error checking user status'
      }, { status: 500 });
    }
    
    if (!user) {
      console.log('❌ Wallet not approved:', walletAddress);
      return NextResponse.json({
        success: false,
        error: 'This wallet address is not approved for alpha access. Please contact support.'
      }, { status: 403 });
    }
    
    console.log('✅ Alpha user approved:', user.artist_name);
    
    // Return success with user info
    return NextResponse.json({
      success: true,
      user: user,
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