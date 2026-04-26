import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * Universal notes endpoint.
 *
 * GET   /api/admin/notes/[id]/[entityId]   → list notes (newest first)
 * POST  /api/admin/notes/[id]/[entityId]   → create note
 * Body: { content: string, isPinned?: boolean }
 */

const VALID_ENTITY_PREFIXES = ['shop.', 'admin.', 'crm.'] as const;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const { id: entityType, entityId } = await params;
    if (!VALID_ENTITY_PREFIXES.some((p) => entityType.startsWith(p))) {
      return NextResponse.json({ error: 'Unsupported entityType' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const notes = await (prisma as any).shopEntityNote.findMany({
      where: { entityType, entityId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({
      notes: notes.map((n: Record<string, unknown> & { createdAt: Date; updatedAt: Date }) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entityId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore);

    const { id: entityType, entityId } = await params;
    if (!VALID_ENTITY_PREFIXES.some((p) => entityType.startsWith(p))) {
      return NextResponse.json({ error: 'Unsupported entityType' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { content?: string; isPinned?: boolean };
    if (!body.content || !body.content.trim()) {
      return NextResponse.json({ error: 'Content required' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const note = await (prisma as any).shopEntityNote.create({
      data: {
        entityType,
        entityId,
        authorEmail: session.email,
        authorName: session.name,
        content: body.content.trim(),
        isPinned: body.isPinned ?? false,
      },
    });

    return NextResponse.json({
      ...note,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
