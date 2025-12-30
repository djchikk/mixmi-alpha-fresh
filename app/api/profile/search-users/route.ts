import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Search both user_profiles and personas tables in parallel
    const [profilesResult, personasResult] = await Promise.all([
      // Search user_profiles (legacy profiles)
      supabase
        .from('user_profiles')
        .select('wallet_address, username, display_name, avatar_url')
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .neq('display_name', 'New User')
        .limit(8),

      // Search personas (new system with SUI addresses)
      supabase
        .from('personas')
        .select('id, username, display_name, avatar_url, wallet_address, sui_address')
        .eq('is_active', true)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(8)
    ]);

    if (profilesResult.error) {
      console.error('Error searching user_profiles:', profilesResult.error);
    }
    if (personasResult.error) {
      console.error('Error searching personas:', personasResult.error);
    }

    // Build a map to deduplicate by username (personas take priority)
    const usersMap = new Map<string, {
      walletAddress: string | null;
      username: string | null;
      displayName: string | null;
      avatarUrl: string | null;
      suiAddress: string | null;
      isPersona: boolean;
    }>();

    // Add personas first (they have priority and have SUI addresses)
    for (const persona of personasResult.data || []) {
      const key = persona.username?.toLowerCase() || persona.id;
      usersMap.set(key, {
        walletAddress: persona.wallet_address,
        username: persona.username,
        displayName: persona.display_name,
        avatarUrl: persona.avatar_url,
        suiAddress: persona.sui_address,
        isPersona: true
      });
    }

    // Add user_profiles (only if not already added via persona)
    for (const profile of profilesResult.data || []) {
      const key = profile.username?.toLowerCase() || profile.wallet_address;
      if (!usersMap.has(key)) {
        usersMap.set(key, {
          walletAddress: profile.wallet_address,
          username: profile.username,
          displayName: profile.display_name,
          avatarUrl: profile.avatar_url,
          suiAddress: null, // Legacy profiles don't have SUI addresses
          isPersona: false
        });
      }
    }

    // Convert map to array and limit to 8 results
    const users = Array.from(usersMap.values()).slice(0, 8);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error in user search:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
