import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * Single-note endpoints.
 *
 * PATCH  /api/admin/notes/[id]   → update content or pin state
 * DELETE /api/admin/notes/[id]   → remove note (only author or superadmin)
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore);

    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { content?: string; isPinned?: boolean };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = await (prisma as any).shopEntityNote.findUnique({ where: { id } });
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    // Only author may edit content
    if (body.content !== undefined && note.authorEmail !== session.email) {
      return NextResponse.json({ error: 'Only the author can edit a note' }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (body.content !== undefined && body.content.trim()) data.content = body.content.trim();
    if (body.isPinned !== undefined) data.isPinned = body.isPinned;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = await (prisma as any).shopEntityNote.update({ where: { id }, data });
    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore);

    const { id } = await params;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = await (prisma as any).shopEntityNote.findUnique({ where: { id } });
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });

    if (note.authorEmail !== session.email) {
      return NextResponse.json({ error: 'Only the author can delete a note' }, { status: 403 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopEntityNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
