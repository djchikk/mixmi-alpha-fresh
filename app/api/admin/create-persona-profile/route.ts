import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_CODE = 'mixmi-admin-2024';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/create-persona-profile
 * Create user_profiles entry for an existing persona that doesn't have one
 * Used to fix personas created before the auto-create fix
 */
export async function POST(request: NextRequest) {
  try {
    const { personaId, adminCode } = await request.json();

    if (adminCode !== ADMIN_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    // Get the persona
    const { data: persona, error: personaError } = await supabaseAdmin
      .from('personas')
      .select('id, account_id, username, display_name, avatar_url, bio, sui_address')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: `Persona not found: ${personaId}` },
        { status: 404 }
      );
    }

    // Check if user_profiles already exists for this persona's username
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('username', persona.username)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: `user_profiles already exists for username "${persona.username}"` },
        { status: 400 }
      );
    }

    // Use persona's SUI address as wallet_address, or generate a fallback
    const profileWalletAddress = persona.sui_address || `persona_${persona.id}`;

    // Check if this wallet_address is already used
    const { data: existingWallet } = await supabaseAdmin
      .from('user_profiles')
      .select('wallet_address')
      .eq('wallet_address', profileWalletAddress)
      .maybeSingle();

    if (existingWallet) {
      return NextResponse.json(
        { error: `user_profiles already exists for wallet "${profileWalletAddress.slice(0, 20)}..."` },
        { status: 400 }
      );
    }

    // Create user_profiles entry
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        wallet_address: profileWalletAddress,
        account_id: persona.account_id,
        username: persona.username,
        display_name: persona.display_name || persona.username,
        avatar_url: persona.avatar_url || null,
        bio: persona.bio || null,
        sui_address: persona.sui_address || null,
        sticker_id: 'daisy-blue',
        sticker_visible: true,
        show_wallet_address: false,
        show_btc_address: false,
        show_sui_address: true
      });

    if (profileError) {
      console.error('Error creating user_profiles:', profileError);
      return NextResponse.json(
        { error: 'Failed to create user_profiles: ' + profileError.message },
        { status: 500 }
      );
    }

    // Create profile sections
    const defaultSections = [
      { wallet_address: profileWalletAddress, section_type: 'spotlight', title: 'Spotlight', display_order: 0, is_visible: true, config: [] },
      { wallet_address: profileWalletAddress, section_type: 'media', title: 'Media', display_order: 1, is_visible: true, config: [] },
      { wallet_address: profileWalletAddress, section_type: 'shop', title: 'Shop', display_order: 2, is_visible: true, config: [] },
      { wallet_address: profileWalletAddress, section_type: 'gallery', title: 'Gallery', display_order: 3, is_visible: true, config: [] }
    ];

    const { error: sectionsError } = await supabaseAdmin
      .from('user_profile_sections')
      .insert(defaultSections);

    if (sectionsError) {
      console.error('Error creating profile sections:', sectionsError);
      // Non-fatal - user_profiles was created
    }

    return NextResponse.json({
      success: true,
      message: `Created user_profiles and sections for @${persona.username}`,
      data: {
        personaId: persona.id,
        username: persona.username,
        profileWalletAddress: profileWalletAddress.slice(0, 20) + '...'
      }
    });

  } catch (error) {
    console.error('Error in create-persona-profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
