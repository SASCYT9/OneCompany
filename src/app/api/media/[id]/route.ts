import { NextResponse, NextRequest } from 'next/server';
import { deleteMedia, requireAdminSecret } from '@/lib/mediaStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Adapted to Next.js 16 route handler type where params may be a Promise.
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = requireAdminSecret(request);
  if (!auth.ok) return NextResponse.json({ error: auth.reason || 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const ok = await deleteMedia(id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
