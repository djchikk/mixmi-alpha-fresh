/**
 * API Route: Execute a Sponsored SUI Transaction
 *
 * POST /api/sui/execute
 *
 * Takes the dual-signed transaction and submits it to the SUI network.
 * Records the purchase in the database after successful execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSponsoredTransaction, getCurrentNetwork } from '@/lib/sui';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client with service role for database operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CartItem {
  id: string;
  title: string;
  price_usdc: number;
}

interface PurchaseData {
  cartItems: CartItem[];
  buyerAddress: string;
  buyerPersonaId?: string;
  uploaderAccountId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      txBytes,
      userSignature,
      sponsorSignature,
      purchaseData,
    } = body as {
      txBytes: string;
      userSignature: string;
      sponsorSignature: string;
      purchaseData?: PurchaseData;
    };

    // Validate inputs
    if (!txBytes || !userSignature || !sponsorSignature) {
      return NextResponse.json(
        { error: 'Missing required transaction data' },
        { status: 400 }
      );
    }

    const network = getCurrentNetwork();
    console.log('💎 [Execute] Network:', network, '| Env var:', process.env.NEXT_PUBLIC_SUI_NETWORK);
    console.log('💎 [Execute] txBytes length:', txBytes.length);
    console.log('💎 [Execute] userSignature length:', userSignature.length);
    console.log('💎 [Execute] userSignature preview:', userSignature.substring(0, 100) + '...');
    console.log('💎 [Execute] sponsorSignature length:', sponsorSignature.length);

    // Decode userSignature to inspect zkLogin structure
    try {
      const sigBytes = Buffer.from(userSignature, 'base64');
      const schemeFlag = sigBytes[0];
      console.log('💎 [Execute] Signature scheme flag:', schemeFlag, '(5 = zkLogin)');
      console.log('💎 [Execute] Signature total bytes:', sigBytes.length);
    } catch (e) {
      console.error('💎 [Execute] Failed to decode userSignature:', e);
    }

    // Execute the transaction
    let result;
    try {
      result = await executeSponsoredTransaction(
        new Uint8Array(Buffer.from(txBytes, 'base64')),
        userSignature,
        sponsorSignature,
        network
      );
    } catch (execError: any) {
      console.error('💎 [Execute] SUI execution error:', execError);
      console.error('💎 [Execute] Error message:', execError?.message);
      console.error('💎 [Execute] Error cause:', execError?.cause);
      throw execError;
    }

    // Check if transaction succeeded
    const status = result.effects?.status?.status;
    if (status !== 'success') {
      const error = result.effects?.status?.error || 'Transaction failed';
      return NextResponse.json(
        { error: `Transaction failed: ${error}` },
        { status: 400 }
      );
    }

    // Record purchases in database
    if (purchaseData?.cartItems && purchaseData.cartItems.length > 0) {
      try {
        // Insert purchase records (write both column names for compatibility)
        const purchaseRecords = purchaseData.cartItems.map(item => ({
          buyer_address: purchaseData.buyerAddress,
          buyer_wallet: purchaseData.buyerAddress, // Also write to buyer_wallet for LibraryTab queries
          buyer_persona_id: purchaseData.buyerPersonaId || null,
          track_id: item.id,
          price_usdc: item.price_usdc,
          tx_hash: result.digest,
          network: 'sui',
          status: 'completed',
          completed_at: new Date().toISOString(),
        }));

        const { error: insertError } = await supabase
          .from('purchases')
          .insert(purchaseRecords);

        if (insertError) {
          console.error('Failed to record purchases:', insertError);
          // Don't fail the request - transaction already succeeded
        }

        // Process earnings for each track
        for (const item of purchaseData.cartItems) {
          try {
            // Call the database function to process earnings
            const { error: earningsError } = await supabase.rpc('process_track_purchase', {
              p_track_id: item.id,
              p_buyer_address: purchaseData.buyerAddress,
              p_amount_usdc: item.price_usdc,
              p_tx_hash: result.digest,
              p_uploader_account_id: purchaseData.uploaderAccountId || null,
            });

            if (earningsError) {
              console.error(`Failed to process earnings for track ${item.id}:`, earningsError);
            }
          } catch (err) {
            console.error(`Error processing earnings for track ${item.id}:`, err);
          }
        }

      } catch (dbError) {
        console.error('Database error:', dbError);
        // Transaction succeeded, so we return success even if DB recording failed
      }
    }

    return NextResponse.json({
      success: true,
      txHash: result.digest,
      network,
      explorerUrl: network === 'mainnet'
        ? `https://suiscan.xyz/mainnet/tx/${result.digest}`
        : `https://suiscan.xyz/testnet/tx/${result.digest}`,
    });

  } catch (error) {
    console.error('Execute error:', error);

    const message = error instanceof Error ? error.message : 'Execution failed';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
