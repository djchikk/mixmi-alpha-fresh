import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  generateAgentKeypair,
  buildRegisterAgentTransaction,
  executeAsAdmin,
  isTingConfigured,
  DEFAULT_AGENT_TING_ALLOCATION,
} from '@/lib/sui/ting';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/ting/create-agent-for-persona
 *
 * Create an AI agent for a persona that doesn't have one yet.
 * Used for backfilling existing personas.
 *
 * Body: {
 *   personaId: string  // UUID of the persona
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const { personaId } = await request.json();

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId is required' },
        { status: 400 }
      );
    }

    if (!isTingConfigured()) {
      return NextResponse.json(
        { error: 'TING is not configured' },
        { status: 503 }
      );
    }

    // Get the persona
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, username, display_name, sui_address')
      .eq('id', personaId)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    if (!persona.sui_address) {
      return NextResponse.json(
        { error: 'Persona does not have a SUI wallet yet' },
        { status: 400 }
      );
    }

    // Check if persona already has an agent
    const { data: existingAgent } = await supabase
      .from('ai_agents')
      .select('id, agent_address')
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .single();

    if (existingAgent) {
      return NextResponse.json({
        success: true,
        message: 'Persona already has an agent',
        agent: {
          address: existingAgent.agent_address,
          alreadyExisted: true,
        },
      });
    }

    // Generate new keypair for the AI agent
    const { address: agentAddress, privateKeyBase64 } = generateAgentKeypair();
    const agentName = `${persona.display_name || persona.username}'s Agent`;

    // Register agent on-chain (mints initial TING)
    const tx = buildRegisterAgentTransaction(
      agentAddress,
      persona.sui_address,
      agentName
    );

    const result = await executeAsAdmin(tx);
    console.log('🤖 Agent registered on-chain for persona', persona.username, ':', result.digest);

    // Store agent in database
    const { error: insertError } = await supabase
      .from('ai_agents')
      .insert({
        agent_address: agentAddress,
        owner_address: persona.sui_address,
        agent_name: agentName,
        keypair_encrypted: privateKeyBase64,
        initial_allocation: DEFAULT_AGENT_TING_ALLOCATION,
        persona_id: personaId,
        is_active: true,
      });

    if (insertError) {
      console.error('Failed to store agent in DB:', insertError);
      return NextResponse.json(
        { error: 'Agent created on-chain but failed to store in database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent: {
        address: agentAddress,
        name: agentName,
        owner: persona.sui_address,
        initialAllocation: DEFAULT_AGENT_TING_ALLOCATION,
      },
      transactionDigest: result.digest,
    });

  } catch (error) {
    console.error('Error creating agent for persona:', error);
    return NextResponse.json(
      { error: 'Failed to create agent', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ting/create-agent-for-persona?personaId=xxx
 *
 * Check if a persona has an agent
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personaId = searchParams.get('personaId');

    if (!personaId) {
      return NextResponse.json(
        { error: 'personaId parameter is required' },
        { status: 400 }
      );
    }

    const { data: agent, error } = await supabase
      .from('ai_agents')
      .select('agent_address, agent_name, initial_allocation, is_active, created_at')
      .eq('persona_id', personaId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({
      personaId,
      hasAgent: !!agent,
      agent: agent || null,
    });

  } catch (error) {
    console.error('Error checking agent:', error);
    return NextResponse.json(
      { error: 'Failed to check agent' },
      { status: 500 }
    );
  }
}
