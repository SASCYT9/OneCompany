import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const body = await request.json();
    const { ids, status } = body;

    if (!ids || !Array.isArray(ids) || !status) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const updated = await prisma.shopProduct.updateMany({
      where: {
        id: { in: ids }
      },
      data: {
        status,
        // If activating, we might also want to ensure isPublished is handled
        isPublished: status === 'ACTIVE' ? true : undefined
      }
    });

    // Also record this in audit logs if needed
    // ...

    return NextResponse.json({ success: true, count: updated.count });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('Bulk Status Error:', error);
    return NextResponse.json({ error: 'Failed to update products' }, { status: 500 });
  }
}
