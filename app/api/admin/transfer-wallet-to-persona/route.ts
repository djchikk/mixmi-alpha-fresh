import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { sourceWallet, targetPersonaUsername, copyProfileData, adminCode } = await request.json();

    // Verify admin access
    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!sourceWallet || !targetPersonaUsername) {
      return NextResponse.json(
        { error: 'Source wallet and target persona username are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch source profile
    const { data: sourceProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('wallet_address', sourceWallet)
      .single();

    // Profile might not exist if it's just tracks without a profile
    const hasSourceProfile = !profileError && sourceProfile;

    // 2. Fetch target persona
    const { data: targetPersona, error: personaError } = await supabase
      .from('personas')
      .select('*')
      .eq('username', targetPersonaUsername)
      .single();

    if (personaError || !targetPersona) {
      return NextResponse.json(
        { error: `Could not find persona "@${targetPersonaUsername}"` },
        { status: 404 }
      );
    }

    // 3. Count tracks for this wallet
    const { count: trackCount } = await supabase
      .from('ip_tracks')
      .select('*', { count: 'exact', head: true })
      .eq('primary_uploader_wallet', sourceWallet)
      .is('deleted_at', null);

    // 4. Copy profile data to persona if requested and source has data
    if (copyProfileData && hasSourceProfile) {
      const { error: updatePersonaError } = await supabase
        .from('personas')
        .update({
          display_name: sourceProfile.display_name || targetPersona.display_name,
          avatar_url: sourceProfile.avatar_url || targetPersona.avatar_url,
          bio: sourceProfile.bio || targetPersona.bio,
        })
        .eq('id', targetPersona.id);

      if (updatePersonaError) {
        console.error('Error updating persona with profile data:', updatePersonaError);
      }
    }

    // 5. Link wallet to the persona's account (update user_profiles.account_id)
    if (hasSourceProfile) {
      const { error: linkError } = await supabase
        .from('user_profiles')
        .update({ account_id: targetPersona.account_id })
        .eq('wallet_address', sourceWallet);

      if (linkError) {
        console.error('Error linking wallet to account:', linkError);
        return NextResponse.json(
          { error: 'Failed to link wallet to account' },
          { status: 500 }
        );
      }
    } else {
      // Create a minimal profile entry for the wallet
      const { error: createError } = await supabase
        .from('user_profiles')
        .insert({
          wallet_address: sourceWallet,
          account_id: targetPersona.account_id,
          display_name: targetPersona.display_name || targetPersonaUsername,
          tagline: '',
          bio: '',
          sticker_id: 'daisy-blue',
          sticker_visible: true,
          show_wallet_address: true,
          show_btc_address: false
        });

      if (createError) {
        console.error('Error creating profile for wallet:', createError);
        return NextResponse.json(
          { error: 'Failed to create profile for wallet' },
          { status: 500 }
        );
      }
    }

    // 6. Set wallet_address on persona (for primary data lookup)
    // Only set if persona doesn't already have a wallet
    if (!targetPersona.wallet_address) {
      const { error: walletLinkError } = await supabase
        .from('personas')
        .update({ wallet_address: sourceWallet })
        .eq('id', targetPersona.id);

      if (walletLinkError) {
        console.error('Error setting wallet on persona:', walletLinkError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Transferred wallet to @${targetPersonaUsername}`,
      data: {
        sourceWallet: sourceWallet.slice(0, 12) + '...',
        targetPersona: targetPersonaUsername,
        accountId: targetPersona.account_id,
        trackCount: trackCount || 0,
        copiedProfileData: copyProfileData && hasSourceProfile,
        personaWalletSet: !targetPersona.wallet_address
      }
    });

  } catch (error) {
    console.error('Error in transfer-wallet-to-persona:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
