import { NextRequest, NextResponse } from 'next/server';
import { createStockFeedResponse } from '@/lib/shopStockFeed';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    return await createStockFeedResponse(req.nextUrl.searchParams);
  } catch (error: any) {
    console.error('[Public Stock Feed Error]', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to generate stock feed from Airtable', details: error?.message },
      { status: 500 }
    );
  }
}
