/**
 * API route: POST /api/auth/oauth/complete-registration
 * Proxies to backend: POST /api/v1/auth/oauth/complete-registration
 * Complete OAuth registration by setting password
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Missing authentication token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { accountSalt, encrypted_recovery_key, recovery_key_nonce, pqc_keypairs, algorithm_version } = body;

    if (!accountSalt) {
      return NextResponse.json(
        { error: 'accountSalt is required' },
        { status: 400 }
      );
    }

    // Determine the backend URL based on whether we're accessing via TOR
    const isTor = request.headers.get('host')?.endsWith('.onion') ?? false;
    const backendUrl = isTor 
      ? 'http://i5ih4obfx42tlbqdidrm2qv36ay4waalfoeozvs42impy6vy6pruhgyd.onion'
      : 'https://drive.ellipticc.com';

    // Call backend to complete registration
    const response = await fetch(`${backendUrl}/api/v1/auth/oauth/complete-registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        accountSalt,
        encrypted_recovery_key,
        recovery_key_nonce,
        pqc_keypairs,
        algorithm_version
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error completing OAuth registration:', error);
    return NextResponse.json(
      { error: 'Failed to complete registration' },
      { status: 500 }
    );
  }
}