/**
 * API route: GET /api/auth/oauth/google/url
 * Proxies to backend: GET /api/v1/auth/oauth/google/url
 * Returns the Google OAuth authorization URL
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    const response = await fetch(`${backendUrl}/api/v1/auth/oauth/google/url`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error getting Google OAuth URL:', error);
    return NextResponse.json(
      { error: 'Failed to get OAuth URL' },
      { status: 500 }
    );
  }
}
