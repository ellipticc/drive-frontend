/**
 * Base API Proxy Route
 * For actual proxying, use /api/proxy/[...slug]/route.ts
 * This route handles the base /api/proxy path
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    { error: 'API proxy requires a path. Use /api/proxy/v1/...' },
    { status: 400 }
  );
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200 });
}

