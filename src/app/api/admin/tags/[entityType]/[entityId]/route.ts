import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { assertAdminRequest } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';

/**
 * Universal tags endpoint.
 *
 * GET    /api/admin/tags/[entityType]/[entityId]                    → list tags
 * POST   /api/admin/tags/[entityType]/[entityId]   { tag }          → add tag
 * DELETE /api/admin/tags/[entityType]/[entityId]?tag={tag}          → remove tag
 */

const VALID_ENTITY_PREFIXES = ['shop.', 'admin.', 'crm.'] as const;

function normalizeTag(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 64);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const { entityType, entityId } = await params;
    if (!VALID_ENTITY_PREFIXES.some((p) => entityType.startsWith(p))) {
      return NextResponse.json({ error: 'Unsupported entityType' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags = await (prisma as any).shopEntityTag.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, tag: true, createdAt: true },
    });

    return NextResponse.json({
      tags: tags.map((t: { tag: string; createdAt: Date; id: string }) => ({
        id: t.id,
        tag: t.tag,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to load tags' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  try {
    const cookieStore = await cookies();
    const session = assertAdminRequest(cookieStore);

    const { entityType, entityId } = await params;
    if (!VALID_ENTITY_PREFIXES.some((p) => entityType.startsWith(p))) {
      return NextResponse.json({ error: 'Unsupported entityType' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as { tag?: string };
    const tag = normalizeTag(body.tag ?? '');
    if (!tag) return NextResponse.json({ error: 'Tag is required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).shopEntityTag.findUnique({
      where: { entityType_entityId_tag: { entityType, entityId, tag } },
    });
    if (existing) return NextResponse.json({ id: existing.id, tag, alreadyExists: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (prisma as any).shopEntityTag.create({
      data: { entityType, entityId, tag, createdBy: session.email },
    });

    return NextResponse.json({ id: created.id, tag });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to add tag' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; entityId: string }> }
) {
  try {
    const cookieStore = await cookies();
    assertAdminRequest(cookieStore);

    const { entityType, entityId } = await params;
    const tag = normalizeTag(request.nextUrl.searchParams.get('tag') ?? '');
    if (!tag) return NextResponse.json({ error: 'tag query param required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).shopEntityTag.deleteMany({
      where: { entityType, entityId, tag },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Failed to remove tag' }, { status: 500 });
  }
}
