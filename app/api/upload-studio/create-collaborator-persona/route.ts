import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateKeypair, getAddressFromKeypair } from '@/lib/sui/keypair-manager';

// Initialize Supabase with service role for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Sanitize a name into a valid username
 * "Kwame Jones" -> "kwame-jones"
 */
function sanitizeUsername(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '')         // Remove leading/trailing hyphens
    .substring(0, 30);             // Max 30 chars
}

/**
 * Create a managed persona for a collaborator who doesn't have a mixmi account
 * The persona is created under the uploader's account, who becomes the manager
 */
export async function POST(request: NextRequest) {
  try {
    const { uploaderWallet, collaboratorName: rawName } = await request.json();

    // Clean up the collaborator name - strip "pending:" prefix if present
    const collaboratorName = rawName
      ?.replace(/^pending:/i, '')
      .trim();

    if (!uploaderWallet || !collaboratorName) {
      return NextResponse.json(
        { error: 'Uploader wallet and collaborator name are required' },
        { status: 400 }
      );
    }

    // Find the uploader's account
    const { data: uploaderPersona, error: personaError } = await supabase
      .from('personas')
      .select('account_id')
      .or(`wallet_address.eq.${uploaderWallet},sui_address.eq.${uploaderWallet}`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (personaError) {
      console.error('Error finding uploader persona:', personaError);
      return NextResponse.json(
        { error: 'Failed to find uploader account' },
        { status: 500 }
      );
    }

    if (!uploaderPersona?.account_id) {
      return NextResponse.json(
        { error: 'Uploader account not found. Must be a zkLogin user.' },
        { status: 400 }
      );
    }

    const accountId = uploaderPersona.account_id;

    // Generate username from collaborator name with -tbd suffix
    // This makes it clear the persona is a managed placeholder
    let baseUsername = sanitizeUsername(collaboratorName);
    if (baseUsername.length < 3) {
      baseUsername = `collab-${baseUsername || 'user'}`;
    }
    baseUsername = `${baseUsername}-tbd`; // Add -tbd suffix for managed personas

    // Check if username exists and generate unique one if needed
    let username = baseUsername;
    let suffix = 1;
    let usernameAvailable = false;

    while (!usernameAvailable && suffix < 100) {
      const { data: existing } = await supabase
        .from('personas')
        .select('username')
        .eq('username', username)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        usernameAvailable = true;
      } else {
        username = `${baseUsername}-${suffix}`;
        suffix++;
      }
    }

    if (!usernameAvailable) {
      return NextResponse.json(
        { error: 'Could not generate unique username' },
        { status: 500 }
      );
    }

    // Generate a SUI wallet for the new persona
    const keypair = generateKeypair();
    const suiAddress = getAddressFromKeypair(keypair);

    // Note: For managed personas created via chatbot, we're not encrypting the keypair
    // The manager (uploader) is responsible for payouts to the real collaborator
    // In the future, we can add encryption using the manager's salt

    // Create the persona
    const { data: newPersona, error: createError } = await supabase
      .from('personas')
      .insert({
        account_id: accountId,
        username: username,
        display_name: collaboratorName,
        wallet_address: suiAddress, // Use SUI address as wallet_address for splits
        sui_address: suiAddress,
        is_default: false,
        is_active: true,
        balance_usdc: 0,
        // Mark as managed collaborator (for future reference)
        // bio could contain a note that this is a managed persona
      })
      .select('id, username, display_name, wallet_address, sui_address')
      .single();

    if (createError) {
      console.error('Error creating persona:', createError);
      return NextResponse.json(
        { error: 'Failed to create persona: ' + createError.message },
        { status: 500 }
      );
    }

    console.log(`Created managed persona @${username} for collaborator "${collaboratorName}"`);

    return NextResponse.json({
      success: true,
      persona: {
        id: newPersona.id,
        username: newPersona.username,
        displayName: newPersona.display_name,
        walletAddress: newPersona.wallet_address,
        suiAddress: newPersona.sui_address
      }
    });

  } catch (error) {
    console.error('Error in create-collaborator-persona:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error: ' + errorMessage },
      { status: 500 }
    );
  }
}
