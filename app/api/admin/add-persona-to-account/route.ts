import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { accountId, username, displayName, walletAddress, copyProfileData, adminCode } = await request.json();

    // Verify admin access
    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!accountId || !username) {
      return NextResponse.json(
        { error: 'Account ID and username are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if username already exists in personas
    const { data: existingPersonas, error: checkError } = await supabase
      .from('personas')
      .select('username')
      .eq('username', username.toLowerCase());

    if (checkError) {
      console.error('Error checking username:', checkError);
      return NextResponse.json(
        { error: 'Failed to check username: ' + checkError.message },
        { status: 500 }
      );
    }

    if (existingPersonas && existingPersonas.length > 0) {
      return NextResponse.json(
        { error: `Username "@${username}" is already taken in personas` },
        { status: 400 }
      );
    }

    // Verify account exists
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .maybeSingle();

    if (accountError) {
      console.error('Error checking account:', accountError);
      return NextResponse.json(
        { error: 'Failed to verify account: ' + accountError.message },
        { status: 500 }
      );
    }

    if (!account) {
      return NextResponse.json(
        { error: `Account not found: ${accountId}` },
        { status: 404 }
      );
    }

    // If wallet provided, get profile data
    let profileData = null;
    let trackCount = 0;
    if (walletAddress) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('display_name, avatar_url, bio, username')
        .eq('wallet_address', walletAddress)
        .single();

      profileData = profile;

      // Count tracks
      const { count } = await supabase
        .from('ip_tracks')
        .select('*', { count: 'exact', head: true })
        .eq('primary_uploader_wallet', walletAddress)
        .is('deleted_at', null);

      trackCount = count || 0;
    }

    // Determine display name and other fields
    const finalDisplayName = displayName ||
      (copyProfileData && profileData?.display_name) ||
      username;

    // Create the persona
    const { data: newPersona, error: personaError } = await supabase
      .from('personas')
      .insert({
        account_id: accountId,
        username: username.toLowerCase(),
        display_name: finalDisplayName,
        avatar_url: (copyProfileData && profileData?.avatar_url) || null,
        bio: (copyProfileData && profileData?.bio) || null,
        wallet_address: walletAddress || null,
        is_default: false,
        is_active: true,
        balance_usdc: 0
      })
      .select()
      .single();

    if (personaError) {
      console.error('Error creating persona:', personaError);
      return NextResponse.json(
        { error: 'Failed to create persona: ' + personaError.message },
        { status: 500 }
      );
    }

    // If wallet provided, link it to the account
    if (walletAddress) {
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('wallet_address')
        .eq('wallet_address', walletAddress)
        .single();

      if (existingProfile) {
        // Update existing profile with account_id
        await supabase
          .from('user_profiles')
          .update({ account_id: accountId })
          .eq('wallet_address', walletAddress);
      } else {
        // Create minimal profile
        await supabase
          .from('user_profiles')
          .insert({
            wallet_address: walletAddress,
            account_id: accountId,
            display_name: finalDisplayName,
            username: username.toLowerCase(),
            tagline: '',
            bio: '',
            sticker_id: 'daisy-blue',
            sticker_visible: true,
            show_wallet_address: true,
            show_btc_address: false
          });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created persona "@${username}" under account`,
      data: {
        personaId: newPersona.id,
        username: username.toLowerCase(),
        displayName: finalDisplayName,
        accountId,
        walletAddress: walletAddress || null,
        trackCount,
        copiedProfileData: copyProfileData && !!profileData
      }
    });

  } catch (error) {
    console.error('Error in add-persona-to-account:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
}
