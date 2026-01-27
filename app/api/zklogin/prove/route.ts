/**
 * API Route: Get ZK Proof from Shinami
 *
 * POST /api/zklogin/prove
 *
 * Proxies zkLogin proof requests to Shinami's prover service.
 * This keeps the Shinami API key server-side and handles CORS.
 */

import { NextRequest, NextResponse } from 'next/server';

const SHINAMI_PROVER_URL = 'https://api.us1.shinami.com/sui/zkprover/v1';
const SHINAMI_API_KEY = process.env.SHINAMI_WALLET_SERVICES_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!SHINAMI_API_KEY) {
      console.error('❌ [zkProve] SHINAMI_WALLET_SERVICES_KEY not configured');
      return NextResponse.json(
        { error: 'Prover service not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { jwt, extendedEphemeralPublicKey, maxEpoch, jwtRandomness, salt } = body;

    // Validate required fields
    if (!jwt || !extendedEphemeralPublicKey || !maxEpoch || !jwtRandomness || !salt) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🔐 [zkProve] Requesting proof from Shinami...');
    console.log('🔐 [zkProve] maxEpoch:', maxEpoch, 'type:', typeof maxEpoch);
    console.log('🔐 [zkProve] extendedEphemeralPublicKey:', extendedEphemeralPublicKey?.substring(0, 30) + '...');
    console.log('🔐 [zkProve] jwtRandomness:', jwtRandomness?.substring(0, 20) + '...');
    console.log('🔐 [zkProve] salt:', salt?.substring(0, 20) + '...');
    console.log('🔐 [zkProve] jwt length:', jwt?.length);

    // Shinami expects maxEpoch as a STRING, not a number
    const maxEpochStr = String(maxEpoch);

    const requestBody = {
      jsonrpc: '2.0',
      method: 'shinami_zkp_createZkLoginProof',
      params: [jwt, maxEpochStr, extendedEphemeralPublicKey, jwtRandomness, salt],
      id: 1,
    };

    console.log('🔐 [zkProve] Request body (without jwt):', {
      ...requestBody,
      params: ['[jwt]', maxEpochStr, extendedEphemeralPublicKey, jwtRandomness, salt],
    });

    // Call Shinami's prover using JSON-RPC format
    const response = await fetch(SHINAMI_PROVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': SHINAMI_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();

    console.log('🔐 [zkProve] Shinami response status:', response.status);
    console.log('🔐 [zkProve] Shinami full response:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('❌ [zkProve] Shinami error:', JSON.stringify(result.error, null, 2));
      return NextResponse.json(
        { error: result.error.message || result.error.data || 'Prover error' },
        { status: 400 }
      );
    }

    if (!result.result) {
      console.error('❌ [zkProve] No result from Shinami:', result);
      return NextResponse.json(
        { error: 'No proof returned from prover' },
        { status: 500 }
      );
    }

    console.log('✅ [zkProve] Proof received successfully');

    // Return the zkProof in the expected format
    return NextResponse.json(result.result);

  } catch (error) {
    console.error('❌ [zkProve] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get proof' },
      { status: 500 }
    );
  }
}
