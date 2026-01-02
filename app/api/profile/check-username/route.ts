import { NextRequest, NextResponse } from 'next/server';
import { UserProfileService } from '@/lib/userProfileService';
import { createClient } from '@supabase/supabase-js';

// Use service role to check all tables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET handler for simple availability checks (used by SignInModal)
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

    const lowerUsername = username.toLowerCase();

    // Check BOTH user_profiles AND personas tables
    const [profileCheck, personaCheck] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('username')
        .eq('username', lowerUsername)
        .maybeSingle(),
      supabase
        .from('personas')
        .select('username')
        .eq('username', lowerUsername)
        .maybeSingle()
    ]);

    const existsInProfiles = !!profileCheck.data;
    const existsInPersonas = !!personaCheck.data;

    if (existsInProfiles || existsInPersonas) {
      return NextResponse.json({ available: false, message: 'Username already taken' });
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error('Error checking username:', error);
    return NextResponse.json(
      { available: false, error: 'Failed to check username availability' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, currentWallet } = await request.json();

    if (!username) {
      return NextResponse.json(
        { available: false, error: 'Username is required' },
        { status: 400 }
      );
    }

    const result = await UserProfileService.checkUsernameAvailability(username, currentWallet);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking username:', error);
    return NextResponse.json(
      { available: false, error: 'Failed to check username availability' },
      { status: 500 }
    );
  }
}