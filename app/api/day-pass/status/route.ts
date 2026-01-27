/**
 * API Route: Check Day Pass Status
 *
 * GET /api/day-pass/status?userAddress=0x...
 *
 * Returns whether the user has an active day pass and details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress) {
      return NextResponse.json(
        { error: 'userAddress is required' },
        { status: 400 }
      );
    }

    // Check for active day pass
    const { data: dayPass, error: passError } = await supabase
      .from('day_passes')
      .select('id, expires_at, purchased_at, status')
      .eq('user_address', userAddress)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (passError) {
      console.error('Error checking day pass:', passError);
      return NextResponse.json(
        { error: 'Failed to check day pass status' },
        { status: 500 }
      );
    }

    if (!dayPass) {
      return NextResponse.json({
        hasActivePass: false,
      });
    }

    // Get play count for this pass
    const { count: playCount } = await supabase
      .from('day_pass_plays')
      .select('*', { count: 'exact', head: true })
      .eq('day_pass_id', dayPass.id);

    // Calculate remaining seconds
    const expiresAt = new Date(dayPass.expires_at);
    const now = new Date();
    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));

    return NextResponse.json({
      hasActivePass: true,
      dayPassId: dayPass.id,
      expiresAt: dayPass.expires_at,
      purchasedAt: dayPass.purchased_at,
      remainingSeconds,
      totalPlays: playCount || 0,
    });

  } catch (error) {
    console.error('Day pass status error:', error);
    return NextResponse.json(
      { error: 'Failed to check day pass status' },
      { status: 500 }
    );
  }
}
