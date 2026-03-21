import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { addMediaFromBuffer } from '@/lib/mediaStore';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { listShopLibraryMedia } from '@/lib/shopAdminMedia';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);
    const items = await listShopLibraryMedia(prisma);
    return NextResponse.json({ items });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop media list', error);
    return NextResponse.json({ error: 'Failed to list shop media' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const item = await addMediaFromBuffer(buffer, file.name, file.type || 'application/octet-stream');

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'media.upload',
      entityType: 'shop.media',
      entityId: item.id,
      metadata: {
        url: item.url,
        originalName: item.originalName,
        kind: item.kind,
        size: item.size,
      },
    });

    return NextResponse.json(
      {
        item: {
          ...item,
          usage: {
            productPrimaryImages: 0,
            productMedia: 0,
            variantImages: 0,
          },
          usageCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop media upload', error);
    return NextResponse.json({ error: 'Failed to upload shop media' }, { status: 500 });
  }
}
