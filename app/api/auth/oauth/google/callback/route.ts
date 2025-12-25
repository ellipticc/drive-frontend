/**
 * API route: GET /api/auth/oauth/google/callback
 * Proxies to backend: GET /api/v1/auth/oauth/google/callback
 * Handles Google OAuth callback
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing authorization code or state' },
        { status: 400 }
      );
    }

    // Use configured backend URL or default to clearnet backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/,'') : 'https://drive.ellipticc.com';

    // Call backend to verify Google token and create session
    const response = await fetch(
      `${backendUrl}/api/v1/auth/oauth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Pass cookies to backend (for CSRF protection)
          'Cookie': request.headers.get('cookie') || ''
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    
    // Set JWT tokens in secure HttpOnly cookies
    const res = NextResponse.json(data);
    
    // Store access token in secure httpOnly cookie
    res.cookies.set({
      name: 'accessToken',
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 // 1 hour
    });

    // Store refresh token in secure httpOnly cookie
    if (data.refreshToken) {
      res.cookies.set({
        name: 'refreshToken',
        value: data.refreshToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7 days
      });
    }

    return res;
  } catch (error) {
    console.error('Error handling Google OAuth callback:', error);
    return NextResponse.json(
      { error: 'OAuth callback processing failed' },
      { status: 500 }
    );
  }
}