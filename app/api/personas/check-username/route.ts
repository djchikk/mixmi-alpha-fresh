import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service role for checking persona usernames
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { available: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { available: false, error: 'Username must be at least 3 characters' },
        { status: 400 }
      );
    }

    // Validate username format
    const usernameRegex = /^[a-z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json(
        { available: false, error: 'Invalid username format' },
        { status: 400 }
      );
    }

    // Check if username exists in personas table
    const { data: existingPersona, error } = await supabaseAdmin
      .from('personas')
      .select('id')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which means username is available
      console.error('[Persona Username Check] Error:', error);
      return NextResponse.json(
        { available: false, error: 'Failed to check username' },
        { status: 500 }
      );
    }

    const available = !existingPersona;

    return NextResponse.json({ available });
  } catch (error) {
    console.error('[Persona Username Check] Error:', error);
    return NextResponse.json(
      { available: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
