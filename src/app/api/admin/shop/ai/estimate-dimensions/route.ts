import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { AILogisticsService } from '@/lib/services/aiLogisticsService';

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    // 1. Verify standard admin access right via custom admin session
    assertAdminRequest(cookieStore, 'shop.*');

    const { title, brand, sku, categoryName } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required for estimation' }, { status: 400 });
    }

    const estimate = await AILogisticsService.estimateDimensions(
      title,
      brand || 'Unknown',
      sku,
      categoryName
    );

    return NextResponse.json({ success: true, estimate });
  } catch (error: any) {
    console.error('AI Estimator Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to estimate dimensions' },
      { status: 500 }
    );
  }
}
