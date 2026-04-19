import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const markups = await prisma.turn14BrandMarkup.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ success: true, data: markups });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
