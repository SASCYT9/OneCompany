import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { readSiteMedia, writeSiteMedia } from '@/lib/siteMediaServer';
import type { SiteMedia } from '@/types/site-media';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const media = await readSiteMedia();
    return NextResponse.json(media);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to read site media config', error);
    return NextResponse.json({ error: 'Failed to load site media' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const payload = (await request.json()) as SiteMedia;
    const saved = await writeSiteMedia(payload);
    return NextResponse.json(saved);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to save site media config', error);
    return NextResponse.json({ error: 'Failed to save site media' }, { status: 500 });
  }
}
