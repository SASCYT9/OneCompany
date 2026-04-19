import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { readSiteMedia, writeSiteMedia } from '@/lib/siteMediaServer';
import type { SiteMedia } from '@/types/site-media';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);
    const media = await readSiteMedia();
    return NextResponse.json(media);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Failed to read site media config', error);
    return NextResponse.json({ error: 'Failed to load site media' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    const payload = (await request.json()) as SiteMedia;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Invalid site media payload' }, { status: 400 });
    }
    const saved = await writeSiteMedia(payload);
    try {
      await writeAdminAuditLog(prisma, session, {
        scope: 'content',
        action: 'site-media.update',
        entityType: 'site.media',
        metadata: {
          stores: Object.keys(payload.stores ?? {}),
        },
      });
    } catch (auditError) {
      console.error('Failed to write site media audit log', auditError);
    }
    return NextResponse.json(saved);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Failed to save site media config', error);
    return NextResponse.json({ error: 'Failed to save site media' }, { status: 500 });
  }
}
