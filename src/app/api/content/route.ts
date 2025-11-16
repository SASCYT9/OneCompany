import { NextResponse } from 'next/server';
import { readSiteContent } from '@/lib/siteContentServer';

export async function GET() {
  try {
    const content = await readSiteContent();
    return NextResponse.json(content);
  } catch (error) {
    console.error('Failed to load site content', error);
    return NextResponse.json({ error: 'Unable to load content' }, { status: 500 });
  }
}
