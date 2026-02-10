import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptKeypair, verifyKeypairAddress } from '@/lib/sui/keypair-manager';
import { getSuiClient, getUsdcType, usdcToUnits, isValidSuiAddress } from '@/lib/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { PaymentRecipient } from '@/lib/sui';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/sui/purchase-with-persona
 *
 * Execute a purchase using a persona's wallet instead of the zkLogin wallet.
 * The persona's private key is decrypted server-side and used to sign the transaction.
 *
 * Request body:
 * - personaId: UUID of the persona whose wallet to use
 * - accountId: UUID of the account (for authorization)
 * - recipients: Array of { address, amountUsdc, label } for payment splits
 * - cartItems: Array of { id, title, price_usdc } for record-keeping
 */
export async function POST(request: NextRequest) {
  try {
    const { personaId, accountId, recipients, cartItems } = await request.json();

    // Validate inputs
    if (!personaId || !accountId || !recipients || !Array.isArray(recipients)) {
      return NextResponse.json(
        { error: 'Missing required fields: personaId, accountId, recipients' },
        { status: 400 }
      );
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No payment recipients specified' },
        { status: 400 }
      );
    }

    // Validate all recipient addresses
    for (const recipient of recipients) {
      if (!isValidSuiAddress(recipient.address)) {
        return NextResponse.json(
          { error: `Invalid recipient address: ${recipient.address}` },
          { status: 400 }
        );
      }
    }

    const totalUsdc = recipients.reduce((sum: number, r: PaymentRecipient) => sum + r.amountUsdc, 0);
    console.log('[PurchaseWithPersona] Request:', {
      personaId,
      recipientCount: recipients.length,
      totalUsdc
    });

    // Fetch the persona and verify ownership
    const { data: persona, error: personaError } = await supabaseAdmin
      .from('personas')
      .select('id, username, account_id, sui_address, sui_keypair_encrypted, sui_keypair_nonce')
      .eq('id', personaId)
      .eq('is_active', true)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      );
    }

    // Verify the persona belongs to the requesting account
    if (persona.account_id !== accountId) {
      return NextResponse.json(
        { error: 'Unauthorized: persona does not belong to this account' },
        { status: 403 }
      );
    }

    // Check if persona has a wallet
    if (!persona.sui_address || !persona.sui_keypair_encrypted || !persona.sui_keypair_nonce) {
      return NextResponse.json(
        { error: 'Persona does not have a wallet. Cannot purchase.' },
        { status: 400 }
      );
    }

    // Get the account's zklogin_salt for decryption
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('zklogin_salt')
      .eq('id', accountId)
      .single();

    if (accountError || !account?.zklogin_salt) {
      return NextResponse.json(
        { error: 'Account encryption key not found. Please log in again.' },
        { status: 400 }
      );
    }

    console.log('[PurchaseWithPersona] Decrypting keypair for', persona.username);

    // Decrypt the persona's private key
    let keypair;
    try {
      keypair = decryptKeypair(
        {
          encryptedKey: persona.sui_keypair_encrypted,
          nonce: persona.sui_keypair_nonce,
          suiAddress: persona.sui_address,
        },
        account.zklogin_salt
      );

      // Verify the decrypted keypair matches the expected address
      if (!verifyKeypairAddress(keypair, persona.sui_address)) {
        throw new Error('Decrypted keypair address mismatch');
      }
    } catch (decryptError) {
      console.error('[PurchaseWithPersona] Decryption failed:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt wallet. Please contact support.' },
        { status: 500 }
      );
    }

    console.log('[PurchaseWithPersona] Keypair decrypted, checking balance');

    // Build the USDC split payment transaction
    const client = getSuiClient();
    const usdcType = getUsdcType();
    const totalUnits = usdcToUnits(totalUsdc);

    // Get USDC coins for the persona's wallet
    const { data: usdcCoins } = await client.getCoins({
      owner: persona.sui_address,
      coinType: usdcType,
    });

    if (!usdcCoins || usdcCoins.length === 0) {
      return NextResponse.json(
        { error: 'No USDC balance in this persona wallet' },
        { status: 400 }
      );
    }

    // Calculate total USDC balance
    const totalBalance = usdcCoins.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));
    if (totalBalance < totalUnits) {
      const available = Number(totalBalance) / 1_000_000;
      return NextResponse.json(
        { error: `Insufficient USDC balance. Need $${totalUsdc.toFixed(2)}, have $${available.toFixed(2)}` },
        { status: 400 }
      );
    }

    console.log('[PurchaseWithPersona] Building split payment transaction');

    // Get sponsor keypair for gas payment (same env var as other SUI routes)
    const sponsorPrivateKey = process.env.SUI_SPONSOR_PRIVATE_KEY;
    if (!sponsorPrivateKey) {
      return NextResponse.json(
        { error: 'Gas sponsor not configured (SUI_SPONSOR_PRIVATE_KEY)' },
        { status: 500 }
      );
    }

    const sponsorKeypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(sponsorPrivateKey, 'hex')
    );
    const sponsorAddress = sponsorKeypair.toSuiAddress();

    // Get sponsor's gas coins
    const { data: gasCoins } = await client.getCoins({
      owner: sponsorAddress,
      coinType: '0x2::sui::SUI',
    });

    if (!gasCoins || gasCoins.length === 0) {
      return NextResponse.json(
        { error: 'Sponsor wallet has no SUI for gas' },
        { status: 500 }
      );
    }

    // Build transaction
    const tx = new Transaction();
    tx.setSender(persona.sui_address);
    tx.setGasOwner(sponsorAddress); // Sponsor pays for gas

    // Set gas payment from sponsor
    tx.setGasPayment(
      gasCoins.slice(0, 1).map(coin => ({
        objectId: coin.coinObjectId,
        version: coin.version,
        digest: coin.digest,
      }))
    );
    tx.setGasBudget(100_000_000); // 0.1 SUI budget

    // Get the primary USDC coin (merge if needed)
    let primaryCoin = tx.object(usdcCoins[0].coinObjectId);
    if (usdcCoins.length > 1) {
      const otherCoins = usdcCoins.slice(1).map(c => tx.object(c.coinObjectId));
      tx.mergeCoins(primaryCoin, otherCoins);
    }

    // Split coins for each recipient
    const amounts = recipients.map((r: PaymentRecipient) => usdcToUnits(r.amountUsdc));
    const splitCoins = tx.splitCoins(primaryCoin, amounts);

    // Transfer to each recipient
    recipients.forEach((recipient: PaymentRecipient, index: number) => {
      tx.transferObjects([splitCoins[index]], recipient.address);
    });

    console.log('[PurchaseWithPersona] Building transaction bytes');

    // Build the transaction
    const txBytes = await tx.build({ client });

    console.log('[PurchaseWithPersona] Signing with persona and sponsor keypairs');

    // Sign with both keypairs
    const personaSignature = await keypair.signTransaction(txBytes);
    const sponsorSignature = await sponsorKeypair.signTransaction(txBytes);

    console.log('[PurchaseWithPersona] Executing sponsored transaction');

    // Execute with both signatures
    const result = await client.executeTransactionBlock({
      transactionBlock: txBytes,
      signature: [personaSignature.signature, sponsorSignature.signature],
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log('[PurchaseWithPersona] Transaction result:', result.digest);

    // Check if transaction was successful
    const status = result.effects?.status?.status;
    if (status !== 'success') {
      console.error('[PurchaseWithPersona] Transaction failed:', result.effects?.status);
      return NextResponse.json(
        { error: `Transaction failed on-chain: ${result.effects?.status?.error || 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Record purchases in database
    if (cartItems && Array.isArray(cartItems)) {
      for (const item of cartItems) {
        // Get the track's uploader wallet for seller_wallet
        const trackId = item.id.replace(/-loc-\d+$/, ''); // Strip location suffix
        const { data: trackData } = await supabaseAdmin
          .from('ip_tracks')
          .select('primary_uploader_wallet')
          .eq('id', trackId)
          .single();

        const { error: insertError } = await supabaseAdmin.from('purchases').insert({
          // Write both column names for compatibility
          buyer_wallet: persona.sui_address,
          buyer_address: persona.sui_address,
          buyer_persona_id: personaId,
          track_id: trackId,
          seller_wallet: trackData?.primary_uploader_wallet || recipients[0]?.address || 'unknown',
          price_usdc: item.price_usdc,
          purchase_price: item.price_usdc, // Also write to legacy column
          tx_hash: result.digest,
          network: 'sui',
          completed_at: new Date().toISOString(),
        });
        if (insertError) {
          console.error('[PurchaseWithPersona] Failed to record purchase:', insertError);
        }
      }
    }

    // Record earnings for each recipient (for history/audit trail)
    // Only if cartItems provided (not for remix purchases which handle their own records)
    if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
      console.log('[PurchaseWithPersona] Recording earnings for recipients');
      for (const recipient of recipients) {
        // Look up if this address belongs to a persona
        const { data: recipientPersona } = await supabaseAdmin
          .from('personas')
          .select('id')
          .eq('sui_address', recipient.address)
          .eq('is_active', true)
          .maybeSingle();

        if (recipientPersona) {
          // Record earning for this persona
          const { error: earningsError } = await supabaseAdmin.from('earnings').insert({
            persona_id: recipientPersona.id,
            amount_usdc: recipient.amountUsdc,
            source_type: 'download_sale',
            source_id: cartItems[0]?.id?.replace(/-loc-\d+$/, ''), // First track ID
            buyer_address: persona.sui_address,
            buyer_persona_id: personaId,
            tx_hash: result.digest,
          });

          if (earningsError) {
            console.error('[PurchaseWithPersona] Failed to record earning:', earningsError);
          } else {
            console.log(`[PurchaseWithPersona] Recorded $${recipient.amountUsdc} earning for persona ${recipientPersona.id}`);
          }
        } else {
          console.log(`[PurchaseWithPersona] Recipient ${recipient.address} not found as persona - skipping earnings record`);
        }
      }
    } else {
      console.log('[PurchaseWithPersona] No cartItems provided - skipping earnings records (remix flow handles separately)');
    }

    return NextResponse.json({
      success: true,
      txHash: result.digest,
      buyerAddress: persona.sui_address,
      buyerPersonaId: personaId,
      totalUsdc,
      recipientCount: recipients.length,
    });

  } catch (error) {
    console.error('[PurchaseWithPersona] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
