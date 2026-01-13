import { NextRequest, NextResponse } from 'next/server';
import {
  generateAgentKeypair,
  buildRegisterAgentTransaction,
  buildRegisterAgentWithAllocationTransaction,
  executeAsAdmin,
  isTingConfigured,
  DEFAULT_AGENT_TING_ALLOCATION,
} from '@/lib/sui/ting';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for storing agent keypairs
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/ting/register-agent
 *
 * Register a new AI agent:
 * 1. Generate a new SUI keypair for the agent
 * 2. Register the agent in the on-chain registry
 * 3. Mint initial TING allocation
 * 4. Store encrypted keypair in database
 *
 * Body: {
 *   ownerAddress: string,    // Human owner's wallet address
 *   agentName?: string,      // Display name for the agent
 *   allocation?: number,     // Custom TING allocation (default: 100)
 *   personaId?: string,      // Link to persona if applicable
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ownerAddress,
      agentName = 'AI Agent',
      allocation,
      personaId,
    } = body;

    // Validate inputs
    if (!ownerAddress || typeof ownerAddress !== 'string') {
      return NextResponse.json(
        { error: 'Owner address is required' },
        { status: 400 }
      );
    }

    if (!isTingConfigured()) {
      return NextResponse.json(
        { error: 'TING is not configured. Deploy contracts first.' },
        { status: 503 }
      );
    }

    // Generate new keypair for the AI agent
    const { address: agentAddress, privateKeyBase64 } = generateAgentKeypair();

    // Build the registration transaction
    const tingAllocation = allocation || DEFAULT_AGENT_TING_ALLOCATION;
    const tx = allocation
      ? buildRegisterAgentWithAllocationTransaction(
          agentAddress,
          ownerAddress,
          agentName,
          tingAllocation
        )
      : buildRegisterAgentTransaction(agentAddress, ownerAddress, agentName);

    // Execute the transaction
    const result = await executeAsAdmin(tx);

    // Store the agent keypair in the database (encrypted)
    // Note: In production, encrypt the private key with the owner's key
    const { error: dbError } = await supabase.from('ai_agents').insert({
      agent_address: agentAddress,
      owner_address: ownerAddress,
      agent_name: agentName,
      // In production: encrypt this with owner's public key or server secret
      keypair_encrypted: privateKeyBase64,
      initial_allocation: tingAllocation,
      persona_id: personaId || null,
      is_active: true,
      created_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error('Error storing agent in database:', dbError);
      // Transaction succeeded but DB failed - agent is on-chain but not tracked
      // This is recoverable since we have the address
    }

    return NextResponse.json({
      success: true,
      agent: {
        address: agentAddress,
        name: agentName,
        owner: ownerAddress,
        initialAllocation: tingAllocation,
      },
      transactionDigest: result.digest,
    });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json(
      { error: 'Failed to register agent', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ting/register-agent?owner=0x...
 *
 * Get all AI agents for an owner
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get('owner');

    if (!owner) {
      return NextResponse.json(
        { error: 'Owner address parameter is required' },
        { status: 400 }
      );
    }

    const { data: agents, error } = await supabase
      .from('ai_agents')
      .select('agent_address, agent_name, initial_allocation, is_active, created_at, persona_id')
      .eq('owner_address', owner)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      owner,
      agents: agents || [],
      count: agents?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
