import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { username, adminCode } = await request.json();

    // Verify admin access
    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the persona
    const { data: persona, error: findError } = await supabase
      .from('personas')
      .select('id, username, account_id, is_default, wallet_address')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (findError) {
      console.error('Error finding persona:', findError);
      return NextResponse.json(
        { error: 'Failed to find persona: ' + findError.message },
        { status: 500 }
      );
    }

    if (!persona) {
      return NextResponse.json(
        { error: `Persona "@${username}" not found` },
        { status: 404 }
      );
    }

    // Check if this is the only persona for the account
    const { data: accountPersonas, error: countError } = await supabase
      .from('personas')
      .select('id')
      .eq('account_id', persona.account_id)
      .eq('is_active', true);

    if (countError) {
      console.error('Error counting personas:', countError);
      return NextResponse.json(
        { error: 'Failed to check account personas: ' + countError.message },
        { status: 500 }
      );
    }

    const isOnlyPersona = accountPersonas?.length === 1;
    const accountId = persona.account_id;

    // First, unlink any tracks that reference this persona
    const { error: unlinkTracksError } = await supabase
      .from('ip_tracks')
      .update({ persona_id: null })
      .eq('persona_id', persona.id);

    if (unlinkTracksError) {
      console.error('Error unlinking tracks:', unlinkTracksError);
      // Continue anyway - might not have any tracks
    }

    // Delete the persona
    const { error: deletePersonaError } = await supabase
      .from('personas')
      .delete()
      .eq('id', persona.id);

    if (deletePersonaError) {
      console.error('Error deleting persona:', deletePersonaError);
      return NextResponse.json(
        { error: 'Failed to delete persona: ' + deletePersonaError.message },
        { status: 500 }
      );
    }

    let accountDeleted = false;

    // If this was the only persona, delete the account too
    if (isOnlyPersona) {
      // First, unlink any user_profiles from this account
      await supabase
        .from('user_profiles')
        .update({ account_id: null })
        .eq('account_id', accountId);

      // Delete the account
      const { error: deleteAccountError } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId);

      if (deleteAccountError) {
        console.error('Error deleting account:', deleteAccountError);
        // Don't fail the whole operation - persona is already deleted
      } else {
        accountDeleted = true;
      }
    }

    return NextResponse.json({
      success: true,
      message: accountDeleted
        ? `Deleted persona "@${username}" and its orphan account`
        : `Deleted persona "@${username}" (account had other personas)`,
      data: {
        deletedPersona: username,
        accountDeleted,
        accountId: accountDeleted ? accountId : null
      }
    });

  } catch (error) {
    console.error('Error in delete-persona:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
}
