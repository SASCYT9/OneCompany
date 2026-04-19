import { NextResponse } from 'next/server';
import { readVideoConfig } from '@/lib/videoConfig';

export async function GET() {
  return NextResponse.json(await readVideoConfig());
}

export const runtime = 'nodejs';
