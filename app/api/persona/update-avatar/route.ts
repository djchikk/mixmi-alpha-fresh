import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { personaId, avatarUrl } = await request.json();

    if (!personaId || !avatarUrl) {
      return NextResponse.json(
        { error: 'personaId and avatarUrl are required' },
        { status: 400 }
      );
    }

    console.log('🔧 API: Updating persona avatar, personaId:', personaId, 'avatarUrl:', avatarUrl);

    const { data, error } = await supabase
      .from('personas')
      .update({ avatar_url: avatarUrl })
      .eq('id', personaId)
      .select();

    if (error) {
      console.error('❌ API: Failed to update persona avatar:', error);
      return NextResponse.json(
        { error: 'Failed to update persona avatar', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.error('❌ API: Persona not found:', personaId);
      return NextResponse.json(
        { error: 'Persona not found', personaId },
        { status: 404 }
      );
    }

    console.log('✅ API: Persona avatar updated successfully:', data[0]);

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
