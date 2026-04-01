import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';
import { AILogisticsService } from '@/lib/services/aiLogisticsService';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify Admin rights
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: session.user.email, isActive: true }
    });
    if (!adminUser) {
      return NextResponse.json({ error: 'Access denied. Admins only.' }, { status: 403 });
    }

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
