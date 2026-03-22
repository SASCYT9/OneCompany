import { NextResponse } from 'next/server';
import { searchTurn14Items } from '@/lib/turn14';

export async function GET(request: Request) {
  // Simple auth check could go here based on your admin auth model

  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('q');
  const page = parseInt(searchParams.get('page') || '1', 10);

  if (!keyword) {
    return NextResponse.json({ data: [], meta: { current_page: 1, total_pages: 1 } });
  }

  try {
    const results = await searchTurn14Items(keyword, page);
    return NextResponse.json(results);
  } catch (error) {
    console.error('[API] Turn14 Search Error:', error);
    return NextResponse.json({ error: 'Failed to search Turn14 catalog. Please verify your API credentials.' }, { status: 500 });
  }
}
