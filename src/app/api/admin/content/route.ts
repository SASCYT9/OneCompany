import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { readSiteContent, writeSiteContent } from '@/lib/siteContentServer';
import { SiteContent } from '@/types/site-content';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const content = await readSiteContent();
    return NextResponse.json(content);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to read admin content', error);
    return NextResponse.json({ error: 'Failed to load content' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const payload = (await request.json()) as SiteContent;
    await writeSiteContent(payload);
    const content = await readSiteContent();
    return NextResponse.json(content);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to save site content', error);
    return NextResponse.json({ error: 'Failed to save content' }, { status: 500 });
  }
}
