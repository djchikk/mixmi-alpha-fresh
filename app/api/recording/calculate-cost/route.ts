/**
 * Recording Cost Calculation API
 *
 * Calculates the cost of a recording based on bars and tracks.
 * Uses "sausage link" pricing: $0.10 per 8-bar block per track.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PRICING } from '@/config/pricing';
import {
  calculateBlockCount,
  calculateRecordingCost,
  calculatePaymentSplit,
  formatCostBreakdown,
} from '@/lib/recording/paymentCalculation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bars, trackCount } = body;

    // Validate inputs
    if (typeof bars !== 'number' || bars <= 0) {
      return NextResponse.json(
        { error: 'Invalid bars count' },
        { status: 400 }
      );
    }

    if (typeof trackCount !== 'number' || trackCount <= 0 || trackCount > 2) {
      return NextResponse.json(
        { error: 'Invalid track count (must be 1 or 2)' },
        { status: 400 }
      );
    }

    // Calculate costs
    const blocks = calculateBlockCount(bars);
    const totalCost = calculateRecordingCost(bars, trackCount);
    const split = calculatePaymentSplit(totalCost);
    const breakdown = formatCostBreakdown(bars, trackCount);

    return NextResponse.json({
      success: true,
      calculation: {
        bars,
        blocks,
        trackCount,
        pricePerBlock: PRICING.remix.pricePerBlock,
        totalCost,
        split: {
          platform: split.platform,
          platformPercent: PRICING.remix.platformCutPercent,
          creators: split.creators,
          creatorsPercent: PRICING.remix.creatorsCutPercent,
          remixerStake: split.remixerStake,
          remixerStakePercent: PRICING.remix.remixerStakePercent,
        },
        formula: breakdown.formula,
      },
    });
  } catch (error) {
    console.error('Failed to calculate recording cost:', error);
    return NextResponse.json(
      { error: 'Failed to calculate cost' },
      { status: 500 }
    );
  }
}
