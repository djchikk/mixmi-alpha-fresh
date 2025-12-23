import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * API Route: Verify pending remix payments and clean up failed ones
 *
 * This endpoint checks all remixes with payment_status='pending' and verifies
 * their transaction status on the Stacks blockchain. If a transaction failed,
 * the remix and its associated files are deleted.
 *
 * Usage: Can be called manually or via cron job
 * GET /api/verify-remix-payments
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting payment verification process...');

    // Query all remixes with pending payment status
    const { data: pendingRemixes, error: queryError } = await supabase
      .from('ip_tracks')
      .select('*')
      .eq('payment_status', 'pending')
      .order('created_at', { ascending: true });

    if (queryError) {
      console.error('❌ Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to query pending remixes' },
        { status: 500 }
      );
    }

    if (!pendingRemixes || pendingRemixes.length === 0) {
      console.log('✅ No pending remixes to verify');
      return NextResponse.json({
        message: 'No pending remixes',
        verified: 0,
        confirmed: 0,
        failed: 0
      });
    }

    console.log(`📊 Found ${pendingRemixes.length} pending remixes to verify`);

    const stacksApiUrl = 'https://api.mainnet.hiro.so';
    let confirmedCount = 0;
    let failedCount = 0;
    const failedRemixes: any[] = [];

    // Check each pending remix
    for (const remix of pendingRemixes) {
      try {
        console.log(`🔎 Checking remix ${remix.id} (tx: ${remix.stacks_tx_id})`);

        if (!remix.stacks_tx_id) {
          console.warn(`⚠️ Remix ${remix.id} has no transaction ID, marking as failed`);
          failedRemixes.push(remix);
          failedCount++;
          continue;
        }

        // Fetch transaction status from Stacks blockchain
        const txResponse = await fetch(`${stacksApiUrl}/extended/v1/tx/${remix.stacks_tx_id}`);

        if (!txResponse.ok) {
          throw new Error(`Transaction not found: ${txResponse.status}`);
        }

        const txData = await txResponse.json();
        console.log(`📡 Transaction status for ${remix.stacks_tx_id}:`, txData.tx_status);

        // Check transaction status
        if (txData.tx_status === 'success') {
          // Payment confirmed - update status
          console.log(`✅ Payment confirmed for remix ${remix.id}`);

          const { error: updateError } = await supabase
            .from('ip_tracks')
            .update({
              payment_status: 'confirmed',
              payment_checked_at: new Date().toISOString()
            })
            .eq('id', remix.id);

          if (updateError) {
            console.error(`❌ Failed to update remix ${remix.id}:`, updateError);
          } else {
            confirmedCount++;
          }

        } else if (txData.tx_status === 'abort_by_response' || txData.tx_status === 'abort_by_post_condition') {
          // Payment failed - mark for deletion
          console.log(`❌ Payment failed for remix ${remix.id} (${txData.tx_status})`);
          failedRemixes.push(remix);
          failedCount++;

        } else if (txData.tx_status === 'pending') {
          // Still pending - check age
          const createdAt = new Date(remix.created_at);
          const now = new Date();
          const ageMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

          // If pending for more than 30 minutes, consider it failed
          if (ageMinutes > 30) {
            console.log(`⏰ Remix ${remix.id} pending for ${ageMinutes.toFixed(1)} minutes, marking as failed`);
            failedRemixes.push(remix);
            failedCount++;
          } else {
            console.log(`⏳ Remix ${remix.id} still pending (${ageMinutes.toFixed(1)} minutes old)`);
            // Update checked_at timestamp
            await supabase
              .from('ip_tracks')
              .update({ payment_checked_at: new Date().toISOString() })
              .eq('id', remix.id);
          }
        }

      } catch (txError: any) {
        console.error(`❌ Error checking transaction for remix ${remix.id}:`, txError);

        // If transaction not found, likely failed - mark for deletion
        if (txError.message?.includes('not found') || txError.message?.includes('404')) {
          console.log(`🗑️ Transaction not found for remix ${remix.id}, marking as failed`);
          failedRemixes.push(remix);
          failedCount++;
        }
      }
    }

    // Clean up failed remixes
    if (failedRemixes.length > 0) {
      console.log(`🗑️ Cleaning up ${failedRemixes.length} failed remixes...`);

      for (const remix of failedRemixes) {
        try {
          // Delete audio file from storage if exists
          if (remix.audio_url) {
            const audioPath = remix.audio_url.split('/user-content/')[1];
            if (audioPath) {
              console.log(`🗑️ Deleting audio file: ${audioPath}`);
              await supabase.storage
                .from('user-content')
                .remove([audioPath]);
            }
          }

          // Delete cover image from storage if exists
          if (remix.cover_image_url) {
            const imagePath = remix.cover_image_url.split('/user-content/')[1];
            if (imagePath) {
              console.log(`🗑️ Deleting cover image: ${imagePath}`);
              await supabase.storage
                .from('user-content')
                .remove([imagePath]);
            }
          }

          // Update remix status to 'failed' (keep record for audit)
          const { error: updateError } = await supabase
            .from('ip_tracks')
            .update({
              payment_status: 'failed',
              payment_checked_at: new Date().toISOString()
            })
            .eq('id', remix.id);

          if (updateError) {
            console.error(`❌ Failed to mark remix ${remix.id} as failed:`, updateError);
          } else {
            console.log(`✅ Marked remix ${remix.id} as failed`);
          }

        } catch (cleanupError) {
          console.error(`❌ Error cleaning up remix ${remix.id}:`, cleanupError);
        }
      }
    }

    console.log('✅ Payment verification complete', {
      verified: pendingRemixes.length,
      confirmed: confirmedCount,
      failed: failedCount
    });

    return NextResponse.json({
      message: 'Payment verification complete',
      verified: pendingRemixes.length,
      confirmed: confirmedCount,
      failed: failedCount,
      failedRemixes: failedRemixes.map(r => ({
        id: r.id,
        title: r.title,
        stacks_tx_id: r.stacks_tx_id
      }))
    });

  } catch (error: any) {
    console.error('💥 Payment verification failed:', error);
    return NextResponse.json(
      { error: 'Payment verification failed', details: error.message },
      { status: 500 }
    );
  }
}
