import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptKeypair, verifyKeypairAddress } from '@/lib/sui/keypair-manager';
import { getSuiClient, getUsdcType, usdcToUnits, isValidSuiAddress } from '@/lib/sui/client';
import { Transaction } from '@mysten/sui/transactions';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/personas/withdraw
 *
 * Withdraw USDC from a persona's wallet to an external address.
 * The manager (zkLogin account holder) can withdraw from any persona under their account.
 *
 * Request body:
 * - personaId: UUID of the persona to withdraw from
 * - destinationAddress: SUI address to send funds to
 * - amountUsdc: Amount in USDC (e.g., 10.50)
 * - accountId: UUID of the account (for verification)
 */
export async function POST(request: NextRequest) {
  try {
    const { personaId, destinationAddress, amountUsdc, accountId } = await request.json();

    // Validate inputs
    if (!personaId || !destinationAddress || !amountUsdc || !accountId) {
      return NextResponse.json(
        { error: 'Missing required fields: personaId, destinationAddress, amountUsdc, accountId' },
        { status: 400 }
      );
    }

    if (!isValidSuiAddress(destinationAddress)) {
      return NextResponse.json(
        { error: 'Invalid destination SUI address' },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountUsdc);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    console.log('[Withdraw] Request:', { personaId, destinationAddress, amountUsdc: amount });

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
        { error: 'Persona does not have a wallet. Generate one first.' },
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

    console.log('[Withdraw] Decrypting keypair for', persona.username);

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
      console.error('[Withdraw] Decryption failed:', decryptError);
      return NextResponse.json(
        { error: 'Failed to decrypt wallet. Please contact support.' },
        { status: 500 }
      );
    }

    console.log('[Withdraw] Keypair decrypted, building transaction');

    // Build the USDC transfer transaction
    const client = getSuiClient();
    const usdcType = getUsdcType();
    const amountUnits = usdcToUnits(amount);

    // Get USDC coins for the persona's wallet
    const { data: coins } = await client.getCoins({
      owner: persona.sui_address,
      coinType: usdcType,
    });

    if (!coins || coins.length === 0) {
      return NextResponse.json(
        { error: 'No USDC balance in this wallet' },
        { status: 400 }
      );
    }

    // Calculate total balance
    const totalBalance = coins.reduce((sum, coin) => sum + BigInt(coin.balance), BigInt(0));
    if (totalBalance < amountUnits) {
      return NextResponse.json(
        { error: `Insufficient balance. Available: ${Number(totalBalance) / 1_000_000} USDC` },
        { status: 400 }
      );
    }

    console.log('[Withdraw] Building transfer transaction');

    // Build transaction
    const tx = new Transaction();
    tx.setSender(persona.sui_address);

    // If we need to merge coins first
    if (coins.length > 1) {
      const [primaryCoin, ...otherCoins] = coins;
      if (otherCoins.length > 0) {
        tx.mergeCoins(
          tx.object(primaryCoin.coinObjectId),
          otherCoins.map(c => tx.object(c.coinObjectId))
        );
      }
      const [splitCoin] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [amountUnits]);
      tx.transferObjects([splitCoin], destinationAddress);
    } else {
      const [splitCoin] = tx.splitCoins(tx.object(coins[0].coinObjectId), [amountUnits]);
      tx.transferObjects([splitCoin], destinationAddress);
    }

    console.log('[Withdraw] Signing and executing transaction');

    // Sign and execute
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
        showEvents: true,
      },
    });

    console.log('[Withdraw] Transaction result:', result.digest);

    // Check if transaction was successful
    if (result.effects?.status?.status !== 'success') {
      console.error('[Withdraw] Transaction failed:', result.effects?.status);
      return NextResponse.json(
        { error: 'Transaction failed on-chain. Please try again.' },
        { status: 500 }
      );
    }

    // Log the withdrawal in the database
    await supabaseAdmin
      .from('earnings')
      .insert({
        persona_id: personaId,
        amount_usdc: -amount, // Negative for withdrawal
        source_type: 'withdrawal',
        status: 'withdrawn',
        tx_hash: result.digest,
      });

    return NextResponse.json({
      success: true,
      message: `Successfully withdrew $${amount.toFixed(2)} USDC`,
      data: {
        txHash: result.digest,
        amount: amount,
        from: persona.sui_address,
        to: destinationAddress,
      }
    });

  } catch (error) {
    console.error('[Withdraw] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
