import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const { currentUsername, newUsername, newDisplayName, adminCode } = await request.json();

    // Verify admin access
    if (adminCode !== 'mixmi-admin-2024') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUsername) {
      return NextResponse.json(
        { error: 'Current username is required' },
        { status: 400 }
      );
    }

    if (!newUsername && !newDisplayName) {
      return NextResponse.json(
        { error: 'At least one field to update is required' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the persona
    const { data: persona, error: findError } = await supabase
      .from('personas')
      .select('id, username, display_name, wallet_address')
      .eq('username', currentUsername.toLowerCase())
      .maybeSingle();

    if (findError) {
      console.error('Error finding persona:', findError);
      return NextResponse.json(
        { error: 'Failed to find persona: ' + findError.message },
        { status: 500 }
      );
    }

    if (!persona) {
      return NextResponse.json(
        { error: `Persona "@${currentUsername}" not found` },
        { status: 404 }
      );
    }

    // If changing username, check it's not taken
    if (newUsername && newUsername.toLowerCase() !== currentUsername.toLowerCase()) {
      const { data: existing } = await supabase
        .from('personas')
        .select('username')
        .eq('username', newUsername.toLowerCase())
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `Username "@${newUsername}" is already taken` },
          { status: 400 }
        );
      }
    }

    // Build update object
    const updates: Record<string, string> = {};
    if (newUsername) {
      updates.username = newUsername.toLowerCase().trim();
    }
    if (newDisplayName) {
      updates.display_name = newDisplayName.trim();
    }

    // Update the persona
    const { error: updateError } = await supabase
      .from('personas')
      .update(updates)
      .eq('id', persona.id);

    if (updateError) {
      console.error('Error updating persona:', updateError);
      return NextResponse.json(
        { error: 'Failed to update persona: ' + updateError.message },
        { status: 500 }
      );
    }

    // If there's a linked wallet and username changed, update user_profiles too
    if (newUsername && persona.wallet_address) {
      await supabase
        .from('user_profiles')
        .update({ username: newUsername.toLowerCase().trim() })
        .eq('wallet_address', persona.wallet_address);
    }

    return NextResponse.json({
      success: true,
      message: `Updated persona "${currentUsername}" → "${newUsername || currentUsername}"`,
      data: {
        oldUsername: currentUsername,
        newUsername: newUsername || currentUsername,
        newDisplayName: newDisplayName || persona.display_name
      }
    });

  } catch (error) {
    console.error('Error in edit-persona:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
}
