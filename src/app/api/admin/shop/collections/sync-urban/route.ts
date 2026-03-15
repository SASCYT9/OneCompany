import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS, writeAdminAuditLog } from '@/lib/adminRbac';
import { syncUrbanCollectionAssignments } from '@/lib/shopAdminCollections';

const prisma = new PrismaClient();

export async function POST() {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_COLLECTIONS_WRITE);
    const result = await syncUrbanCollectionAssignments(prisma);
    await writeAdminAuditLog(prisma, session, {
      scope: 'shop',
      action: 'collection.sync_urban',
      entityType: 'shop.collection',
      metadata: result,
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
