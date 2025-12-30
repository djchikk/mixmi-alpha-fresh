import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { username, displayName, inviteCode, adminCode } = await request.json();

    // Verify admin access
    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!username || !inviteCode) {
      return NextResponse.json(
        { error: 'Username and invite code are required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if username already exists in personas
    const { data: existingPersona } = await supabase
      .from('personas')
      .select('username')
      .eq('username', username)
      .single();

    if (existingPersona) {
      return NextResponse.json(
        { error: `Username "${username}" is already taken` },
        { status: 400 }
      );
    }

    // Check if invite code already exists
    const { data: existingInvite } = await supabase
      .from('alpha_users')
      .select('invite_code')
      .eq('invite_code', inviteCode)
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: `Invite code "${inviteCode}" already exists` },
        { status: 400 }
      );
    }

    // Create placeholder wallet address for zkLogin user
    const placeholderWallet = `ZKLOGIN-${username}`;

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

    // 2. Create alpha_users entry
    const { error: alphaError } = await supabase
      .from('alpha_users')
      .insert({
        invite_code: inviteCode,
        artist_name: displayName || username,
        wallet_address: placeholderWallet,
        approved: true
      });

    if (alphaError) {
      console.error('Error creating alpha_users:', alphaError);
      // Rollback account
      await supabase.from('accounts').delete().eq('id', account.id);
      return NextResponse.json(
        { error: 'Failed to create alpha user entry' },
        { status: 500 }
      );
    }

    // 3. Create user_profiles entry
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        wallet_address: placeholderWallet,
        account_id: account.id,
        display_name: displayName || username,
        username: username,
        tagline: '',
        bio: '',
        sticker_id: 'daisy-blue',
        sticker_visible: true,
        show_wallet_address: false,
        show_btc_address: false
      });

    if (profileError) {
      console.error('Error creating user_profiles:', profileError);
      // Rollback
      await supabase.from('alpha_users').delete().eq('invite_code', inviteCode);
      await supabase.from('accounts').delete().eq('id', account.id);
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      );
    }

    // 4. Create default persona
    // Note: Wallet will be generated when user first logs in via zkLogin and salt is available
    const { error: personaError } = await supabase
      .from('personas')
      .insert({
        account_id: account.id,
        username: username,
        display_name: displayName || username,
        is_default: true,
        is_active: true,
        balance_usdc: 0
        // sui_address, sui_keypair_encrypted, sui_keypair_nonce will be added
        // when the user logs in and we have their zkLogin salt
      });

    if (personaError) {
      console.error('Error creating persona:', personaError);
      // Rollback
      await supabase.from('user_profiles').delete().eq('wallet_address', placeholderWallet);
      await supabase.from('alpha_users').delete().eq('invite_code', inviteCode);
      await supabase.from('accounts').delete().eq('id', account.id);
      return NextResponse.json(
        { error: 'Failed to create persona' },
        { status: 500 }
      );
    }

    // 5. Initialize profile sections
    const sections = ['spotlight', 'media', 'shop', 'gallery'];
    for (const sectionType of sections) {
      await supabase
        .from('user_profile_sections')
        .insert({
          wallet_address: placeholderWallet,
          section_type: sectionType,
          title: sectionType.charAt(0).toUpperCase() + sectionType.slice(1),
          display_order: sections.indexOf(sectionType),
          is_visible: false,
          config: []
        });
    }

    return NextResponse.json({
      success: true,
      message: `Created zkLogin user "${username}" with invite code "${inviteCode}"`,
      data: {
        accountId: account.id,
        username,
        inviteCode,
        placeholderWallet
      }
    });

  } catch (error) {
    console.error('Error in create-zklogin-user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
