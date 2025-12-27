import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for deleting zklogin records
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { suiAddress } = body;

    if (!suiAddress) {
      return NextResponse.json(
        { error: 'Missing suiAddress' },
        { status: 400 }
      );
    }

    console.log('[zkLogin Disconnect] Attempting to disconnect:', suiAddress);

    // Find the zklogin record
    const { data: zkUser, error: findError } = await supabaseAdmin
      .from('zklogin_users')
      .select('*')
      .eq('sui_address', suiAddress)
      .single();

    if (findError || !zkUser) {
      console.log('[zkLogin Disconnect] No zklogin record found');
      return NextResponse.json(
        { error: 'No zkLogin record found for this address' },
        { status: 404 }
      );
    }

    // Delete the zklogin record
    const { error: deleteError } = await supabaseAdmin
      .from('zklogin_users')
      .delete()
      .eq('sui_address', suiAddress);

    if (deleteError) {
      console.error('[zkLogin Disconnect] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to disconnect zkLogin' },
        { status: 500 }
      );
    }

    console.log('[zkLogin Disconnect] Successfully disconnected:', suiAddress);

    return NextResponse.json({
      success: true,
      message: 'zkLogin disconnected successfully. You can now sign in again with a different invite code.',
      disconnectedInviteCode: zkUser.invite_code,
    });
  } catch (error) {
    console.error('[zkLogin Disconnect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
