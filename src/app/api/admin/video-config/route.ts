import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { readVideoConfig, writeVideoConfig } from '@/lib/videoConfig';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_READ);
    return NextResponse.json(await readVideoConfig());
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to load video config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_SETTINGS_WRITE);
    const { heroVideo, heroEnabled, heroVideoMobile, heroPoster } = await request.json();

    const nextConfig = await writeVideoConfig({
      ...(typeof heroVideo === 'string' ? { heroVideo } : {}),
      ...(typeof heroEnabled === 'boolean' ? { heroEnabled } : {}),
      ...(typeof heroVideoMobile === 'string' ? { heroVideoMobile } : {}),
      ...(typeof heroPoster === 'string' ? { heroPoster } : {}),
    });

    try {
      await writeAdminAuditLog(prisma, session, {
        scope: 'content',
        action: 'video-config.update',
        entityType: 'site.video-config',
        metadata: {
          heroVideo: nextConfig.heroVideo,
          heroEnabled: nextConfig.heroEnabled,
          heroVideoMobile: nextConfig.heroVideoMobile ?? null,
          heroPoster: nextConfig.heroPoster ?? null,
        },
      });
    } catch (auditError) {
      console.error('Failed to write video config audit log', auditError);
    }

    return NextResponse.json(nextConfig);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { error: 'Failed to save video config' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
