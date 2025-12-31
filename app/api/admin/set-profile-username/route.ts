import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_CODE = 'mixmi-admin-2024';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/set-profile-username
 * Set username on a user_profiles entry by wallet address
 * Used when a profile doesn't have a username set yet
 */
export async function POST(request: NextRequest) {
  try {
    const { walletAddress, username, adminCode } = await request.json();

    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!walletAddress || !username) {
      return NextResponse.json(
        { error: 'Both walletAddress and username are required' },
        { status: 400 }
      );
    }

    const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');

    if (cleanUsername.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Check if username is already taken in user_profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('username', cleanUsername)
      .neq('wallet_address', walletAddress)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: `Username "${cleanUsername}" is already taken in user_profiles` },
        { status: 400 }
      );
    }

    // Check if username is already taken in personas
    const { data: existingPersona } = await supabaseAdmin
      .from('personas')
      .select('username')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existingPersona) {
      return NextResponse.json(
        { error: `Username "${cleanUsername}" is already taken by a persona` },
        { status: 400 }
      );
    }

    // Find the profile
    const { data: profile, error: findError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address, username, display_name')
      .eq('wallet_address', walletAddress)
      .single();

    if (findError || !profile) {
      return NextResponse.json(
        { error: `Profile with wallet "${walletAddress}" not found` },
        { status: 404 }
      );
    }

    // Update the username
    const { error: updateError } = await supabaseAdmin
      .from('user_profiles')
      .update({ username: cleanUsername })
      .eq('wallet_address', walletAddress);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile: ' + updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Username set to "${cleanUsername}" for wallet ${walletAddress.slice(0, 8)}...`,
      data: {
        walletAddress,
        oldUsername: profile.username,
        newUsername: cleanUsername,
        profileUrl: `mixmi.app/profile/${cleanUsername}`
      }
    });

  } catch (error) {
    console.error('Error in set-profile-username:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
