import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { personaUsername, adminCode } = await request.json();

    // Verify admin access
    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!personaUsername) {
      return NextResponse.json(
        { error: 'Persona username is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch persona with both STX wallet and SUI address
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, username, wallet_address, sui_address')
      .eq('username', personaUsername.toLowerCase())
      .eq('is_active', true)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: `Could not find persona "@${personaUsername}"` },
        { status: 404 }
      );
    }

    // 2. Check we have both addresses
    if (!persona.wallet_address) {
      return NextResponse.json(
        { error: `Persona @${personaUsername} has no STX wallet linked` },
        { status: 400 }
      );
    }

    if (!persona.sui_address) {
      return NextResponse.json(
        { error: `Persona @${personaUsername} has no SUI address. Generate one first.` },
        { status: 400 }
      );
    }

    const stxWallet = persona.wallet_address;
    const suiAddress = persona.sui_address;

    // 3. Count tracks that will be migrated
    const { data: tracksToMigrate, error: countError } = await supabase
      .from('ip_tracks')
      .select('id, title')
      .eq('primary_uploader_wallet', stxWallet)
      .is('deleted_at', null);

    if (countError) {
      console.error('Error counting tracks:', countError);
      return NextResponse.json(
        { error: 'Failed to count tracks' },
        { status: 500 }
      );
    }

    const trackCount = tracksToMigrate?.length || 0;

    if (trackCount === 0) {
      return NextResponse.json({
        success: true,
        message: `No tracks found for STX wallet ${stxWallet.slice(0, 12)}...`,
        data: {
          tracksUpdated: 0,
          stxWallet: stxWallet.slice(0, 12) + '...',
          suiAddress: suiAddress.slice(0, 12) + '...'
        }
      });
    }

    // 4. Update all tracks to use SUI address
    const { error: updateError } = await supabase
      .from('ip_tracks')
      .update({ primary_uploader_wallet: suiAddress })
      .eq('primary_uploader_wallet', stxWallet);

    if (updateError) {
      console.error('Error updating tracks:', updateError);
      return NextResponse.json(
        { error: 'Failed to update tracks' },
        { status: 500 }
      );
    }

    // 5. Also update user_profiles.wallet_address to SUI if it was STX
    const { error: profileUpdateError } = await supabase
      .from('user_profiles')
      .update({ wallet_address: suiAddress })
      .eq('wallet_address', stxWallet);

    if (profileUpdateError) {
      console.error('Warning: Could not update user_profiles wallet:', profileUpdateError);
      // Don't fail the whole operation for this
    }

    return NextResponse.json({
      success: true,
      message: `Migrated ${trackCount} tracks from STX to SUI for @${personaUsername}`,
      data: {
        tracksUpdated: trackCount,
        trackTitles: tracksToMigrate?.map(t => t.title) || [],
        stxWallet: stxWallet.slice(0, 12) + '...',
        suiAddress: suiAddress.slice(0, 12) + '...',
        profileUpdated: !profileUpdateError
      }
    });

  } catch (error) {
    console.error('Error in migrate-tracks-to-sui:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET to preview migration without making changes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminCode = request.headers.get('x-admin-code');
    const personaUsername = searchParams.get('persona');

    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!personaUsername) {
      return NextResponse.json(
        { error: 'Persona username is required (use ?persona=username)' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch persona
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('username, wallet_address, sui_address')
      .eq('username', personaUsername.toLowerCase())
      .eq('is_active', true)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: `Could not find persona "@${personaUsername}"` },
        { status: 404 }
      );
    }

    // Count tracks
    const stxWallet = persona.wallet_address;
    let trackCount = 0;
    let trackTitles: string[] = [];

    if (stxWallet) {
      const { data: tracks } = await supabase
        .from('ip_tracks')
        .select('title')
        .eq('primary_uploader_wallet', stxWallet)
        .is('deleted_at', null);

      trackCount = tracks?.length || 0;
      trackTitles = tracks?.map(t => t.title) || [];
    }

    return NextResponse.json({
      persona: persona.username,
      stxWallet: stxWallet ? stxWallet.slice(0, 12) + '...' : null,
      suiAddress: persona.sui_address ? persona.sui_address.slice(0, 12) + '...' : null,
      canMigrate: !!(stxWallet && persona.sui_address),
      tracksToMigrate: trackCount,
      trackTitles
    });

  } catch (error) {
    console.error('Error in migrate-tracks-to-sui preview:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
