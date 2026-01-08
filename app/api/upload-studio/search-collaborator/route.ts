import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PersonaMatch {
  username: string;
  displayName: string;
  walletAddress: string | null;
  suiAddress: string | null;
  avatarUrl: string | null;
  personaId: string;
}

/**
 * Search for personas by name, separating results into:
 * - ownPersonas: Personas under the same account (managed by uploader)
 * - otherPersonas: Personas belonging to other users
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const accountId = searchParams.get('accountId');
    const uploaderWallet = searchParams.get('uploaderWallet');

    if (!name || name.length < 2) {
      return NextResponse.json({
        ownPersonas: [],
        otherPersonas: []
      });
    }

    // If no accountId provided but we have uploaderWallet, look up the account
    let effectiveAccountId = accountId;
    if (!effectiveAccountId && uploaderWallet) {
      // Look up account by wallet address (could be in personas or accounts table)
      const { data: personaData } = await supabase
        .from('personas')
        .select('account_id')
        .or(`wallet_address.eq.${uploaderWallet},sui_address.eq.${uploaderWallet}`)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (personaData?.account_id) {
        effectiveAccountId = personaData.account_id;
      }
    }

    // Search personas by username and display_name (case-insensitive partial match)
    const { data: personas, error } = await supabase
      .from('personas')
      .select('id, username, display_name, avatar_url, wallet_address, sui_address, account_id')
      .eq('is_active', true)
      .or(`username.ilike.%${name}%,display_name.ilike.%${name}%`)
      .limit(10);

    if (error) {
      console.error('Error searching personas:', error);
      return NextResponse.json(
        { error: 'Failed to search personas' },
        { status: 500 }
      );
    }

    // Separate into own personas vs other personas
    const ownPersonas: PersonaMatch[] = [];
    const otherPersonas: PersonaMatch[] = [];

    for (const persona of personas || []) {
      const match: PersonaMatch = {
        username: persona.username,
        displayName: persona.display_name,
        walletAddress: persona.wallet_address,
        suiAddress: persona.sui_address,
        avatarUrl: persona.avatar_url,
        personaId: persona.id
      };

      if (effectiveAccountId && persona.account_id === effectiveAccountId) {
        ownPersonas.push(match);
      } else {
        otherPersonas.push(match);
      }
    }

    // Sort by relevance (exact username match first, then by display_name match)
    const sortByRelevance = (a: PersonaMatch, b: PersonaMatch) => {
      const nameLower = name.toLowerCase();
      const aUsernameExact = a.username?.toLowerCase() === nameLower;
      const bUsernameExact = b.username?.toLowerCase() === nameLower;
      if (aUsernameExact && !bUsernameExact) return -1;
      if (!aUsernameExact && bUsernameExact) return 1;
      return 0;
    };

    ownPersonas.sort(sortByRelevance);
    otherPersonas.sort(sortByRelevance);

    return NextResponse.json({
      ownPersonas: ownPersonas.slice(0, 3),
      otherPersonas: otherPersonas.slice(0, 3)
    });

  } catch (error) {
    console.error('Error in collaborator search:', error);
    return NextResponse.json(
      { error: 'Failed to search collaborators' },
      { status: 500 }
    );
  }
}
