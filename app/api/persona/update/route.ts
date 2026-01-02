import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Allowed fields that can be updated via this API
const ALLOWED_FIELDS = ['display_name', 'bio', 'avatar_url'];

export async function POST(request: NextRequest) {
  try {
    const { personaId, accountId, updates } = await request.json();

    if (!personaId || !accountId) {
      return NextResponse.json(
        { error: 'personaId and accountId are required' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'updates object is required' },
        { status: 400 }
      );
    }

    // Filter to only allowed fields
    const safeUpdates: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      if (ALLOWED_FIELDS.includes(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Security: Verify the persona belongs to the claimed account
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

    // ALWAYS verify ownership
    if (persona.account_id !== accountId) {
      console.error('API: Account mismatch - user does not own this persona');
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this persona' },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from('personas')
      .update(safeUpdates)
      .eq('id', personaId)
      .select();

    if (error) {
      console.error('API: Failed to update persona:', error.message);
      return NextResponse.json(
        { error: 'Failed to update persona', details: error.message },
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
    console.error('API: Error updating persona:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
