import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Search by username or display_name (case insensitive)
    // Only return users who have customized their profile (not "New User")
    const { data, error } = await supabase
      .from('user_profiles')
      .select('wallet_address, username, display_name, avatar_url')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq('display_name', 'New User')
      .limit(8);

    if (error) {
      console.error('Error searching users:', error);
      return NextResponse.json(
        { error: 'Failed to search users' },
        { status: 500 }
      );
    }

    // Format for frontend consumption
    const users = (data || []).map(user => ({
      walletAddress: user.wallet_address,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error in user search:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
