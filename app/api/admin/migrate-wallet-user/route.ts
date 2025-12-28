import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, personaUsername, inviteCode, adminCode } = await request.json();

    // Verify admin access
    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!walletAddress || !personaUsername) {
      return NextResponse.json(
        { error: 'Wallet address and persona username are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if wallet exists in user_profiles
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('user_profiles')
      .select('*, account_id')
      .eq('wallet_address', walletAddress)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      console.error('Error checking profile:', profileCheckError);
      return NextResponse.json(
        { error: 'Failed to check existing profile' },
        { status: 500 }
      );
    }

    // Check if username already exists in personas
    const { data: existingPersona } = await supabase
      .from('personas')
      .select('username')
      .eq('username', personaUsername)
      .single();

    if (existingPersona) {
      return NextResponse.json(
        { error: `Username "${personaUsername}" is already taken` },
        { status: 400 }
      );
    }

    // Check if user already has an account
    if (existingProfile?.account_id) {
      return NextResponse.json(
        { error: 'This wallet is already linked to an account. Use "Add Persona" instead.' },
        { status: 400 }
      );
    }

    // Count tracks for this wallet
    const { count: trackCount } = await supabase
      .from('ip_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('primary_uploader_wallet', walletAddress)
      .is('deleted_at', null);

    // 1. Create account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({})
      .select()
      .single();

    if (accountError) {
      console.error('Error creating account:', accountError);
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    // 2. Create or update alpha_users entry if invite code provided
    if (inviteCode) {
      const { data: existingInvite } = await supabase
        .from('alpha_users')
        .select('invite_code')
        .eq('invite_code', inviteCode)
        .single();

      if (existingInvite) {
        // Update existing entry
        await supabase
          .from('alpha_users')
          .update({ wallet_address: walletAddress })
          .eq('invite_code', inviteCode);
      } else {
        // Create new entry
        await supabase
          .from('alpha_users')
          .insert({
            invite_code: inviteCode,
            artist_name: existingProfile?.display_name || personaUsername,
            wallet_address: walletAddress,
            approved: true
          });
      }
    }

    // 3. Update or create user_profiles with account_id
    if (existingProfile) {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          account_id: account.id,
          username: existingProfile.username || personaUsername
        })
        .eq('wallet_address', walletAddress);

      if (updateError) {
        console.error('Error updating user_profiles:', updateError);
        await supabase.from('accounts').delete().eq('id', account.id);
        return NextResponse.json(
          { error: 'Failed to update user profile' },
          { status: 500 }
        );
      }
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          wallet_address: walletAddress,
          account_id: account.id,
          display_name: personaUsername,
          username: personaUsername,
          tagline: '',
          bio: '',
          sticker_id: 'daisy-blue',
          sticker_visible: true,
          show_wallet_address: true,
          show_btc_address: false
        });

      if (insertError) {
        console.error('Error creating user_profiles:', insertError);
        await supabase.from('accounts').delete().eq('id', account.id);
        return NextResponse.json(
          { error: 'Failed to create user profile' },
          { status: 500 }
        );
      }
    }

    // 4. Create persona with wallet_address
    const { error: personaError } = await supabase
      .from('personas')
      .insert({
        account_id: account.id,
        username: personaUsername,
        display_name: existingProfile?.display_name || personaUsername,
        avatar_url: existingProfile?.avatar_url || null,
        bio: existingProfile?.bio || null,
        wallet_address: walletAddress,
        is_default: true,
        is_active: true,
        balance_usdc: 0
      });

    if (personaError) {
      console.error('Error creating persona:', personaError);
      return NextResponse.json(
        { error: 'Failed to create persona' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Migrated wallet user to persona "@${personaUsername}"`,
      data: {
        accountId: account.id,
        username: personaUsername,
        walletAddress,
        trackCount: trackCount || 0,
        hadExistingProfile: !!existingProfile
      }
    });

  } catch (error) {
    console.error('Error in migrate-wallet-user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
