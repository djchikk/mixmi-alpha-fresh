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
        // Insert purchase records one at a time to get seller_wallet
        for (const item of purchaseData.cartItems) {
          // Get the track's uploader wallet for seller_wallet
          const { data: trackData } = await supabase
            .from('ip_tracks')
            .select('primary_uploader_wallet')
            .eq('id', item.id)
            .single();

          const { error: insertError } = await supabase
            .from('purchases')
            .insert({
              buyer_address: purchaseData.buyerAddress,
              buyer_wallet: purchaseData.buyerAddress,
              buyer_persona_id: purchaseData.buyerPersonaId || null,
              track_id: item.id,
              seller_wallet: trackData?.primary_uploader_wallet || 'unknown',
              price_usdc: item.price_usdc,
              purchase_price: item.price_usdc,
              tx_hash: result.digest,
              network: 'sui',
              completed_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Failed to record purchase:', insertError);
          }
        }

        // Record earnings for track sellers
        // Note: This records based on the track's uploader. For detailed split tracking,
        // the purchase-with-persona route handles individual recipients.
        for (const item of purchaseData.cartItems) {
          try {
            // Get the track's uploader wallet
            const { data: track } = await supabase
              .from('ip_tracks')
              .select('primary_uploader_wallet')
              .eq('id', item.id)
              .single();

            if (track?.primary_uploader_wallet) {
              // Look up if this wallet belongs to a persona
              const { data: sellerPersona } = await supabase
                .from('personas')
                .select('id')
                .or(`sui_address.eq.${track.primary_uploader_wallet},wallet_address.eq.${track.primary_uploader_wallet}`)
                .eq('is_active', true)
                .maybeSingle();

              if (sellerPersona) {
                const { error: earningsError } = await supabase.from('earnings').insert({
                  persona_id: sellerPersona.id,
                  amount_usdc: item.price_usdc,
                  source_type: 'download_sale',
                  source_id: item.id,
                  buyer_address: purchaseData.buyerAddress,
                  buyer_persona_id: purchaseData.buyerPersonaId || null,
                  tx_hash: result.digest,
                });

                if (earningsError) {
                  console.error(`Failed to record earning for track ${item.id}:`, earningsError);
                } else {
                  console.log(`Recorded $${item.price_usdc} earning for seller persona`);
                }
              }
            }
          } catch (err) {
            console.error(`Error recording earnings for track ${item.id}:`, err);
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
