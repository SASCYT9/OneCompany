import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { readSiteContent, writeSiteContent } from '@/lib/siteContentServer';
import { prisma } from '@/lib/prisma';
import { SiteContent } from '@/types/site-content';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);
    const content = await readSiteContent();
    return NextResponse.json(content);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Failed to read admin content', error);
    return NextResponse.json({ error: 'Failed to load content' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    const payload = (await request.json()) as SiteContent;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Invalid content payload' }, { status: 400 });
    }
    await writeSiteContent(payload);
    try {
      await writeAdminAuditLog(prisma, session, {
        scope: 'content',
        action: 'site-content.update',
        entityType: 'site.content',
        metadata: {
          sections: Object.keys(payload),
        },
      });
    } catch (auditError) {
      console.error('Failed to write site content audit log', auditError);
    }
    const content = await readSiteContent();
    return NextResponse.json(content);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Failed to save site content', error);
    return NextResponse.json({ error: 'Failed to save content' }, { status: 500 });
  }
}
