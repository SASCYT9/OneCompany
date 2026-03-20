import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { prisma } from '@/lib/prisma';
import { syncUrbanCollectionAssignments } from '@/lib/shopAdminCollections';
import { ensureDefaultShopStores } from '@/lib/shopStores';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_WRITE);
    await ensureDefaultShopStores(prisma);
    const result = await syncUrbanCollectionAssignments(prisma);
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'collection.sync_urban',
      entityType: 'shop.collection',
      metadata: { storeKey: 'urban', ...result },
    });
    return NextResponse.json(result);
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin shop collection sync Urban', error);
    return NextResponse.json({ error: 'Failed to sync Urban collections' }, { status: 500 });
  }
}
