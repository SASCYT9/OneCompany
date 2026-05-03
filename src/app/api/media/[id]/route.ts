import { NextResponse, NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { deleteMedia } from '@/lib/mediaStore';
import { assertAdminRequest } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Adapted to Next.js 16 route handler type where params may be a Promise.
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const ok = await deleteMedia(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 });
  }
}
