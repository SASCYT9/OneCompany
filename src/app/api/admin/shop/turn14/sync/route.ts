import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { findTurn14BrandIdByName, fetchTurn14ItemsByBrand } from '@/lib/turn14';
import { syncBrandFromTurn14 } from '@/lib/turn14Sync';

/**
 * POST /api/admin/shop/turn14/sync
 * Body: { brandName: string }
 * 
 * Triggers a full background sync for a given brand from Turn14 → our DB.
 * All items are created as DRAFT (not published) so admin can review before going live.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const body = await request.json();
    const brandName = body.brandName || 'Urban Automotive';

    console.log(`[Turn14 Sync] Starting sync for brand: "${brandName}"`);

    const result = await syncBrandFromTurn14(
      prisma,
      brandName,
      findTurn14BrandIdByName,
      fetchTurn14ItemsByBrand,
      (msg) => console.log(msg)
    );

    return NextResponse.json({
      success: true,
      brand: brandName,
      ...result,
      message: `Sync complete! ${result.created} new products created, ${result.updated} updated, ${result.errors} errors out of ${result.total} total items.`
    });
  } catch (error: any) {
    console.error('[Turn14 Sync] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300; // Allow up to 5 minutes for full sync
