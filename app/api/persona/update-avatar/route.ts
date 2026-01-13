import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { personaId, avatarUrl, avatarEffect, accountId } = await request.json();

    if (!personaId || !avatarUrl || !accountId) {
      return NextResponse.json(
        { error: 'personaId, avatarUrl, and accountId are required' },
        { status: 400 }
      );
    }

    // Security: Verify the persona belongs to the claimed account
    // This prevents users from updating other people's personas
    const { data: persona, error: lookupError } = await supabase
      .from('personas')
      .select('id, account_id, username')
      .eq('id', personaId)
      .single();

    if (lookupError || !persona) {
      console.error('API: Persona not found for validation:', personaId);
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    // ALWAYS verify ownership - accountId is required
    if (persona.account_id !== accountId) {
      console.error('API: Account mismatch - user does not own this persona');
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this persona' },
        { status: 403 }
      );
    }

    // Build update object - avatar_effect can be null to clear it
    const updateData: { avatar_url: string; avatar_effect?: any } = {
      avatar_url: avatarUrl
    };
    if (avatarEffect !== undefined) {
      updateData.avatar_effect = avatarEffect;
    }

    const { data, error } = await supabase
      .from('personas')
      .update(updateData)
      .eq('id', personaId)
      .select();

    if (error) {
      console.error('API: Failed to update persona avatar:', error.message);
      return NextResponse.json(
        { error: 'Failed to update persona avatar', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.error('API: Persona not found after update:', personaId);
      return NextResponse.json(
        { error: 'Persona not found', personaId },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      persona: data[0]
    });

  } catch (error: any) {
    console.error('❌ API: Error updating persona avatar:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
