import { NextRequest, NextResponse } from 'next/server';
import {
  buildRewardAgentTransaction,
  buildRewardTransaction,
  executeAsAdmin,
  isTingConfigured,
  TING_REWARDS,
} from '@/lib/sui/ting';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/ting/reward
 *
 * Reward an AI agent with TING for a contribution
 *
 * Body: {
 *   agentAddress: string,
 *   rewardType: keyof TING_REWARDS,  // e.g., 'playlistCuration', 'implementationHelp'
 *   customAmount?: number,           // Override the default reward amount
 *   reason?: string,                 // Description of why the reward was given
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentAddress, rewardType, customAmount, reason } = body;

    // Validate inputs
    if (!agentAddress || typeof agentAddress !== 'string') {
      return NextResponse.json(
        { error: 'Agent address is required' },
        { status: 400 }
      );
    }

    if (!rewardType || !(rewardType in TING_REWARDS)) {
      return NextResponse.json(
        {
          error: 'Valid reward type is required',
          validTypes: Object.keys(TING_REWARDS),
        },
        { status: 400 }
      );
    }

    if (!isTingConfigured()) {
      return NextResponse.json(
        { error: 'TING is not configured' },
        { status: 503 }
      );
    }

    // Determine reward amount
    const amount = customAmount || TING_REWARDS[rewardType as keyof typeof TING_REWARDS];

    // Build and execute reward transaction
    const tx = buildRewardAgentTransaction(agentAddress, amount);
    const result = await executeAsAdmin(tx);

    // Log the reward in the database
    await supabase.from('ting_rewards').insert({
      agent_address: agentAddress,
      reward_type: rewardType,
      amount,
      reason: reason || null,
      transaction_digest: result.digest,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      reward: {
        agentAddress,
        rewardType,
        amount,
        amountFormatted: `${amount} TING`,
        reason,
      },
      transactionDigest: result.digest,
    });
  } catch (error) {
    console.error('Error rewarding agent:', error);
    return NextResponse.json(
      { error: 'Failed to reward agent', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ting/reward/types
 *
 * Get available reward types and their amounts
 */
export async function GET() {
  return NextResponse.json({
    rewardTypes: TING_REWARDS,
    description: {
      playlistCuration: 'AI curates a playlist',
      trackRecommendation: 'AI recommends a track that gets played',
      implementationHelp: 'AI helps implement a feature',
      compilationCreation: 'AI creates a compilation',
      helpfulAnswer: 'AI provides helpful answer',
      qualityCuration: 'High-quality curation (requires human approval)',
    },
  });
}
