/**
 * Generic API Proxy Route - Catch-all for /api/proxy/*
 * Proxies all API requests through the Next.js server to avoid CORS issues on TOR
 * This is necessary because TOR Browser strips Origin headers for privacy
 * 
 * Usage: /api/proxy/v1/auth/login -> forwards to backend:/api/v1/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const resolvedParams = await params;
  return handleApiProxy(request, resolvedParams.slug);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const resolvedParams = await params;
  return handleApiProxy(request, resolvedParams.slug);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const resolvedParams = await params;
  return handleApiProxy(request, resolvedParams.slug);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const resolvedParams = await params;
  return handleApiProxy(request, resolvedParams.slug);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const resolvedParams = await params;
  return handleApiProxy(request, resolvedParams.slug);
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const resolvedParams = await params;
  return handleApiProxy(request, resolvedParams.slug);
}

async function handleApiProxy(request: NextRequest, slug: string[]) {
  let backendType = 'unknown';
  let backendUrl = '';
  let fullApiPath = '';

  try {
    // Reconstruct the API path from slug: ['v1', 'auth', 'login'] -> '/api/v1/auth/login'
    const apiPath = '/' + slug.join('/');
    
    // Include query string if present
    const queryString = request.nextUrl.search;
    fullApiPath = '/api' + apiPath + queryString;

    if (!apiPath || apiPath === '/') {
      return NextResponse.json(
        { error: 'Missing API path' },
        { status: 400 }
      );
    }

    // Determine the backend URL based on whether we're accessing via TOR or clearnet
    const host = request.headers.get('host') || '';
    const isTor = host.endsWith('.onion');
    
    // For TOR: Use localhost:3000 (nginx forwards TOR traffic to localhost)
    // For clearnet: Use clearnet backend
    // For localhost development: Use localhost:3000
    if (isTor) {
      // TOR request coming through nginx on localhost - forward to backend on localhost
      // nginx listens on 127.0.0.1:8080 and forwards to 127.0.0.1:3000
      backendUrl = 'http://127.0.0.1:3000';
      backendType = 'TOR';
    } else if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
      // Localhost development - use localhost backend
      backendUrl = 'http://127.0.0.1:3000';
      backendType = 'localhost';
    } else {
      // Clearnet - use clearnet backend
      backendUrl = 'https://drive.ellipticc.com';
      backendType = 'clearnet';
    }

    // Build the full backend URL
    const targetUrl = `${backendUrl}${fullApiPath}`;

    console.log(`[Proxy:${backendType}] ${request.method} ${fullApiPath} → ${backendUrl}`);

    // Forward headers (excluding host-specific headers)
    const forwardHeaders: Record<string, string> = {};
    const headersToForward = [
      'content-type',
      'authorization',
      'x-chunk-nonce',
      'x-requested-with',
      'cookie',
      'accept',
      'accept-encoding',
    ];

    for (const [key, value] of request.headers.entries()) {
      if (headersToForward.includes(key.toLowerCase())) {
        forwardHeaders[key] = value;
      }
    }

    // Get request body for non-GET requests
    let body: any = undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const jsonData = await request.json();
          body = JSON.stringify(jsonData);
        } else if (contentType?.includes('application/x-www-form-urlencoded')) {
          body = await request.text();
        } else {
          body = await request.text();
        }
      } catch (e) {
        console.warn('Could not parse request body:', e);
      }
    }

    // Make the proxied request
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: body,
      credentials: 'include',
    });

    // Get response body
    const responseData = await response.text();

    // Create the response with proper status
    const proxyResponse = new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
    });

    // Copy important headers from backend response
    const headersToProxy = [
      'content-type',
      'content-length',
      'cache-control',
      'etag',
      'set-cookie',
    ];

    for (const header of headersToProxy) {
      const value = response.headers.get(header);
      if (value) {
        proxyResponse.headers.set(header, value);
      }
    }

    // Log result
    console.log(`[Proxy:${backendType}] ${response.status} ${response.statusText}`);

    return proxyResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Proxy:${backendType}] Error proxying to ${backendUrl}${fullApiPath}: ${errorMessage}`);
    return NextResponse.json(
      { 
        error: 'API proxy failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
