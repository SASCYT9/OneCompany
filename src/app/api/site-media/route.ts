import { NextResponse } from 'next/server';
import { readSiteMedia } from '@/lib/siteMediaServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const media = await readSiteMedia();
    return NextResponse.json(media);
  } catch (error) {
    console.error('Failed to load site media config', error);
    return NextResponse.json({ error: 'Failed to load media config' }, { status: 500 });
  }
}
