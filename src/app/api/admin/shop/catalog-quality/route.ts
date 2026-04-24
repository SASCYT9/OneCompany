import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { getCatalogQualityReport } from '@/lib/admin/catalogQuality';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_PRODUCTS_READ);

    return NextResponse.json(await getCatalogQualityReport(prisma));
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if ((error as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Admin catalog quality failed', error);
    return NextResponse.json({ error: 'Failed to load catalog quality' }, { status: 500 });
  }
}
