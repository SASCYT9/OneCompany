import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { deleteUnusedShopLibraryMedia } from '@/lib/shopAdminMedia';
import { prisma } from '@/lib/prisma';
import { isVercelRuntime, VERCEL_FILE_STORAGE_MESSAGE } from '@/lib/vercelFileStorage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isVercelRuntime) {
    return NextResponse.json({ error: VERCEL_FILE_STORAGE_MESSAGE }, { status: 501 });
  }
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_WRITE);
    const { id } = await params;
    const result = await deleteUnusedShopLibraryMedia(prisma, id);

    if (result.notFound) {
      return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
    }

    if (!result.deleted || !result.item) {
      return NextResponse.json(
        {
          error: 'Media item is in use and cannot be deleted',
          usage: result.usage,
        },
        { status: 409 }
      );
    }

    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'media.delete',
      entityType: 'shop.media',
      entityId: result.item.id,
      metadata: {
        url: result.item.url,
        originalName: result.item.originalName,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop media delete', error);
    return NextResponse.json({ error: 'Failed to delete shop media' }, { status: 500 });
  }
}
