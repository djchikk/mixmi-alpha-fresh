import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateEncryptedKeypair } from '@/lib/sui/keypair-manager';
import {
  generateAgentKeypair,
  buildRegisterAgentTransaction,
  executeAsAdmin,
  isTingConfigured,
  DEFAULT_AGENT_TING_ALLOCATION,
} from '@/lib/sui/ting';

// Use service role for creating personas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, username, displayName } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing accountId' },
        { status: 400 }
      );
    }

    if (!username || username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Validate username format
    const usernameRegex = /^[a-z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { error: 'Username can only contain lowercase letters, numbers, underscores, and hyphens' },
        { status: 400 }
      );
    }

    console.log('[Persona Create] Creating persona:', { accountId, username, displayName });

    // Check if username is already taken
    const { data: existingPersona, error: checkError } = await supabaseAdmin
      .from('personas')
      .select('id')
      .eq('username', username)
      .single();

    if (existingPersona) {
      return NextResponse.json(
        { error: 'Username is already taken' },
        { status: 409 }
      );
    }

    // Check persona limit for this account
    const { data: accountPersonas, error: countError } = await supabaseAdmin
      .from('personas')
      .select('id')
      .eq('account_id', accountId)
      .eq('is_active', true);

    if (countError) {
      console.error('[Persona Create] Error checking persona count:', countError);
      return NextResponse.json(
        { error: 'Failed to check persona limit' },
        { status: 500 }
      );
    }

    // Limit personas per account (alpha users get 999)
    const MAX_PERSONAS = 999;
    if (accountPersonas && accountPersonas.length >= MAX_PERSONAS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_PERSONAS} accounts allowed` },
        { status: 400 }
      );
    }

    // Get the account's zkLogin salt for keypair encryption
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('zklogin_salt, sui_address')
      .eq('id', accountId)
      .single();

    let zkloginSalt = account?.zklogin_salt;

    // If account doesn't have salt yet, try to get it from zklogin_users via the chain:
    // account -> user_profiles.account_id -> user_profiles.wallet_address
    // -> alpha_users.wallet_address -> alpha_users.invite_code -> zklogin_users.invite_code
    if (!zkloginSalt && account?.sui_address) {
      console.log('[Persona Create] Account has no salt, trying to fetch from zklogin_users...');
      const { data: zkUser } = await supabaseAdmin
        .from('zklogin_users')
        .select('salt')
        .eq('sui_address', account.sui_address)
        .single();

      if (zkUser?.salt) {
        zkloginSalt = zkUser.salt;
        // Also update the account for future use
        await supabaseAdmin
          .from('accounts')
          .update({ zklogin_salt: zkUser.salt })
          .eq('id', accountId);
        console.log('[Persona Create] Backfilled zklogin_salt from zklogin_users');
      }
    }

    // Generate encrypted keypair for this persona (if we have a salt)
    let walletData: { sui_address?: string; sui_keypair_encrypted?: string; sui_keypair_nonce?: string } = {};

    if (zkloginSalt) {
      try {
        const encryptedKeypair = generateEncryptedKeypair(zkloginSalt);
        walletData = {
          sui_address: encryptedKeypair.suiAddress,
          sui_keypair_encrypted: encryptedKeypair.encryptedKey,
          sui_keypair_nonce: encryptedKeypair.nonce,
        };
        console.log('[Persona Create] Generated wallet:', walletData.sui_address);
      } catch (walletError) {
        console.error('[Persona Create] Failed to generate wallet:', walletError);
        // Continue without wallet - can be added later
      }
    } else {
      console.log('[Persona Create] No zkLogin salt found, skipping wallet generation');
    }

    // Create the new persona
    const { data: newPersona, error: createError } = await supabaseAdmin
      .from('personas')
      .insert({
        account_id: accountId,
        username: username,
        display_name: displayName || username,
        is_default: false,
        is_active: true,
        balance_usdc: 0,
        ...walletData
      })
      .select()
      .single();

    if (createError) {
      console.error('[Persona Create] Error creating persona:', createError);
      return NextResponse.json(
        { error: 'Failed to create account' },
        { status: 500 }
      );
    }

    console.log('[Persona Create] Successfully created persona:', newPersona.id);

    // Create user_profiles entry for this persona
    // Use the persona's SUI address as the wallet_address identifier
    const profileWalletAddress = walletData.sui_address || `persona_${newPersona.id}`;

    console.log('[Persona Create] Creating user_profiles entry with wallet:', profileWalletAddress);

    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        wallet_address: profileWalletAddress,
        account_id: accountId,
        username: username,
        display_name: displayName || username,
        sui_address: walletData.sui_address || null,
        sticker_id: 'daisy-blue',
        sticker_visible: true,
        show_wallet_address: false,
        show_btc_address: false,
        show_sui_address: true
      });

    if (profileError) {
      console.error('[Persona Create] Error creating user_profiles:', profileError);
      // Don't fail the whole request - persona was created successfully
    } else {
      console.log('[Persona Create] Created user_profiles for persona');

      // Initialize profile sections (spotlight, media, shop, gallery)
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
        console.error('[Persona Create] Error creating profile sections:', sectionsError);
      } else {
        console.log('[Persona Create] Created profile sections for persona');
      }
    }

    // Create AI agent for this persona (with TING wallet)
    let agentData: { agent_address?: string; agent_name?: string; ting_allocation?: number } = {};

    if (isTingConfigured() && walletData.sui_address) {
      try {
        console.log('[Persona Create] Creating AI agent for persona...');

        // Generate new keypair for the AI agent (separate from persona wallet)
        const { address: agentAddress, privateKeyBase64 } = generateAgentKeypair();
        const agentName = `${displayName || username}'s Agent`;

        // Build and execute registration transaction (mints initial TING)
        const tx = buildRegisterAgentTransaction(
          agentAddress,
          walletData.sui_address, // Owner is the persona's wallet
          agentName
        );

        const result = await executeAsAdmin(tx);
        console.log('[Persona Create] Agent registered on-chain:', result.digest);

        // Store agent in database
        const { error: agentError } = await supabaseAdmin
          .from('ai_agents')
          .insert({
            agent_address: agentAddress,
            owner_address: walletData.sui_address,
            agent_name: agentName,
            keypair_encrypted: privateKeyBase64,
            initial_allocation: DEFAULT_AGENT_TING_ALLOCATION,
            persona_id: newPersona.id,
            is_active: true,
          });

        if (agentError) {
          console.error('[Persona Create] Error storing agent in DB:', agentError);
        } else {
          agentData = {
            agent_address: agentAddress,
            agent_name: agentName,
            ting_allocation: DEFAULT_AGENT_TING_ALLOCATION,
          };
          console.log('[Persona Create] AI agent created:', agentAddress, 'with', DEFAULT_AGENT_TING_ALLOCATION, 'TING');
        }
      } catch (agentError) {
        console.error('[Persona Create] Failed to create AI agent:', agentError);
        // Don't fail persona creation - agent can be created later
      }
    } else {
      console.log('[Persona Create] Skipping AI agent creation (TING not configured or no wallet)');
    }

    return NextResponse.json({
      success: true,
      persona: newPersona,
      agent: agentData.agent_address ? agentData : undefined,
    });
  } catch (error) {
    console.error('[Persona Create] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
