import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Limit to 5 personas per account
    const MAX_PERSONAS = 5;
    if (accountPersonas && accountPersonas.length >= MAX_PERSONAS) {
      return NextResponse.json(
        { error: `Maximum of ${MAX_PERSONAS} accounts allowed` },
        { status: 400 }
      );
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
        balance_usdc: 0
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

    return NextResponse.json({
      success: true,
      persona: newPersona
    });
  } catch (error) {
    console.error('[Persona Create] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
