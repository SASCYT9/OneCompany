import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { ADMIN_PERMISSIONS } from '@/lib/adminRbac';
import { computeSegmentMembers, type SegmentRules } from '@/lib/shopCustomerSegments';

/**
 * Preview a segment without saving — return matching count.
 *
 * POST /api/admin/shop/segments/preview
 * Body: { rulesJson: SegmentRules }
 */

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore, ADMIN_PERMISSIONS.SHOP_CUSTOMERS_READ);

    const body = (await request.json().catch(() => ({}))) as { rulesJson?: SegmentRules };
    if (!body.rulesJson) return NextResponse.json({ error: 'rulesJson required' }, { status: 400 });

    const ids = await computeSegmentMembers(body.rulesJson);
    return NextResponse.json({ count: ids.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
