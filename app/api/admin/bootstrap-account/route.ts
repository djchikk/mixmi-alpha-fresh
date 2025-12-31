import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_CODE = 'mixmi-admin-2024';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/bootstrap-account
 * Create account + persona from an existing user_profiles entry
 * Used when zkLogin created a user_profiles but not the account/persona
 */
export async function POST(request: NextRequest) {
  try {
    const { suiAddress, adminCode } = await request.json();

    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!suiAddress) {
      return NextResponse.json(
        { error: 'SUI address is required' },
        { status: 400 }
      );
    }

    // Find the user_profiles entry by SUI address
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address, username, display_name, avatar_url, bio, sui_address')
      .eq('sui_address', suiAddress)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: `No user_profiles entry found for SUI address: ${suiAddress.slice(0, 12)}...` },
        { status: 404 }
      );
    }

    // Check if account already exists for this SUI address
    const { data: existingAccount } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('sui_address', suiAddress)
      .maybeSingle();

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Account already exists for this SUI address' },
        { status: 400 }
      );
    }

    // Check if persona already exists with this username
    const { data: existingPersona } = await supabaseAdmin
      .from('personas')
      .select('id')
      .eq('username', profile.username)
      .eq('is_active', true)
      .maybeSingle();

    if (existingPersona) {
      return NextResponse.json(
        { error: `Persona with username "${profile.username}" already exists` },
        { status: 400 }
      );
    }

    // Create the account
    const { data: newAccount, error: accountError } = await supabaseAdmin
      .from('accounts')
      .insert({
        sui_address: suiAddress,
        wallet_address: profile.wallet_address || null
      })
      .select('id')
      .single();

    if (accountError || !newAccount) {
      console.error('Error creating account:', accountError);
      return NextResponse.json(
        { error: 'Failed to create account: ' + (accountError?.message || 'Unknown error') },
        { status: 500 }
      );
    }

    // Create the persona
    const { error: personaError } = await supabaseAdmin
      .from('personas')
      .insert({
        account_id: newAccount.id,
        username: profile.username,
        display_name: profile.display_name || null,
        avatar_url: profile.avatar_url || null,
        bio: profile.bio || null,
        wallet_address: profile.wallet_address || null,
        sui_address: suiAddress,
        is_default: true,
        is_active: true
      });

    if (personaError) {
      console.error('Error creating persona:', personaError);
      // Try to clean up the account we just created
      await supabaseAdmin.from('accounts').delete().eq('id', newAccount.id);
      return NextResponse.json(
        { error: 'Failed to create persona: ' + personaError.message },
        { status: 500 }
      );
    }

    // Update user_profiles to link to the new account
    await supabaseAdmin
      .from('user_profiles')
      .update({ account_id: newAccount.id })
      .eq('sui_address', suiAddress);

    return NextResponse.json({
      success: true,
      message: `Created account and persona for @${profile.username}`,
      data: {
        accountId: newAccount.id,
        username: profile.username,
        suiAddress: suiAddress.slice(0, 12) + '...'
      }
    });

  } catch (error) {
    console.error('Error in bootstrap-account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
