/**
 * Base API Proxy Route
 * For actual proxying, use /api/proxy/[...slug]/route.ts
 * This route handles the base /api/proxy path
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function PUT(request: NextRequest) {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function PATCH(request: NextRequest) {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { status: 200 });
}

